/* eslint-disable no-control-regex -- sanitizeText strips control characters on purpose */
import { z } from "zod";
import { sql } from "./db.server.ts";
import { ApiError } from "./http.server.ts";
import type { AuthUser } from "./tokens.server.ts";

export const KINDS = ["contact", "partner", "support"] as const;
export const STATUSES = ["new", "in_progress", "resolved", "spam"] as const;

// Control, bidi-override and zero-width characters. Stripping them is the whole point of this expression.
const UNSAFE_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** NFC-normalise and drop control characters (keeping newline and tab); stored text can never carry NULs or ANSI. */
export function sanitizeText(input: string): string {
  return input.normalize("NFC").replace(/\r\n?/g, "\n").replace(UNSAFE_CHARS, "").trim();
}
const oneLine = (s: string) =>
  sanitizeText(s)
    .replace(/\s*\n\s*/g, " ")
    .replace(/[ \t]{2,}/g, " ");

const text = (min: number, max: number) =>
  z
    .string()
    .transform(oneLine)
    .pipe(
      z
        .string()
        .min(min, min === 1 ? "Required" : `At least ${min} characters`)
        .max(max, `At most ${max} characters`),
    );

export const submitSchema = z
  .object({
    kind: z.enum(KINDS).default("contact"),
    name: text(1, 120),
    email: z
      .string()
      .transform((v) => v.trim().toLowerCase())
      .pipe(z.string().email("Enter a valid email address").max(255)),
    organization: z
      .string()
      .transform(oneLine)
      .pipe(z.string().max(200))
      .nullish()
      .transform((v) => (v ? v : null)),
    message: z
      .string()
      .transform(sanitizeText)
      .pipe(z.string().min(1, "Required").max(3000, "At most 3000 characters")),
    /** Honeypot: humans never see this field; bots fill it. Accepted silently and discarded. */
    website: z.string().max(500).optional(),
  })
  .strict();

export type SubmitInput = z.infer<typeof submitSchema>;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(0).max(100_000).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
  kind: z.enum(KINDS).optional(),
  status: z.enum(STATUSES).optional(),
  q: z
    .string()
    .max(100)
    .transform((v) => v.trim())
    .optional(),
  sort: z.enum(["createdAt", "name", "email", "status", "kind"]).default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export const statusBodySchema = z
  .object({ status: z.enum(STATUSES), version: z.number().int().min(0).optional() })
  .strict();

const SORT_COLUMN = {
  createdAt: "created_at",
  name: "name",
  email: "email",
  status: "status",
  kind: "kind",
} as const;

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

interface Row {
  id: string;
  kind: string;
  status: string;
  name: string;
  email: string;
  organization: string | null;
  message: string;
  created_at: Date;
  updated_at: Date;
  updated_by: string | null;
  version: number;
}

const summary = (r: Row) => ({
  id: r.id,
  kind: r.kind,
  status: r.status,
  name: r.name,
  email: r.email,
  organization: r.organization,
  createdAt: r.created_at.toISOString(),
});
const detail = (r: Row) => ({
  ...summary(r),
  message: r.message,
  updatedAt: r.updated_at.toISOString(),
  updatedBy: r.updated_by,
  version: r.version,
});

export async function submit(input: SubmitInput): Promise<{ id: string; receivedAt: string }> {
  if (input.website) return { id: crypto.randomUUID(), receivedAt: new Date().toISOString() }; // honeypot
  const rows = await sql()<{ id: string; created_at: Date }[]>`
    INSERT INTO inquiries (kind, name, email, organization, message)
    VALUES (${input.kind}, ${input.name}, ${input.email}, ${input.organization}, ${input.message})
    RETURNING id, created_at`;
  const r = rows[0]!;
  return { id: r.id, receivedAt: r.created_at.toISOString() };
}

export async function search(q: ListQuery) {
  const db = sql();
  const where: ReturnType<typeof db>[] = [];
  if (q.kind) where.push(db`kind = ${q.kind}`);
  if (q.status) where.push(db`status = ${q.status}`);
  if (q.q) {
    // Prefix match on name/email using the lower() indexes; user-supplied wildcards are escaped.
    const like = q.q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`) + "%";
    where.push(db`(lower(name) LIKE ${like} OR lower(email) LIKE ${like})`);
  }
  const cond = where.length ? db`WHERE ${where.reduce((a, b) => db`${a} AND ${b}`)}` : db``;
  const col = db(SORT_COLUMN[q.sort]);
  const dir = q.direction === "asc" ? db`ASC` : db`DESC`;

  const counted = await db<
    { total: number }[]
  >`SELECT count(*)::int AS total FROM inquiries ${cond}`;
  const total = counted[0]?.total ?? 0;
  const rows = await db<Row[]>`
    SELECT id, kind, status, name, email, organization, '' AS message, created_at, updated_at, updated_by, version
    FROM inquiries ${cond}
    ORDER BY ${col} ${dir}, id ASC
    LIMIT ${q.size} OFFSET ${q.page * q.size}`;
  const totalPages = Math.ceil(total / q.size);
  return {
    items: rows.map(summary),
    page: q.page,
    size: q.size,
    totalElements: total,
    totalPages,
    last: q.page + 1 >= totalPages,
  };
}

export async function get(id: string) {
  if (!isUuid(id)) throw new ApiError("NOT_FOUND");
  const rows = await sql()<Row[]>`SELECT * FROM inquiries WHERE id = ${id}`;
  if (!rows[0]) throw new ApiError("NOT_FOUND");
  return detail(rows[0]);
}

export async function updateStatus(
  id: string,
  status: string,
  expectedVersion: number | undefined,
  actor: AuthUser,
) {
  if (!isUuid(id)) throw new ApiError("NOT_FOUND");
  const rows = await sql()<Row[]>`
    UPDATE inquiries
    SET status = ${status}, updated_at = now(), updated_by = ${actor.email}, version = version + 1
    WHERE id = ${id} AND (${expectedVersion ?? null}::int IS NULL OR version = ${expectedVersion ?? null}::int)
    RETURNING *`;
  if (!rows[0]) {
    const exists = await sql()`SELECT 1 FROM inquiries WHERE id = ${id}`;
    throw new ApiError(exists.length ? "CONFLICT" : "NOT_FOUND");
  }
  return detail(rows[0]);
}

export async function remove(id: string): Promise<void> {
  if (!isUuid(id)) throw new ApiError("NOT_FOUND");
  const rows = await sql()`DELETE FROM inquiries WHERE id = ${id} RETURNING id`;
  if (!rows.length) throw new ApiError("NOT_FOUND");
}

export async function audit(
  actor: AuthUser | null,
  action: string,
  target: { type?: string; id?: string },
  meta: { ip: string; requestId: string },
): Promise<void> {
  await sql()`
    INSERT INTO audit_log (actor_id, actor_email, action, target_type, target_id, ip, request_id)
    VALUES (${actor?.id ?? null}, ${actor?.email ?? null}, ${action}, ${target.type ?? null}, ${target.id ?? null},
            ${meta.ip}, ${meta.requestId})`;
}
