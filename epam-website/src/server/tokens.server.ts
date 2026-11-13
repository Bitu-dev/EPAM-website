import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "./env.server.ts";

export type Role = "ADMIN" | "STAFF";
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

const key = () => Buffer.from(getEnv().JWT_SECRET, "base64");

export async function signAccessToken(
  user: Pick<AuthUser, "id" | "email" | "role">,
): Promise<string> {
  const env = getEnv();
  return new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(env.JWT_ISSUER)
    .setSubject(user.id)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TTL_SECONDS}s`)
    .sign(key());
}

/** Returns null for any invalid, expired, tampered or wrongly-issued token. */
export async function verifyAccessToken(token: string): Promise<{ id: string; role: Role } | null> {
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      issuer: getEnv().JWT_ISSUER,
    });
    const role = payload["role"];
    if (typeof payload.sub !== "string" || (role !== "ADMIN" && role !== "STAFF")) return null;
    return { id: payload.sub, role };
  } catch {
    return null;
  }
}

export const sha256Hex = (v: string): string =>
  createHash("sha256").update(v, "utf8").digest("hex");

/** 256-bit opaque refresh token. Only its hash is stored. */
export function newRefreshToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: sha256Hex(raw) };
}
