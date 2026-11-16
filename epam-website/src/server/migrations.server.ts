import type { Sql } from "./db.server.ts";

/**
 * Forward-only migrations, embedded as strings so they ship inside the server bundle (no files to copy into the
 * image). Never edit a migration that has been applied anywhere: add a new one.
 */
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_initial",
    sql: `
      CREATE TABLE users (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email         text NOT NULL,
        password_hash text NOT NULL,
        full_name     text NOT NULL,
        role          text NOT NULL,
        enabled       boolean NOT NULL DEFAULT true,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_users_role  CHECK (role IN ('ADMIN','STAFF')),
        CONSTRAINT chk_users_email CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 255),
        CONSTRAINT chk_users_name  CHECK (length(full_name) BETWEEN 1 AND 120)
      );
      CREATE UNIQUE INDEX uq_users_email ON users (email);

      -- Refresh tokens are stored only as SHA-256 hashes. family_id groups a login's rotation chain.
      CREATE TABLE refresh_tokens (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        family_id  uuid NOT NULL,
        token_hash text NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        -- set only when a token is replaced by normal rotation; the grace window applies to this, never to revocation
        rotated_at timestamptz,
        user_agent text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX uq_refresh_tokens_hash ON refresh_tokens (token_hash);
      CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
      CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at);

      CREATE TABLE inquiries (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        kind            text NOT NULL DEFAULT 'contact',
        status          text NOT NULL DEFAULT 'new',
        name            text NOT NULL,
        email           text NOT NULL,
        organization    text,
        message         text NOT NULL,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        updated_by      text,
        version         integer NOT NULL DEFAULT 0,
        -- email notification outbox
        notified_at     timestamptz,
        notify_attempts integer NOT NULL DEFAULT 0,
        next_notify_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_inquiries_kind    CHECK (kind IN ('contact','partner','support')),
        CONSTRAINT chk_inquiries_status  CHECK (status IN ('new','in_progress','resolved','spam')),
        CONSTRAINT chk_inquiries_name    CHECK (length(name) BETWEEN 1 AND 120),
        CONSTRAINT chk_inquiries_email   CHECK (length(email) BETWEEN 3 AND 255),
        CONSTRAINT chk_inquiries_org     CHECK (organization IS NULL OR length(organization) <= 200),
        CONSTRAINT chk_inquiries_message CHECK (length(message) BETWEEN 1 AND 3000)
      );
      CREATE INDEX idx_inquiries_status_created ON inquiries (status, created_at DESC);
      CREATE INDEX idx_inquiries_kind_created   ON inquiries (kind, created_at DESC);
      CREATE INDEX idx_inquiries_created        ON inquiries (created_at DESC);
      CREATE INDEX idx_inquiries_email_lower    ON inquiries (lower(email) text_pattern_ops);
      CREATE INDEX idx_inquiries_name_lower     ON inquiries (lower(name) text_pattern_ops);
      CREATE INDEX idx_inquiries_outbox ON inquiries (next_notify_at) WHERE notified_at IS NULL;

      -- Fixed-window counters shared by every app instance (rate limits, login failures).
      CREATE TABLE rate_limits (
        key      text PRIMARY KEY,
        count    integer NOT NULL,
        reset_at timestamptz NOT NULL
      );
      CREATE INDEX idx_rate_limits_reset ON rate_limits (reset_at);

      -- Who did what in the admin area. Never stores message contents.
      CREATE TABLE audit_log (
        id          bigserial PRIMARY KEY,
        at          timestamptz NOT NULL DEFAULT now(),
        actor_id    uuid,
        actor_email text,
        action      text NOT NULL,
        target_type text,
        target_id   text,
        ip          text,
        request_id  text
      );
      CREATE INDEX idx_audit_log_at ON audit_log (at DESC);
    `,
  },
];

const LOCK_KEY = 727_274; // arbitrary app-wide advisory lock id: only one instance migrates at a time

export async function runMigrations(db: Sql): Promise<string[]> {
  const applied: string[] = [];
  const conn = await db.reserve();
  try {
    await conn`SELECT pg_advisory_lock(${LOCK_KEY})`;
    try {
      await conn`CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`;
      const done = new Set(
        (await conn<{ id: string }[]>`SELECT id FROM schema_migrations`).map((r) => r.id),
      );
      for (const m of MIGRATIONS) {
        if (done.has(m.id)) continue;
        await conn.unsafe("BEGIN");
        try {
          await conn.unsafe(m.sql);
          await conn`INSERT INTO schema_migrations (id) VALUES (${m.id})`;
          await conn.unsafe("COMMIT");
          applied.push(m.id);
        } catch (e) {
          await conn.unsafe("ROLLBACK");
          throw e;
        }
      }
    } finally {
      await conn`SELECT pg_advisory_unlock(${LOCK_KEY})`;
    }
  } finally {
    conn.release();
  }
  return applied;
}
