# Architecture

```
Browser ──HTTPS──> Caddy (TLS, headers, gzip) ──> app (Node: SSR pages + /api/v1) ──> PostgreSQL
                                                     └── SMTP (new-inquiry email, via outbox)
```

One deployable. The API lives in `src/server/**` and is mounted by thin route files `src/routes/api.v1.*.ts`
(TanStack Start server routes), so the site and API share one process, one image and one origin: no CORS, no
cross-site cookies.

## Why this and not a separate Java service

The site has one write path (the contact form) and a small staff inbox. A JVM + Redis + Kubernetes stack is far
more to patch, monitor and pay for than this needs, and could not be compiled or tested in the environment this was
built in. This backend is exercised end to end (`scripts/e2e.mjs`) against real PostgreSQL and SMTP. Rate limits
live in PostgreSQL, so there is no Redis to run.

## API (`/api/v1`, JSON, same envelope for every response)

Success `{ success: true, data, requestId, timestamp }`; failure `{ success: false, error: { code, message, details? }, requestId, timestamp }`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/inquiries` | none | Rate-limited per client IP (default 5 / 10 min). 201 `{ id, receivedAt }`. Honeypot field `website`. |
| POST | `/auth/login` | none | Needs `X-Requested-With: XMLHttpRequest`. Sets httpOnly refresh cookie, returns `{ accessToken, tokenType, expiresIn, user }`. |
| POST | `/auth/refresh` | cookie | Rotates the refresh token. |
| POST | `/auth/logout` | cookie | Revokes the session family, clears the cookie. 204. |
| GET | `/auth/me` | Bearer | Current user. |
| GET | `/admin/inquiries` | STAFF, ADMIN | `page,size(<=100),kind,status,q,sort,direction`. Summaries only (no message). |
| GET | `/admin/inquiries/{id}` | STAFF, ADMIN | Full record including message. |
| PATCH | `/admin/inquiries/{id}/status` | STAFF, ADMIN | `{ status, version? }`; a stale `version` returns 409. Audited. |
| DELETE | `/admin/inquiries/{id}` | ADMIN | 204. Audited. |
| POST | `/csp-report` | none | Logs CSP violations. |
| GET | `/healthz`, `/readyz` | none | Liveness; readiness (DB reachable, migrated). |
| GET | `/sitemap.xml`, `/robots.txt` | none | Built from `PUBLIC_URL`. |

Error codes: `VALIDATION_FAILED 400`, `MALFORMED_REQUEST 400`, `UNAUTHENTICATED 401`, `INVALID_CREDENTIALS 401`,
`INVALID_REFRESH_TOKEN 401`, `ACCESS_DENIED 403`, `NOT_FOUND 404`, `CONFLICT 409`, `PAYLOAD_TOO_LARGE 413`,
`UNSUPPORTED_MEDIA_TYPE 415`, `RATE_LIMITED 429`, `ACCOUNT_LOCKED 429`, `SERVICE_UNAVAILABLE 503`, `INTERNAL_ERROR 500`.

## Data model (migrations in `src/server/migrations.server.ts`, applied automatically under an advisory lock)

`users` (email unique+lowercase, scrypt hash, role ADMIN|STAFF, enabled) · `refresh_tokens` (SHA-256 hash only,
family id, rotated_at / revoked_at) · `inquiries` (CHECK constraints mirror the validation; version for optimistic
locking; outbox columns `notified_at, notify_attempts, next_notify_at`) · `rate_limits` · `audit_log`.
To change the schema, **append** a new migration; never edit an applied one.

## Authentication lifecycle

1. Login verifies a scrypt hash (a dummy hash is checked for unknown emails so timing does not leak which exist).
2. Returns a 15-minute HS256 access token (held in browser memory only) and sets a 7-day opaque refresh token in an
   `HttpOnly; SameSite=Strict; Path=/api/v1/auth` cookie. Only the token's hash is stored.
3. The access token is re-checked against the database on every admin call, so disabling a user takes effect
   immediately and roles are never trusted from the token.
4. Each refresh rotates the token. Replaying an already-rotated token after a 10-second grace window (two tabs
   refreshing at once) is treated as theft and revokes all of that user's sessions.
5. Lockout is keyed on (email, IP): 5 failures / 15 min blocks that source only, so a stranger cannot lock the real
   admin out. A higher per-email ceiling (40) slows distributed guessing.

## Security decisions

- Origin check on every request (cross-origin writes are refused unless listed in `ALLOWED_ORIGINS`); cookie
  endpoints additionally require `X-Requested-With`.
- Client IP: `X-Forwarded-For` is trusted only for `TRUSTED_PROXY_HOPS` proxies, reading from the right, so a client
  cannot spoof its way around rate limits. Compose sets it to 1 (Caddy).
- All SQL is parameterised; sort columns come from a whitelist; search wildcards are escaped.
- Inputs are NFC-normalised and stripped of control/bidi characters; unknown JSON fields are rejected.
- Logs are one JSON line per request with no names, emails, messages, passwords or tokens (asserted by the e2e test).
- New-inquiry email uses an outbox: the visitor always succeeds; delivery is retried with backoff (up to 8 attempts).
- CSP is **Report-Only** because SSR output contains inline hydration scripts; violations are logged. Enforce it
  after a week of clean logs, ideally with nonces.
- Known accepted risk: zod 3 advisory GHSA-mrhx-c7xc-m3w5 (needs oversized collections; no endpoint accepts arrays,
  bodies are capped at 16 KB). Upgrade to zod 4 when convenient.
