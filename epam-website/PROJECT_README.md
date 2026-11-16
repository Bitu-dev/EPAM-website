# EPAM Website — Project Guide

This file is a supplementary project guide. The original `README.md` and all existing project files are preserved.

## 1. Project purpose

The EPAM (Ethiopian Peace Mother Association) website presents the association, its work and impact, media, partners, and contact information. It also includes a staff-facing inquiry management area.

## 2. Technology stack

| Area | Technology in this repository |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS 4 |
| Web framework and routing | TanStack Start / TanStack Router |
| Build tooling | Vite 8 with the repository's Lovable TanStack configuration |
| UI primitives | Radix UI and locally maintained components |
| API | TypeScript server routes under TanStack Start |
| Database | PostgreSQL 16 |
| Database schema | Drizzle ORM / SQL migrations |
| Validation | Zod |
| Authentication | Short-lived JWT access token and rotating, httpOnly refresh cookie |
| Email | Nodemailer / SMTP with a database-backed outbox |
| Tests | Vitest and repository integration / HTTP test scripts |
| Deployment | Docker Compose, Node.js 22 runtime, Caddy reverse proxy |

## 3. Main website pages

- `/` — home page
- `/about` — association information
- `/impact` — impact and activities
- `/media` — media content
- `/partners` — partners
- `/contact` — contact and inquiry form
- `/admin/inquiries` — protected staff inquiry management

## 4. Repository map

```text
epam-website/
├── public/                 # Public static files, logo and favicon
├── src/
│   ├── assets/             # Imported image assets
│   ├── components/         # Shared layout and UI components
│   │   └── ui/             # Reusable UI primitives
│   ├── hooks/              # Shared React hooks
│   ├── lib/                # Shared client utilities and API helpers
│   ├── routes/             # Website pages and HTTP API route adapters
│   ├── server/             # Server-side business logic and infrastructure
│   ├── styles.css          # Global styles
│   ├── router.tsx          # Router setup
│   ├── server.ts           # Server entry / error wrapper
│   └── start.ts            # Application start configuration
├── drizzle/                # Database schema and migration files
├── docs/                   # Architecture, stack, go-live and API documentation
├── deploy/                 # Caddy configuration
├── scripts/                # User, backup, restore and end-to-end scripts
├── .github/                # CI, deployment and repository templates
├── Dockerfile              # Multi-stage application image
├── docker-compose.yml      # App, PostgreSQL and Caddy services
├── package.json            # Scripts and dependencies
├── bun.lock                # Bun dependency lockfile
└── .env.example            # Environment variable template
```

## 5. Run locally

### Prerequisites

- Bun version compatible with the lockfile and project dependencies
- Node.js 22 for the production runtime and scripts
- PostgreSQL 16 (local or container)

### Install and configure

```bash
bun install --frozen-lockfile

# Start PostgreSQL separately, or use the database service in Docker Compose.
cp .env.example .env
```

Set the required values in `.env`. At minimum, configure `POSTGRES_PASSWORD`, `JWT_SECRET`, and the database connection used by the application. For local plain-HTTP testing, set `COOKIE_SECURE=false`. Configure SMTP and the bootstrap administrator if you need inquiry notifications and the admin area.

Generate a strong JWT secret, for example:

```bash
openssl rand -base64 48
```

Start the development server:

```bash
bun run dev
```

The package's development script uses Vite. The exact local URL is printed by the dev server; the production container listens on port `3000`.

## 6. Useful commands

| Command | Purpose |
|---|---|
| `bun run dev` | Start local development server |
| `bun run build` | Create production build |
| `bun run preview` | Preview the Vite build where supported by the configured framework |
| `bun run lint` | Run ESLint |
| `bun run test` | Run Vitest tests |
| `bun run test:watch` | Run tests in watch mode |
| `bun run test:e2e` | Run the repository's end-to-end script |

The repository's original README and `docs/GO_LIVE.md` contain additional environment, test, and deployment details. Follow those documents for operational setup.

## 7. Production deployment overview

The included Compose stack is designed as:

1. Caddy accepts public HTTP/HTTPS traffic and handles TLS.
2. The application container serves server-rendered pages and `/api/v1` routes.
3. PostgreSQL stores users, sessions, inquiries, rate limits and audit records.
4. SMTP delivers inquiry notifications through the outbox/retry flow.

Before production, complete the placeholders and security checklist in `docs/GO_LIVE.md`, configure DNS and secrets, and verify the deployment in a staging environment.

## 8. Important project-management notes

- Keep the existing design and content stable unless a change is explicitly approved.
- Do not commit `.env`, production credentials, database dumps or secret keys.
- Add database changes as new forward-only migrations; do not rewrite migrations already applied to a live database.
- Run lint, tests and a production build before release.
- Back up the database and test restoration before production changes.
- Have EPMA leadership verify organizational claims, contact details, registration information and published documents before launch.

## 9. Existing documentation

- `README.md` — original setup and quality-gate guide
- `docs/ARCHITECTURE.md` — original architecture, API, data model and security decisions
- `docs/STACK.md` — technology requirement-to-implementation mapping
- `docs/GO_LIVE.md` — production launch and operations runbook
- `docs/openapi.yaml` — API contract
