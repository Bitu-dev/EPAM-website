# EPAM Website — Comprehensive Project Documentation

**Organization:** Ethiopian Peace Mother Association (EPAM)
**Document Type:** Technical Project Reference
**Version:** 1.0
**Status:** Production-Ready
**Prepared By:** Project Management Office

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Directory Structure](#4-directory-structure)
5. [Database Design](#5-database-design)
6. [API Reference](#6-api-reference)
7. [Authentication & Security](#7-authentication--security)
8. [Environment Configuration](#8-environment-configuration)
9. [Local Development Setup](#9-local-development-setup)
10. [Testing Strategy](#10-testing-strategy)
11. [CI/CD Pipeline](#11-cicd-pipeline)
12. [Docker & Containerization](#12-docker--containerization)
13. [Production Deployment](#13-production-deployment)
14. [Backup & Recovery](#14-backup--recovery)
15. [Monitoring & Alerting](#15-monitoring--alerting)
16. [Developer Contribution Guide](#16-developer-contribution-guide)
17. [Admin Operations](#17-admin-operations)
18. [Known Risks & Decisions](#18-known-risks--decisions)
19. [Pre-Launch Checklist](#19-pre-launch-checklist)

---

## 1. Project Overview

### 1.1 Purpose

The EPAM website is the digital presence of the **Ethiopian Peace Mother Association**. It serves two distinct user groups:

| Audience | Experience |
|---|---|
| **Public visitors** | Learn about EPAM's mission, impact, media coverage, and partners; submit contact/partner/support inquiries |
| **Staff & Administrators** | Manage and respond to submitted inquiries via a protected admin dashboard |

### 1.2 Public Pages

| Route | Description |
|---|---|
| `/` | Home — association landing page |
| `/about` | About — organizational background, registration, leadership |
| `/impact` | Impact — activities, outcomes, and statistics |
| `/media` | Media — press coverage and published media |
| `/partners` | Partners — partner organizations |
| `/contact` | Contact — inquiry submission form |
| `/admin/inquiries` | Admin — protected staff inbox (requires login) |

### 1.3 Key Design Principles

- **Single deployable unit** — one process, one image, one origin; no CORS needed
- **Zero-dependency operations** — rate limiting and outbox run on PostgreSQL; no Redis or message broker required
- **Security by default** — scrypt passwords, rotating JWT, parameterised SQL, full audit log
- **Forward-only migrations** — applied automatically at boot under an advisory lock; never rewrite applied migrations

---

## 2. Technology Stack

### 2.1 Language

> **100% TypeScript** — frontend, backend, tests, and scripts are all written in TypeScript. File extensions: `.tsx` (React components/pages), `.ts` (server, utilities, tests), `.mjs` (ES module scripts).

### 2.2 Full Stack Reference

| Layer | Technology | Version | Role |
|---|---|---|---|
| **Runtime** | Node.js | 22 | Production server runtime |
| **Package Manager** | Bun | 1.x | Dependency management, script runner, dev server |
| **Frontend Framework** | React | 19 | UI rendering |
| **SSR Framework** | TanStack Start | 1.168.x | Server-side rendering — plays the same role as Next.js |
| **Router** | TanStack Router | 1.170.x | File-based, type-safe routing |
| **Server State** | TanStack Query | 5.x | Data fetching & caching |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS |
| **UI Primitives** | Radix UI + shadcn/ui | Various | Accessible, unstyled component system |
| **Forms** | React Hook Form | 7.x | Form management |
| **Validation** | Zod | 3.x | Schema validation (client + server) |
| **State Management** | Zustand | 5.x | Lightweight client state |
| **Icons** | Lucide React | 0.575.x | Icon library |
| **Charts** | Recharts | 2.x | Data visualization |
| **Build Tool** | Vite | 8.x | Frontend bundler + dev server |
| **Server Adapter** | Nitro | 3.x | Production Node.js server adapter |
| **Database** | PostgreSQL | 16 | Primary data store |
| **DB ORM/Migrations** | Drizzle | 0.x | Schema definition, migration toolkit |
| **DB Driver** | postgres (pg) | 4.x | Raw parameterised SQL queries |
| **Authentication** | jose | 6.x | JWT creation and verification |
| **Email** | Nodemailer | 10.x | SMTP email delivery |
| **Reverse Proxy** | Caddy | 2 (Alpine) | TLS termination, HTTPS, HSTS, gzip |
| **Containerization** | Docker + Compose | — | Deployment and service orchestration |
| **Testing** | Vitest | 4.x | Unit and integration test runner |
| **Linting** | ESLint | 9.x | Code quality enforcement |
| **Formatting** | Prettier | 3.x | Code style enforcement |
| **Type Checking** | TypeScript | 5.8.x | Static type safety |

---

## 3. System Architecture

### 3.1 High-Level Topology

```
┌─────────────────────────────────────────────────────────────┐
│  Internet                                                   │
│  Browser ──HTTPS──► Caddy (TLS · HSTS · gzip)              │
│                           │                                 │
│                           ▼                                 │
│              ┌────────────────────────┐                     │
│              │   Node.js App (port 3000)                    │
│              │   ┌──────────────────┐ │                     │
│              │   │ SSR Pages (.tsx) │ │                     │
│              │   │ React 19 + TSS   │ │                     │
│              │   └──────────────────┘ │                     │
│              │   ┌──────────────────┐ │                     │
│              │   │ REST API /api/v1  │ │                     │
│              │   │ (.ts server routes│ │                     │
│              │   └──────────────────┘ │                     │
│              └────────┬───────────────┘                     │
│                       │                                     │
│              ┌────────┴───────────────┐                     │
│              │   PostgreSQL 16        │                      │
│              │   users · inquiries    │                      │
│              │   rate_limits · audit  │                      │
│              └────────────────────────┘                     │
│                       │                                     │
│              ┌────────▼───────────────┐                     │
│              │   SMTP Server          │                      │
│              │   (outbox / retry)     │                      │
│              └────────────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

**Key architectural decision:** The site and the API share **one process, one Docker image, and one origin** — no CORS configuration, no cross-site cookies, no separate backend service to manage.

### 3.2 Docker Compose Service Map

| Service | Image | External Port | Description |
|---|---|---|---|
| `caddy` | `caddy:2-alpine` | 80, 443 | Reverse proxy, TLS termination, HTTPS redirect |
| `app` | `epam-website:local` | None (internal only) | Node.js SSR + API server on port 3000 |
| `db` | `postgres:16-alpine` | None (internal only) | PostgreSQL 16 database |
| `tools` | `epam-website:local` (tools target) | None | One-off admin CLI tasks (profile: tools) |

### 3.3 Request Lifecycle

```
Browser
  │
  ├─► GET /about  ─────────────────────────────► SSR: React renders page on server
  │                                              Hydrates in browser
  │
  ├─► POST /api/v1/inquiries ──────────────────► Zod validates body
  │                                              Rate limit checked in PostgreSQL
  │                                              Inquiry saved → 201
  │                                              Outbox flag set for SMTP delivery
  │
  └─► GET /admin/inquiries ────────────────────► Bearer JWT verified
                                                 User re-checked live in DB
                                                 Paginated inquiry list returned
```

---

## 4. Directory Structure

```
epam-website/
│
├── src/                          # All application source code
│   ├── routes/                   # TanStack Start file-based routes
│   │   ├── __root.tsx            # Root layout (wraps all pages)
│   │   ├── index.tsx             # Home page  /
│   │   ├── about.tsx             # About page  /about
│   │   ├── contact.tsx           # Contact form  /contact
│   │   ├── impact.tsx            # Impact page  /impact
│   │   ├── media.tsx             # Media page  /media
│   │   ├── partners.tsx          # Partners page  /partners
│   │   ├── admin.inquiries.tsx   # Admin inbox  /admin/inquiries
│   │   ├── api.v1.auth.login.ts         # POST /api/v1/auth/login
│   │   ├── api.v1.auth.logout.ts        # POST /api/v1/auth/logout
│   │   ├── api.v1.auth.me.ts            # GET  /api/v1/auth/me
│   │   ├── api.v1.auth.refresh.ts       # POST /api/v1/auth/refresh
│   │   ├── api.v1.inquiries.ts          # POST /api/v1/inquiries
│   │   ├── api.v1.admin.inquiries.ts            # GET  /api/v1/admin/inquiries
│   │   ├── api.v1.admin.inquiries.$id.ts        # GET/DELETE /api/v1/admin/inquiries/:id
│   │   ├── api.v1.admin.inquiries.$id.status.ts # PATCH /api/v1/admin/inquiries/:id/status
│   │   ├── api.v1.csp-report.ts         # POST /api/v1/csp-report
│   │   ├── healthz.ts                   # GET /healthz (liveness)
│   │   ├── readyz.ts                    # GET /readyz (readiness)
│   │   ├── robots[.]txt.ts              # GET /robots.txt
│   │   └── sitemap[.]xml.ts             # GET /sitemap.xml
│   │
│   ├── server/                   # Backend business logic (Node.js)
│   │   ├── api.server.ts         # API request/response helpers
│   │   ├── auth.server.ts        # JWT creation, verification, session management
│   │   ├── boot.server.ts        # Application startup sequence
│   │   ├── db.server.ts          # PostgreSQL connection pool
│   │   ├── env.server.ts         # Environment variable parsing + validation (Zod)
│   │   ├── handlers.server.ts    # HTTP route handler factories
│   │   ├── http.server.ts        # HTTP primitives, request parsing
│   │   ├── inquiries.server.ts   # Inquiry CRUD + outbox logic
│   │   ├── migrations.server.ts  # Embedded SQL migrations (auto-run at boot)
│   │   ├── notifier.server.ts    # SMTP email delivery + retry outbox
│   │   ├── password.server.ts    # scrypt hashing + verification
│   │   ├── ratelimit.server.ts   # PostgreSQL-backed rate limiting
│   │   ├── security-headers.server.ts  # CSP, HSTS, X-Frame-Options headers
│   │   ├── tokens.server.ts      # Refresh token lifecycle (rotation, revocation)
│   │   ├── server.test.ts        # Server-level unit tests
│   │   └── openapi.test.ts       # API contract drift detection tests
│   │
│   ├── components/               # Shared React components
│   │   ├── SiteLayout.tsx        # Page shell (nav, footer)
│   │   └── ui/                   # 40+ shadcn/ui primitives
│   │       ├── button.tsx, card.tsx, dialog.tsx, form.tsx
│   │       ├── input.tsx, label.tsx, select.tsx, table.tsx
│   │       ├── badge.tsx, accordion.tsx, carousel.tsx, chart.tsx
│   │       └── ... (complete Radix UI component library)
│   │
│   ├── features/                 # Feature-scoped code
│   │   ├── auth/                 # Login form, auth state, token refresh
│   │   └── inquiries/            # Admin inquiry list, detail, status update
│   │
│   ├── hooks/                    # Shared custom React hooks
│   ├── lib/                      # Shared utilities
│   │   ├── utils.ts              # Tailwind class merging, helpers
│   │   ├── site-store.ts         # Zustand global state
│   │   └── api/                  # Typed HTTP client
│   │       ├── http.ts           # Fetch wrapper with token injection
│   │       ├── http.test.ts      # HTTP client unit tests
│   │       ├── auth-store.ts     # Auth token store
│   │       ├── config.ts         # API base URL config
│   │       ├── submit-inquiry.ts # Contact form submission helper
│   │       └── types.ts          # Shared API TypeScript types
│   │
│   ├── integrations/
│   │   └── supabase/             # Supabase client (optional integration)
│   │
│   ├── assets/                   # Imported image/media assets
│   │   └── mothers-group.jpg     # Hero/feature image
│   ├── router.tsx                # TanStack Router setup
│   ├── routeTree.gen.ts          # Auto-generated route tree (do not edit manually)
│   ├── server.ts                 # Server entry + error boundary
│   ├── start.ts                  # Application bootstrap config
│   └── styles.css                # Global Tailwind CSS styles
│
├── docs/                         # Project documentation
│   ├── ARCHITECTURE.md           # Architecture, API, data model, security decisions
│   ├── STACK.md                  # Requirement → implementation mapping
│   ├── GO_LIVE.md                # Production launch runbook
│   ├── openapi.yaml              # OpenAPI 3.0.3 API contract (lint-enforced)
│   ├── PROJECT_ARCHITECTURE.md   # Architecture overview
│   └── brand/                   # Brand assets
│       └── epma_logo_original.jpg  # Full-resolution logo for print
│
├── scripts/                      # Operational scripts
│   ├── e2e.mjs                   # End-to-end HTTP test suite (~35 checks)
│   ├── user.ts                   # Staff account management CLI
│   ├── backup.sh                 # AES-256 encrypted PostgreSQL backup
│   └── restore.sh                # Encrypted backup restore script
│
├── drizzle/                      # Drizzle ORM output (migration artifacts)
│   └── migrations/               # Migration SQL files
│
├── deploy/                       # Deployment configuration
│   └── Caddyfile                 # Caddy reverse proxy config
│
├── public/                       # Static public assets
│   ├── epma_logo.jpg             # Site logo (320px, 25KB, optimized)
│   └── favicon.ico               # Browser favicon
│
├── supabase/                     # Supabase local dev config
│   └── config.toml
│
├── .github/                      # GitHub repository automation
│   ├── workflows/
│   │   ├── ci.yml                # CI: lint, type-check, test, build, e2e, scan
│   │   └── deploy.yml            # CD: SSH deploy to production with auto-rollback
│   ├── ISSUE_TEMPLATE/           # Bug and feature issue templates
│   ├── pull_request_template.md  # PR checklist template
│   ├── CODEOWNERS                # Code ownership rules
│   └── dependabot.yml            # Automated dependency updates
│
├── Dockerfile                    # Multi-stage Docker build (deps → build → runtime)
├── docker-compose.yml            # Compose stack: db, app, caddy, tools
├── vite.config.ts                # Vite + TanStack Start build configuration
├── vitest.config.ts              # Vitest test runner configuration
├── tsconfig.json                 # TypeScript compiler configuration
├── drizzle.config.ts             # Drizzle ORM configuration
├── eslint.config.js              # ESLint flat config
├── .prettierrc                   # Prettier formatting rules
├── components.json               # shadcn/ui component registry config
├── package.json                  # NPM manifest, scripts, dependencies
├── bun.lock                      # Bun dependency lockfile (commit this)
├── bunfig.toml                   # Bun runtime configuration
├── .env.example                  # Environment variable template
├── .gitignore                    # Git ignored files (includes .env)
├── .dockerignore                 # Docker build context exclusions
├── AGENTS.md                     # AI agent context and conventions
├── CONTRIBUTING.md               # Developer contribution guide
├── SECURITY.md                   # Vulnerability reporting policy
├── README.md                     # Quick-start guide
└── PROJECT_README.md             # Supplementary project guide
```

---

## 5. Database Design

### 5.1 Schema Overview

All migrations are **embedded as strings** in `src/server/migrations.server.ts` and applied automatically at boot under a PostgreSQL advisory lock (key `727274`). **Never edit an applied migration — append a new one.**

### 5.2 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────┐
│  users                                              │
│  ─────────────────────────────────────────────────  │
│  id (uuid PK)           full_name (text)            │
│  email (text, unique)   role (ADMIN|STAFF)          │
│  password_hash (scrypt) enabled (bool, default true)│
│  created_at (timestamptz) updated_at (timestamptz)  │
└───────────────────────────┬─────────────────────────┘
                            │ 1
                            │ CASCADE DELETE
                            │ ∞
┌───────────────────────────▼─────────────────────────┐
│  refresh_tokens                                     │
│  ─────────────────────────────────────────────────  │
│  id (uuid PK)             user_id (uuid FK)         │
│  family_id (uuid)         token_hash (SHA-256, uniq)│
│  expires_at (timestamptz) revoked_at (timestamptz)  │
│  rotated_at (timestamptz) user_agent (text)         │
│  created_at (timestamptz)                           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  inquiries                                          │
│  ─────────────────────────────────────────────────  │
│  id (uuid PK)             kind (contact|partner|    │
│  status (new|in_progress|   support, default:contact│
│    resolved|spam)         name (text, 1–120 chars)  │
│  email (text, 3–255 chars) organization (text, opt) │
│  message (text, 1–3000)   version (int, opt.lock)   │
│  created_at / updated_at  updated_by (email, opt)   │
│  ── outbox columns ──────────────────────────────── │
│  notified_at (timestamptz) notify_attempts (int)    │
│  next_notify_at (timestamptz)                       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  rate_limits                                        │
│  ─────────────────────────────────────────────────  │
│  key (text PK)    count (int)   reset_at (tstz)     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  audit_log                                          │
│  ─────────────────────────────────────────────────  │
│  id (bigserial PK)    at (timestamptz)              │
│  actor_id (uuid)      actor_email (text)            │
│  action (text)        target_type / target_id       │
│  ip (text)            request_id (text)             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  schema_migrations                                  │
│  ─────────────────────────────────────────────────  │
│  id (text PK)         applied_at (timestamptz)      │
└─────────────────────────────────────────────────────┘
```

### 5.3 Database Indexes

| Table | Index | Purpose |
|---|---|---|
| `users` | `uq_users_email` (UNIQUE) | Fast login lookup |
| `refresh_tokens` | `uq_refresh_tokens_hash` (UNIQUE) | O(1) token verification |
| `refresh_tokens` | `idx_refresh_tokens_user` | List sessions by user |
| `refresh_tokens` | `idx_refresh_tokens_expires` | Cleanup expired tokens |
| `inquiries` | `idx_inquiries_status_created` | Admin inbox filtered by status |
| `inquiries` | `idx_inquiries_kind_created` | Admin inbox filtered by kind |
| `inquiries` | `idx_inquiries_created` | Default sort (newest first) |
| `inquiries` | `idx_inquiries_email_lower` | Search by email prefix |
| `inquiries` | `idx_inquiries_name_lower` | Search by name prefix |
| `inquiries` | `idx_inquiries_outbox` (partial) | Outbox: unnotified only |
| `rate_limits` | `idx_rate_limits_reset` | Cleanup expired windows |
| `audit_log` | `idx_audit_log_at` | Chronological audit trail |

### 5.4 CHECK Constraints (data integrity)

All validation rules are mirrored in both Zod (application layer) and PostgreSQL CHECK constraints (database layer):

```sql
users:      role IN ('ADMIN','STAFF')
            email = lower(email) AND length BETWEEN 3 AND 255
            length(full_name) BETWEEN 1 AND 120

inquiries:  kind IN ('contact','partner','support')
            status IN ('new','in_progress','resolved','spam')
            length(name) BETWEEN 1 AND 120
            length(email) BETWEEN 3 AND 255
            length(organization) <= 200 OR NULL
            length(message) BETWEEN 1 AND 3000
```

---

## 6. API Reference

**Base URL:** `/api/v1`
**Contract file:** `docs/openapi.yaml` (OpenAPI 3.0.3, enforced by CI lint test)

### 6.1 Response Envelope

Every response — success or failure — uses the same JSON envelope:

```json
// Success
{
  "success": true,
  "data": { ... },
  "requestId": "uuid",
  "timestamp": "ISO-8601"
}

// Failure
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable description",
    "details": [{ "field": "email", "message": "Invalid email" }]
  },
  "requestId": "uuid",
  "timestamp": "ISO-8601"
}
```

### 6.2 Endpoints

#### Public Endpoints (no auth required)

| Method | Path | Rate Limit | Description |
|---|---|---|---|
| `POST` | `/inquiries` | 5 req / 10 min per IP | Submit contact/partner/support form |
| `POST` | `/csp-report` | — | Log CSP policy violations |
| `GET` | `/healthz` | — | Liveness probe → `{ status: "ok" }` |
| `GET` | `/readyz` | — | Readiness probe (DB reachable + migrated) → `{ status: "ready" }` |
| `GET` | `/sitemap.xml` | — | XML sitemap (built from `PUBLIC_URL`) |
| `GET` | `/robots.txt` | — | Robots directive file |

#### Auth Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | None | Login → access token + httpOnly refresh cookie. Requires `X-Requested-With: XMLHttpRequest` header |
| `POST` | `/auth/refresh` | Cookie (`epam_rt`) | Rotate refresh token → new access token |
| `POST` | `/auth/logout` | Cookie | Revoke all sessions in token family, clear cookie |
| `GET` | `/auth/me` | Bearer JWT | Get current user object |

#### Admin Endpoints (STAFF or ADMIN role required)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/inquiries` | Bearer (STAFF/ADMIN) | Paginated inquiry list (summaries, no message body) |
| `GET` | `/admin/inquiries/{id}` | Bearer (STAFF/ADMIN) | Full inquiry including message |
| `PATCH` | `/admin/inquiries/{id}/status` | Bearer (STAFF/ADMIN) | Update status with optimistic locking (`version` field) |
| `DELETE` | `/admin/inquiries/{id}` | Bearer (**ADMIN only**) | Permanently delete, writes to audit log |

### 6.3 Query Parameters — `GET /admin/inquiries`

| Param | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `page` | integer | 0 | ≥ 0 | Zero-based page number |
| `size` | integer | 20 | 1–100 | Page size |
| `kind` | string | — | contact\|partner\|support | Filter by inquiry kind |
| `status` | string | — | new\|in_progress\|resolved\|spam | Filter by status |
| `q` | string | — | max 100 chars | Prefix match on name or email |
| `sort` | string | createdAt | createdAt, name, email, status, kind | Sort column |
| `direction` | string | desc | asc\|desc | Sort direction |

### 6.4 Inquiry Submission Schema

```typescript
{
  kind?: "contact" | "partner" | "support"   // default: "contact"
  name: string         // 1–120 characters, required
  email: string        // valid email, max 255, required
  organization?: string | null  // max 200 characters
  message: string      // 1–3000 characters, required
  website?: string     // ⚠️ HONEYPOT — bots fill this; non-empty → silent discard
}
```

### 6.5 Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Schema validation failed; `details` array has per-field errors |
| `MALFORMED_REQUEST` | 400 | JSON parse error or unknown fields present |
| `UNAUTHENTICATED` | 401 | Missing or expired token |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `INVALID_REFRESH_TOKEN` | 401 | Expired, revoked, or replayed token |
| `ACCESS_DENIED` | 403 | Authenticated but insufficient role |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Stale `version` on status update (concurrent edit) |
| `PAYLOAD_TOO_LARGE` | 413 | Request body exceeds 16 KB cap |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Non-JSON content type |
| `RATE_LIMITED` | 429 | Rate window exceeded; `Retry-After` header gives seconds |
| `ACCOUNT_LOCKED` | 429 | Too many failed login attempts for this (email, IP) pair |
| `SERVICE_UNAVAILABLE` | 503 | Database unreachable |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 7. Authentication & Security

### 7.1 Authentication Lifecycle

```
1. Login
   User POSTs email + password
   Server checks scrypt hash (also checks dummy hash for unknown emails to prevent timing attacks)
   → Returns: 15-min HS256 JWT (stored in browser memory only)
              7-day opaque refresh token (stored ONLY as SHA-256 hash in DB)
              HttpOnly; SameSite=Strict; Path=/api/v1/auth cookie

2. Authenticated Requests
   Client sends Bearer {accessToken} header
   Server validates JWT signature + expiry
   Server re-checks user record LIVE in database (disable takes effect immediately)

3. Token Refresh
   Client sends cookie (auto, via browser)
   Server verifies hash → rotates token (old one revoked, new one issued)
   10-second grace window for concurrent tab refreshes

4. Theft Detection
   If a rotated (already-replaced) token is replayed after the 10s grace window:
   → ALL sessions for that user are immediately revoked

5. Login Lockout
   Per (email, IP) pair: 5 failures / 15 minutes → that pair is locked
   Per email ceiling: 40 failures → slows distributed guessing
   Locking one IP never locks the legitimate user from other IPs
```

### 7.2 Security Controls Matrix

| Control | Implementation |
|---|---|
| **Password hashing** | scrypt (slow, memory-hard) |
| **Token storage** | Refresh token stored only as SHA-256 hash in DB |
| **CSRF prevention** | `X-Requested-With: XMLHttpRequest` required on all cookie endpoints |
| **Origin enforcement** | Every request checked; cross-origin writes refused (unless in `ALLOWED_ORIGINS`) |
| **SQL injection** | All queries parameterised; sort columns from whitelist only |
| **Input sanitisation** | NFC-normalized; control characters and bidi characters stripped |
| **Payload limit** | 16 KB hard cap on all request bodies |
| **Rate limiting** | PostgreSQL-backed fixed-window counters (no Redis needed) |
| **TLS** | Caddy auto-obtains Let's Encrypt certificates; enforces HTTPS; HSTS |
| **Container hardening** | `cap_drop: ALL`; read-only filesystem; non-root user (uid 10001); `no-new-privileges` |
| **Logging** | JSON logs per request; names, emails, messages, passwords, tokens are **never logged** |
| **Audit trail** | Every admin action recorded in `audit_log` (who, what, when, from where) |
| **CSP** | Report-Only (reports violations, doesn't block SSR hydration scripts); logged |
| **Email delivery** | Outbox pattern: visitor always gets 201; email retried up to 8 times with backoff |
| **Unknown fields** | JSON with extra fields is rejected (Zod `additionalProperties: false`) |

### 7.3 Client IP Resolution

`X-Forwarded-For` is trusted only for `TRUSTED_PROXY_HOPS` entries reading from the right-most value. Compose sets this to `1` (one Caddy hop). Clients cannot spoof their IP to bypass rate limits.

---

## 8. Environment Configuration

All environment variables are validated at startup by `src/server/env.server.ts` using Zod. Invalid or missing required values cause a clear error at boot — not a silent runtime failure.

### 8.1 Required Variables

| Variable | Example | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | `long_random_string` | PostgreSQL password |
| `DATABASE_URL` | `postgres://epam:password@db:5432/epam` | Full connection string |
| `JWT_SECRET` | `openssl rand -base64 48` | HS256 signing key (must decode to ≥32 bytes) |
| `SITE_ADDRESS` | `www.epam-example.org` | Caddy: domain for TLS certificate |
| `PUBLIC_URL` | `https://www.epam-example.org` | Base URL for sitemap, redirects |

### 8.2 Email Notification Variables (Strongly Recommended)

| Variable | Example | Description |
|---|---|---|
| `SMTP_URL` | `smtp://user:pass@mail.host:587` | SMTP connection (STARTTLS or smtps://) |
| `SMTP_FROM` | `"EPAM Website <noreply@domain.org>"` | From address in sent emails |
| `NOTIFY_TO` | `team@domain.org` | Recipient(s) for new inquiry notifications (CSV) |

### 8.3 Bootstrap Admin (One-Time Use)

> [!CAUTION]
> These are only used **once**, on first boot when the `users` table is empty. Remove them from `.env` immediately after first sign-in.

| Variable | Description |
|---|---|
| `BOOTSTRAP_ADMIN_EMAIL` | First admin account email |
| `BOOTSTRAP_ADMIN_PASSWORD` | First admin account password (min 12 chars) |
| `BOOTSTRAP_ADMIN_NAME` | Full name (default: "Administrator") |

### 8.4 Optional / Tuning Variables

| Variable | Default | Description |
|---|---|---|
| `COOKIE_SECURE` | `true` in prod | Set `false` for plain-HTTP local testing |
| `TRUSTED_PROXY_HOPS` | `0` (Compose sets `1`) | Reverse proxy count for IP resolution |
| `ALLOWED_ORIGINS` | _(empty)_ | Additional allowed CORS origins (dev only) |
| `DATABASE_POOL_MAX` | `10` | PostgreSQL connection pool size (1–50) |
| `ACCESS_TTL_SECONDS` | `900` | JWT access token TTL (15 minutes) |
| `REFRESH_TTL_SECONDS` | `604800` | Refresh token TTL (7 days) |
| `REFRESH_GRACE_SECONDS` | `10` | Grace window for concurrent tab refreshes |
| `RATE_INQUIRY_LIMIT` | `5` | Max inquiry submissions per window |
| `RATE_INQUIRY_WINDOW_SECONDS` | `600` | Rate limit window (10 minutes) |
| `RATE_AUTH_PER_MINUTE` | `10` | Max auth requests per minute |
| `RATE_API_PER_MINUTE` | `120` | Max general API requests per minute |
| `OUTBOX_INTERVAL_SECONDS` | `30` | Email outbox polling interval |

---

## 9. Local Development Setup

### 9.1 Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 22.x | Running scripts and production build |
| Bun | 1.x | Package manager and dev server |
| PostgreSQL | 16.x | Database (local or Docker) |
| Docker + Compose | — | Optional: full stack via Compose |

### 9.2 Step-by-Step Setup

```bash
# 1. Clone the repository
git clone <repo-url> && cd epam-website

# 2. Install dependencies
bun install --frozen-lockfile

# 3. Start PostgreSQL (choose one)
# Option A: Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16-alpine

# Option B: Local PostgreSQL install
# (create a database and user manually)

# 4. Configure environment
cp .env.example .env
# Edit .env with your values

# 5. Generate a JWT secret
openssl rand -base64 48

# 6. Start the development server
bun run dev
# → App available at http://localhost:3000
# → Admin at http://localhost:3000/admin/inquiries
```

### 9.3 Minimum `.env` for Local Dev

```bash
POSTGRES_PASSWORD=dev
DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres
JWT_SECRET=<output of: openssl rand -base64 48>
COOKIE_SECURE=false
BOOTSTRAP_ADMIN_EMAIL=you@example.org
BOOTSTRAP_ADMIN_PASSWORD=a-long-dev-passphrase
```

> The database schema is created automatically on first start.

### 9.4 Available NPM/Bun Scripts

| Command | What it Does |
|---|---|
| `bun run dev` | Start dev server with HMR (site + API on port 3000) |
| `bun run build` | Production build (Nitro node-server preset) |
| `bun run build:dev` | Development build (for debugging) |
| `bun run preview` | Preview the production build |
| `bun run lint` | Run ESLint |
| `bun run format` | Auto-format with Prettier |
| `bun run test` | Run all Vitest unit + integration tests |
| `bun run test:watch` | Run tests in watch mode |
| `bun run test:e2e` | Run the E2E HTTP test suite |
| `bunx tsc --noEmit` | Type-check without emitting files |

---

## 10. Testing Strategy

### 10.1 Test Coverage Map

| Level | Location | Runner | Count | Covers |
|---|---|---|---|---|
| **Unit** | `src/server/*.test.ts` | Vitest | ~29 tests | Config parsing, IP resolution, input sanitization, password hashing |
| **Unit** | `src/lib/api/http.test.ts` | Vitest | — | HTTP client token injection, error handling |
| **Integration (browser)** | `src/test/contact-flow.test.tsx` | Vitest + jsdom | ~5 tests | Full contact form render + API submission flow |
| **Integration (browser)** | `src/test/app-routing.test.tsx` | Vitest + jsdom | — | Page routing correctness |
| **Integration (browser)** | `src/test/contrast.test.ts` | Vitest | — | Color contrast accessibility checks |
| **API Contract** | `src/server/openapi.test.ts` | Vitest | — | Verifies `docs/openapi.yaml` matches live routes, enums, error codes |
| **End-to-End (server)** | `scripts/e2e.mjs` | Node.js | ~35 HTTP checks | Real PostgreSQL + real SMTP: auth, rate limits, RBAC, outbox, all API paths |

### 10.2 Running Tests

```bash
# All unit + integration tests
bun run test

# E2E (requires built server + live PostgreSQL)
NITRO_PRESET=node-server bun run build
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres node scripts/e2e.mjs
```

### 10.3 Quality Gates (must all pass before merge)

```bash
bunx prettier --check src scripts   # Formatting
bun run lint                         # ESLint
bunx tsc --noEmit                    # TypeScript type check
npx @redocly/cli lint docs/openapi.yaml  # OpenAPI spec lint
bun run test                         # All Vitest tests
NITRO_PRESET=node-server bun run build  # Production build succeeds
node scripts/e2e.mjs                 # E2E suite (35 HTTP checks)
bun audit --audit-level=high         # Dependency vulnerability scan
```

### 10.4 Known Testing Gap

> [!NOTE]
> Browser end-to-end tests (Playwright driving a real browser against staging) are not yet implemented. The recommended first test: open `/contact`, submit a form, verify the thank-you message appears and the email arrives in the inbox.

---

## 11. CI/CD Pipeline

### 11.1 CI Workflow (`ci.yml`)

Triggered on: **every push to `main`** and **every pull request**.

```
ci.yml
├── Job: check (Lint, types, tests, build, backend e2e)
│   ├── Setup: Bun + Node.js 22 + PostgreSQL 16 service container
│   ├── bun install --frozen-lockfile
│   ├── prettier --check
│   ├── bun run lint
│   ├── bunx tsc --noEmit
│   ├── @redocly/cli lint docs/openapi.yaml
│   ├── bash -n scripts/backup.sh && restore.sh  (syntax check only)
│   ├── bun run test
│   ├── NITRO_PRESET=node-server bun run build
│   └── node scripts/e2e.mjs (35 HTTP checks vs real PostgreSQL)
│
├── Job: audit (Dependency audit)
│   └── bun audit --audit-level=high
│       (GHSA-mrhx-c7xc-m3w5 excluded: documented zod 3 risk)
│
├── Job: image (Container image build and scan) [needs: check]
│   ├── docker/build-push-action (target: runtime)
│   └── aquasecurity/trivy-action (severity: HIGH,CRITICAL, exit on unfixed)
│
└── Job: codeql (Static analysis)
    └── github/codeql-action (javascript-typescript)
```

### 11.2 Deploy Workflow (`deploy.yml`)

Triggered: **manually via `workflow_dispatch`** (approval-gated via GitHub `production` environment).

```
deploy.yml
├── Input: Git ref (tag or commit SHA) to deploy
├── Configure SSH key from production secrets
├── SSH into production server:
│   ├── Save current HEAD to .previous-release
│   ├── git fetch --tags origin
│   ├── git checkout --detach <REF>
│   └── docker compose up -d --build --remove-orphans
├── Smoke test (30 attempts × 5s = 150s timeout):
│   └── curl /readyz → must return "ready"
├── On smoke test FAILURE:
│   └── Auto-rollback: checkout previous SHA + docker compose up
└── On success:
    └── Verify Strict-Transport-Security header present
```

### 11.3 Required GitHub Secrets (production environment)

| Secret | Description |
|---|---|
| `DEPLOY_HOST` | Production server IP or hostname |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_SSH_KEY` | SSH private key for deployment |
| `DEPLOY_PATH` | Absolute path of the app on the server |
| `SITE_URL` | Full production URL for smoke test |

### 11.4 Branch Protection Rules for `main`

Required CI checks before merge:
- `Lint, types, tests, build, backend e2e`
- `Dependency audit`
- `Container image build and scan`

Additional protections:
- Require 1 PR approval (dismiss stale approvals)
- Require branches to be up to date
- Block force pushes and deletions

---

## 12. Docker & Containerization

### 12.1 Multi-Stage Dockerfile

| Stage | Base | Purpose |
|---|---|---|
| `deps` | `oven/bun:1` | Install dependencies (cached until lockfile changes) |
| `build` | `deps` | Run production build (`NITRO_PRESET=node-server`) → `.output/server/index.mjs` |
| `tools` | `build` | Staff CLI + test utilities (not part of runtime image) |
| `runtime` | `node:22-alpine` | Minimal production image; runs as non-root uid 10001 |

### 12.2 Container Security Hardening

```yaml
# Applied to both app and caddy containers:
read_only: true             # Read-only root filesystem
tmpfs: ["/tmp"]             # Writable temp (app only)
cap_drop: [ALL]             # Drop all Linux capabilities
cap_add: [NET_BIND_SERVICE] # Caddy only: needed for ports 80/443
security_opt:
  - "no-new-privileges:true"
deploy:
  resources:
    limits: { memory: 512m } # app container memory cap
```

Non-root runtime user:
```dockerfile
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app -H -s /sbin/nologin app
USER 10001:10001
```

### 12.3 Health Check

```dockerfile
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz > /dev/null || exit 1
```

### 12.4 Compose Network Topology

Only **Caddy** is reachable from the internet (ports 80/443). `app` and `db` are on the internal Docker network only. The `app` service **waits for `db` to be healthy** before starting.

---

## 13. Production Deployment

### 13.1 Server Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Disk | 10 GB | 20 GB (SSD) |
| OS | Linux (any modern) | Ubuntu LTS / Debian |
| Required software | Docker + Compose | Docker + Compose |
| Network | Static IP | Static IP |
| Ports open | 22 (SSH), 80, 443 | 22 (restricted to your IP), 80, 443 |

### 13.2 First-Time Production Setup

```bash
# Step 1: DNS
# Point your domain's A/AAAA record to the server IP
# Open ports 80 and 443 in firewall

# Step 2: Clone & configure
git clone <repo> /srv/epam && cd /srv/epam
cp .env.example .env
nano .env  # Fill in ALL required values

# Step 3: Start the stack
docker compose up -d --build
docker compose logs -f app  # Watch for "backend ready"

# Step 4: Create admin account & secure
# Navigate to https://your-domain/admin/inquiries and log in
# THEN remove bootstrap vars from .env:
nano .env  # Delete BOOTSTRAP_ADMIN_* lines
docker compose up -d  # Apply

# Step 5: Verify
curl -fsS https://your-domain/readyz   # → {"status":"ready"}
curl -sI https://your-domain/ | grep -i strict-transport  # → HSTS header
# Submit 6 rapid inquiries; the 6th must return HTTP 429
```

### 13.3 Deploying Updates

**Manual:**
```bash
git pull && docker compose up -d --build
```

**Automated (via GitHub Actions):**
1. Push a tag or note the commit SHA
2. Go to GitHub → Actions → Deploy → Run workflow
3. Enter the git ref
4. GitHub requires production environment approval
5. Workflow deploys and smoke-tests; rolls back automatically on failure

---

## 14. Backup & Recovery

### 14.1 Backup Strategy

Backups are **AES-256 encrypted** and **self-verified** on every run (the script decrypts its own output and rejects empty or corrupted files).

```bash
# Manual backup
BACKUP_PASSPHRASE='long-secret-from-password-manager' ./scripts/backup.sh /srv/backups

# Automated daily backup (cron, 02:30 AM)
# Add to crontab:
30 2 * * * cd /srv/epam && BACKUP_PASSPHRASE=... ./scripts/backup.sh /srv/backups
```

### 14.2 Offsite Storage

After each backup run, copy files to a **separate provider or machine**. The backup script produces `.sql.gz.enc` files at `/srv/backups/epam-<date>.sql.gz.enc`.

### 14.3 Restore Procedure

> [!CAUTION]
> Restore overwrites live data. It prompts you to type `YES` before proceeding.

```bash
BACKUP_PASSPHRASE=... ./scripts/restore.sh /srv/backups/epam-<date>.sql.gz.enc
```

**Always test a restore in a staging environment before production.** The encryption and verification logic is covered by tests; the live `pg_dump`/`psql` calls need a staging run.

---

## 15. Monitoring & Alerting

### 15.1 Health Endpoints

| Endpoint | Returns | Checks |
|---|---|---|
| `/healthz` | `{ "status": "ok" }` | App process alive |
| `/readyz` | `{ "status": "ready" }` | App alive + DB reachable + migrations applied |

### 15.2 Recommended Alerts

| Alert | Condition | Severity |
|---|---|---|
| **Service down** | `/readyz` does not return `ready` within 30s | Critical |
| **Application error** | Log line contains `"level":"error"` | High |
| **Email delivery failure** | Log line contains `"msg":"notification failed"` with `attempts >= 8` | High (inquiry lost from email) |
| **High memory** | App container memory approaches 512 MB limit | Medium |
| **Disk space** | Server disk > 80% full | Medium |

### 15.3 Log Format

All request logs are single-line JSON. Fields included: timestamp, level, method, path, status, duration, requestId, IP. Fields **never logged**: names, emails, message bodies, passwords, tokens.

---

## 16. Developer Contribution Guide

### 16.1 Branch Naming

| Prefix | Example | Use For |
|---|---|---|
| `feat/` | `feat/add-newsletter-section` | New features |
| `fix/` | `fix/double-submit-contact-form` | Bug fixes |
| `docs/` | `docs/update-api-reference` | Documentation only |

### 16.2 Workflow

```
1. Create branch from main
   git checkout -b feat/my-feature

2. Develop with small, clear commits
   git commit -m "feat: add partner logos to homepage"

3. Run quality gates before pushing
   bun run lint && bunx tsc --noEmit && bun run test

4. For backend changes, also run E2E suite
   NITRO_PRESET=node-server bun run build && node scripts/e2e.mjs

5. Open Pull Request
   - Use the PR template
   - CI must be green
   - 1 reviewer approval required

6. Squash-merge into main
   main is ALWAYS deployable
```

### 16.3 Inviolable Rules

> [!CAUTION]
> Breaking these rules can corrupt production data or expose secrets.

1. **Never commit `.env`** — it is git-ignored and secret scanning is active
2. **Never edit applied migrations** — append a new migration instead
3. **Keep `docs/openapi.yaml` in sync** — a CI test enforces this; drift will fail the build
4. **Run lint + tests before every push** — `main` must always be deployable

### 16.4 Code Style

- **Formatter:** Prettier (config in `.prettierrc`) — run `bun run format`
- **Linter:** ESLint (config in `eslint.config.js`)
- **Type safety:** TypeScript strict mode; no `any` without justification
- **Server files:** Name convention `*.server.ts` for server-only code
- **Test files:** Co-located `*.test.ts` / `*.test.tsx` or in `src/test/`

---

## 17. Admin Operations

### 17.1 Staff Account Management

All staff account operations use the `tools` Docker Compose profile:

```bash
# List all users
docker compose --profile tools run --rm tools bun scripts/user.ts list

# Create a new staff member
docker compose --profile tools run --rm \
  -e USER_PASSWORD='a-secure-passphrase' tools \
  bun scripts/user.ts create --email staff@epam.org --name "Full Name" --role STAFF

# Create a new admin
docker compose --profile tools run --rm \
  -e USER_PASSWORD='a-secure-passphrase' tools \
  bun scripts/user.ts create --email admin@epam.org --name "Full Name" --role ADMIN

# Change a user's password
docker compose --profile tools run --rm \
  -e USER_PASSWORD='new-passphrase' tools \
  bun scripts/user.ts set-password --email staff@epam.org

# Disable a user (immediate effect — JWT is re-checked live on every request)
docker compose --profile tools run --rm tools \
  bun scripts/user.ts disable --email staff@epam.org

# Re-enable a user
docker compose --profile tools run --rm tools \
  bun scripts/user.ts enable --email staff@epam.org
```

### 17.2 Inquiry Status Workflow

Inquiries move through these statuses (managed in the admin dashboard at `/admin/inquiries`):

```
new ──► in_progress ──► resolved
 │                          │
 └──────────► spam ◄────────┘
```

> Status updates are **optimistic-locked** via the `version` field — if two staff members update the same inquiry simultaneously, the second update gets a `409 CONFLICT` response with a stale version error.

### 17.3 Roles and Permissions

| Action | STAFF | ADMIN |
|---|---|---|
| View inquiry list | ✅ | ✅ |
| View inquiry detail + message | ✅ | ✅ |
| Update inquiry status | ✅ | ✅ |
| Delete inquiry | ❌ | ✅ |
| Manage users | ❌ | ✅ (via CLI) |

---

## 18. Known Risks & Decisions

### 18.1 Accepted Technical Decisions

| Decision | Reason |
|---|---|
| **TanStack Start instead of Next.js** | Avoids a full routing/rendering rewrite; same user-visible result; migrate if the team standardises on Next.js as a planned initiative |
| **REST instead of GraphQL** | 9 endpoints, 1 client — GraphQL complexity is not justified |
| **PostgreSQL-backed rate limits** | Eliminates Redis dependency; sufficient for this scale |
| **No browser E2E (Playwright)** | Could not run in build environment (no browser); see Section 10.4 for suggested first test |
| **CSP in Report-Only mode** | SSR hydration scripts are inline; switch to Enforce after a week of clean reports, ideally with nonces |

### 18.2 Known Security Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Zod 3 advisory GHSA-mrhx-c7xc-m3w5** | Low | Affects oversized collection inputs only; no endpoint accepts arrays; body capped at 16 KB. Upgrade to Zod 4 when available. |
| **Database disk encryption** | Medium | Must be enabled at the hosting/volume level by the ops team; the application cannot provide this. |
| **Browser E2E not tested** | Low | Covered by HTTP-level e2e and unit tests; browser-specific JS bugs possible |

### 18.3 Pre-Launch Organizational Items (requires EPAM leadership)

- [ ] Replace ACSO registration number placeholder with actual number
- [ ] Replace placeholder phone number with real contact
- [ ] Replace "Statements will be published here" text with actual statements
- [ ] Add and verify the "Download PDF" document link
- [ ] Leadership review of all organizational claims on About and Impact pages
- [ ] Add a privacy notice near the contact form
- [ ] Determine inquiry data retention period
- [ ] Confirm compliance with Ethiopian data-protection law (consult counsel)

---

## 19. Pre-Launch Checklist

### 19.1 Technical Verification

```
[ ] CI pipeline is green (all 4 jobs pass)
[ ] docker compose up -d --build completes without error
[ ] curl https://your-domain/readyz returns {"status":"ready"}
[ ] Security headers present: Strict-Transport-Security, X-Frame-Options, Content-Security-Policy
[ ] Rate limit works: 6th rapid inquiry from same IP returns 429
[ ] Contact form submission: inquiry appears in admin inbox
[ ] Email notification arrives for new inquiry
[ ] Admin login works; session expires after 15 minutes; logout clears cookie
[ ] Automated daily backup cron is configured and tested
[ ] A test restore has been run on a staging environment
[ ] External uptime monitor is configured on /readyz
[ ] Lighthouse audit score reviewed; a11y findings addressed
[ ] axe accessibility scan run; contrast and keyboard findings fixed
```

### 19.2 Organizational Verification

```
[ ] All placeholder content replaced (phone, registration number, PDFs)
[ ] Leadership has reviewed About and Impact page claims
[ ] Privacy notice added near contact form
[ ] Data retention period documented and policy agreed
[ ] Security vulnerability report address (SECURITY.md) updated with real email
[ ] BOOTSTRAP_ADMIN_* removed from .env after first admin login
[ ] Staff accounts created for all team members
[ ] Team trained on admin dashboard usage
```

### 19.3 Operations Readiness

```
[ ] DNS A/AAAA records pointing to production server
[ ] Firewall: only ports 22, 80, 443 open (22 restricted to your IP)
[ ] Disk encryption enabled on server volume
[ ] Automatic OS security updates enabled
[ ] Provider snapshot schedule configured
[ ] Offsite backup copy destination configured and tested
[ ] On-call escalation path documented for outage response
```

---

*Document maintained by the Project Management Office. Update this document whenever the architecture, API, or operational procedures change. All sections have been verified against the actual codebase at the time of writing.*
