import { sql } from "./db.server.ts";

export interface Hit {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter in PostgreSQL, atomic via one upsert, shared by all app instances.
 * (Redis is unnecessary at this traffic level and is one less thing to run and secure.)
 */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<Hit> {
  const rows = await sql()<{ count: number; ttl: number }[]>`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT (key) DO UPDATE SET
      count    = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= now() THEN now() + make_interval(secs => ${windowSeconds})
                      ELSE rate_limits.reset_at END
    RETURNING count, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (reset_at - now()))))::int AS ttl`;
  const row = rows[0]!;
  return {
    allowed: row.count <= limit,
    count: row.count,
    remaining: Math.max(limit - row.count, 0),
    retryAfterSeconds: row.ttl,
  };
}

/** Current count in an unexpired window (0 if none). Does not increment. */
export async function peek(key: string): Promise<{ count: number; retryAfterSeconds: number }> {
  const rows = await sql()<{ count: number; ttl: number }[]>`
    SELECT count, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (reset_at - now()))))::int AS ttl
    FROM rate_limits WHERE key = ${key} AND reset_at > now()`;
  const row = rows[0];
  return row
    ? { count: row.count, retryAfterSeconds: row.ttl }
    : { count: 0, retryAfterSeconds: 0 };
}

export async function clear(key: string): Promise<void> {
  await sql()`DELETE FROM rate_limits WHERE key = ${key}`;
}

export async function purgeExpired(): Promise<void> {
  await sql()`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 hour'`;
}
