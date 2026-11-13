# EPAM website

TanStack Start (React 19, Tailwind 4) with a built-in TypeScript backend and PostgreSQL. One container serves the
site and the API; Caddy in front provides HTTPS.

## Run locally

```bash
bun install
# needs a PostgreSQL; e.g.  docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16-alpine
export DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres
export JWT_SECRET=$(openssl rand -base64 48)
export COOKIE_SECURE=false BOOTSTRAP_ADMIN_EMAIL=you@example.org BOOTSTRAP_ADMIN_PASSWORD='a-long-passphrase'
bun run dev          # site + API on http://localhost:3000, admin at /admin/inquiries
```

The schema is created automatically on first start.

## Quality gates

| Command | What it checks |
|---|---|
| `bun run lint` / `bunx tsc --noEmit` | ESLint + Prettier, TypeScript |
| `bun run test` | Unit tests (config, IP resolution, sanitising, hashing, frontend) |
| `NITRO_PRESET=node-server bun run build && node scripts/e2e.mjs` | Boots the built server against a real PostgreSQL and a real SMTP sink and runs ~35 HTTP checks (auth, rate limits, RBAC, outbox, contract with the frontend schemas). Set `DATABASE_ADMIN_URL` to a Postgres superuser URL. |

## Tests at a glance

| Level | Where | Run |
|---|---|---|
| Unit | `src/server/*.test.ts`, `src/lib/api/http.test.ts` | `bun run test` |
| Integration (browser side) | `src/test/contact-flow.test.tsx` renders the real contact page and checks what is sent to the API | `bun run test` |
| Integration / end-to-end (server) | `scripts/e2e.mjs`: built server + real PostgreSQL + real SMTP, ~35 HTTP checks | `node scripts/e2e.mjs` |
| API contract | `docs/openapi.yaml` is checked against the real routes, enums and error codes | `bun run test` |

Stack requirement → implementation map: [`docs/STACK.md`](docs/STACK.md). API reference: [`docs/openapi.yaml`](docs/openapi.yaml).
Contributing and GitHub setup: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Operations

- Deploy and first-time setup: [`docs/GO_LIVE.md`](docs/GO_LIVE.md)
- How it works, API reference, data model, security decisions: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Staff accounts: `docker compose --profile tools run --rm -e USER_PASSWORD='...' tools bun scripts/user.ts create --email a@b.org --name "Full Name" --role STAFF`
  (also `list`, `set-password`, `disable`, `enable`).
