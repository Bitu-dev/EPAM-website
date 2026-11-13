import { getEnv } from "./env.server.ts";
import { sql } from "./db.server.ts";
import { ApiError } from "./http.server.ts";
import { clear, hit, peek } from "./ratelimit.server.ts";
import {
  dummyHash,
  hashPassword,
  verifyPassword,
  PASSWORD_MIN,
  PASSWORD_MAX,
} from "./password.server.ts";
import {
  newRefreshToken,
  sha256Hex,
  signAccessToken,
  verifyAccessToken,
  type AuthUser,
  type Role,
} from "./tokens.server.ts";

const LOGIN_WINDOW = 15 * 60;
const MAX_FAILS_PER_EMAIL_AND_IP = 5;
/** Slows distributed guessing against one account without letting one stranger lock out the real admin. */
const MAX_FAILS_PER_EMAIL_ANY_IP = 40;

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: Role;
  enabled: boolean;
}

const toUser = (r: UserRow): AuthUser => ({
  id: r.id,
  email: r.email,
  fullName: r.full_name,
  role: r.role,
});
export const normalizeEmail = (e: string): string => e.trim().toLowerCase();

export interface Session {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthUser;
  refreshToken: string;
}

async function issueSession(
  user: AuthUser,
  userAgent: string | null,
  familyId?: string,
): Promise<Session> {
  const env = getEnv();
  const refresh = newRefreshToken();
  const family = familyId ?? crypto.randomUUID();
  await sql()`
    INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, user_agent)
    VALUES (${user.id}, ${family}, ${refresh.hash}, now() + make_interval(secs => ${env.REFRESH_TTL_SECONDS}),
            ${userAgent?.slice(0, 255) ?? null})`;
  return {
    accessToken: await signAccessToken(user),
    tokenType: "Bearer",
    expiresIn: env.ACCESS_TTL_SECONDS,
    user,
    refreshToken: refresh.raw,
  };
}

export async function login(
  emailRaw: string,
  password: string,
  ip: string,
  userAgent: string | null,
): Promise<Session> {
  const email = normalizeEmail(emailRaw);
  const keyEmailIp = `lf:ei:${sha256Hex(email)}:${ip}`;
  const keyEmail = `lf:e:${sha256Hex(email)}`;

  const [a, b] = await Promise.all([peek(keyEmailIp), peek(keyEmail)]);
  if (a.count >= MAX_FAILS_PER_EMAIL_AND_IP || b.count >= MAX_FAILS_PER_EMAIL_ANY_IP) {
    throw new ApiError("ACCOUNT_LOCKED", undefined, undefined, {
      "retry-after": String(Math.max(a.retryAfterSeconds, b.retryAfterSeconds, 1)),
    });
  }

  const rows = await sql()<UserRow[]>`
    SELECT id, email, password_hash, full_name, role, enabled FROM users WHERE email = ${email}`;
  const row = rows[0];
  // Always run one scrypt verification so timing does not reveal whether the account exists.
  const valid = await verifyPassword(password, row?.password_hash ?? (await dummyHash()));

  if (!row || !row.enabled || !valid) {
    await Promise.all([
      hit(keyEmailIp, Infinity, LOGIN_WINDOW),
      hit(keyEmail, Infinity, LOGIN_WINDOW),
    ]);
    throw new ApiError("INVALID_CREDENTIALS");
  }
  await clear(keyEmailIp);
  return issueSession(toUser(row), userAgent);
}

type RefreshOutcome =
  | { kind: "ok"; user: AuthUser; familyId: string }
  | { kind: "reuse"; userId: string }
  | { kind: "invalid" };

export async function refresh(rawToken: string, userAgent: string | null): Promise<Session> {
  const hash = sha256Hex(rawToken);
  const outcome = await sql().begin(async (tx): Promise<RefreshOutcome> => {
    const rows = await tx<
      {
        id: string;
        user_id: string;
        family_id: string;
        revoked_at: Date | null;
        expired: boolean;
        within_grace: boolean;
      }[]
    >`
      SELECT id, user_id, family_id, revoked_at,
             expires_at <= now() AS expired,
             (rotated_at IS NOT NULL AND rotated_at > now() - make_interval(secs => ${getEnv().REFRESH_GRACE_SECONDS})) AS within_grace
      FROM refresh_tokens WHERE token_hash = ${hash} FOR UPDATE`;
    const t = rows[0];
    if (!t || t.expired) return { kind: "invalid" };

    if (t.revoked_at && !t.within_grace) {
      // A token that was already rotated, replayed outside the grace window: assume theft, end every session.
      await tx`UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()), rotated_at = NULL WHERE user_id = ${t.user_id}`;
      return { kind: "reuse", userId: t.user_id };
    }

    const users = await tx<UserRow[]>`
      SELECT id, email, password_hash, full_name, role, enabled FROM users WHERE id = ${t.user_id}`;
    const u = users[0];
    if (!u || !u.enabled) return { kind: "invalid" };

    if (!t.revoked_at)
      await tx`UPDATE refresh_tokens SET revoked_at = now(), rotated_at = now() WHERE id = ${t.id}`;
    return { kind: "ok", user: toUser(u), familyId: t.family_id };
  });

  if (outcome.kind !== "ok") throw new ApiError("INVALID_REFRESH_TOKEN");
  return issueSession(outcome.user, userAgent, outcome.familyId);
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await sql()`
    UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()), rotated_at = NULL
    WHERE family_id IN (SELECT family_id FROM refresh_tokens WHERE token_hash = ${sha256Hex(rawToken)})`;
}

/** Resolves the bearer token to a live, enabled user. Role is read from the database, not trusted from the JWT. */
export async function authenticate(request: Request): Promise<AuthUser> {
  const header = request.headers.get("authorization");
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  if (!match) throw new ApiError("UNAUTHENTICATED");
  const claims = await verifyAccessToken(match[1]!);
  if (!claims) throw new ApiError("UNAUTHENTICATED");
  const rows = await sql()<UserRow[]>`
    SELECT id, email, password_hash, full_name, role, enabled FROM users WHERE id = ${claims.id}`;
  const u = rows[0];
  if (!u || !u.enabled) throw new ApiError("UNAUTHENTICATED");
  return toUser(u);
}

export function requireRole(user: AuthUser, ...roles: Role[]): void {
  if (!roles.includes(user.role)) throw new ApiError("ACCESS_DENIED");
}

export async function createUser(input: {
  email: string;
  password: string;
  fullName: string;
  role: Role;
}): Promise<AuthUser> {
  if (input.password.length < PASSWORD_MIN || input.password.length > PASSWORD_MAX) {
    throw new Error(`password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters`);
  }
  const rows = await sql()<UserRow[]>`
    INSERT INTO users (email, password_hash, full_name, role)
    VALUES (${normalizeEmail(input.email)}, ${await hashPassword(input.password)}, ${input.fullName}, ${input.role})
    RETURNING id, email, password_hash, full_name, role, enabled`;
  return toUser(rows[0]!);
}

export async function purgeTokens(): Promise<void> {
  await sql()`DELETE FROM refresh_tokens WHERE expires_at < now() - interval '7 days'`;
}
