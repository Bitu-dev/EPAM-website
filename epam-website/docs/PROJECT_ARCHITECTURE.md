# EPAM Website — Project Architecture

This is an additional architecture overview for project stakeholders. It supplements (and does not replace) `docs/ARCHITECTURE.md`.

## 1. System context

```mermaid
flowchart LR
    Visitor[Public visitor / browser] -->|HTTPS| Edge[Caddy reverse proxy]
    Staff[EPMA staff / browser] -->|HTTPS| Edge
    Edge -->|HTTP inside deployment network| WebApp[EPAM application\nReact SSR + TypeScript API]
    WebApp -->|SQL| DB[(PostgreSQL 16)]
    WebApp -->|SMTP| Mail[Email service]
```

The application is a single deployable web service. The public website and REST API share the same origin and server process. Caddy is the public-facing reverse proxy; PostgreSQL is not exposed as a public service in the provided Compose configuration.

## 2. Application layers

```mermaid
flowchart TB
    subgraph Client[Browser / presentation layer]
      Pages[Page routes\nHome, About, Impact, Media, Partners, Contact]
      AdminUI[Staff inquiry dashboard]
      Shared[Site layout + shared UI components]
      Pages --> Shared
      AdminUI --> Shared
    end
    subgraph Server[Application / server layer]
      RouteAdapters[TanStack route adapters\nsrc/routes/api.v1.*]
      Services[Server services\nauth, inquiries, handlers, tokens]
      Infra[Infrastructure\nHTTP, env, DB, migrations, rate limits, notifier]
      RouteAdapters --> Services --> Infra
    end
    subgraph Data[Persistence layer]
      PostgreSQL[(PostgreSQL)]
      Schema[Drizzle schema + migrations]
      PostgreSQL --- Schema
    end
    Pages --> RouteAdapters
    AdminUI --> RouteAdapters
    Infra --> PostgreSQL
```

### Presentation layer

- `src/routes/*.tsx` contains the page-level React route components.
- `src/components/SiteLayout.tsx` provides the shared site layout.
- `src/components/ui/` contains reusable interface primitives.
- `src/styles.css` contains global styling.

### Server / application layer

- `src/routes/api.v1.*.ts` exposes HTTP endpoints and delegates work to server modules.
- `src/server/auth.server.ts`, `tokens.server.ts` and `password.server.ts` implement authentication-related behavior.
- `src/server/inquiries.server.ts` contains inquiry operations.
- `src/server/handlers.server.ts` and `api.server.ts` coordinate request handling and API behavior.
- `src/server/http.server.ts`, `env.server.ts`, `ratelimit.server.ts` and `security-headers.server.ts` provide supporting server infrastructure.
- `src/server/notifier.server.ts` handles notification delivery.

### Data layer

- PostgreSQL stores application records.
- `src/server/migrations.server.ts` contains the migration mechanism used by the running application.
- `drizzle/schema.ts` and `drizzle/migrations/` provide the Drizzle schema and migration artifacts in the repository.
- Use new forward-only migrations for future schema changes.

## 3. Main request flows

### Public inquiry

```mermaid
sequenceDiagram
    participant V as Visitor
    participant UI as Contact page
    participant API as POST /api/v1/inquiries
    participant S as Inquiry service
    participant DB as PostgreSQL
    participant SMTP as SMTP service
    V->>UI: Complete and submit form
    UI->>API: Send inquiry payload
    API->>S: Validate and process request
    S->>DB: Apply rate limit and save inquiry/outbox data
    DB-->>S: Persisted inquiry
    S-->>UI: Success response
    Note over S,SMTP: Notification delivery is handled through the outbox/retry mechanism
    S->>SMTP: Send notification when due
```

### Staff authentication and inquiry management

```mermaid
flowchart TD
    Login[Staff submits login] --> Verify[Verify credentials]
    Verify -->|Valid| Tokens[Issue short-lived access token\nand refresh cookie]
    Verify -->|Invalid| Deny[Return authentication error]
    Tokens --> Admin[Open protected inquiry dashboard]
    Admin --> Authz[Validate session, user status and role]
    Authz -->|Authorized| Actions[List / view / update inquiries]
    Authz -->|Not authorized| Deny
    Actions --> Audit[Record audited changes where applicable]
```

## 4. API surface

The API is versioned under `/api/v1` and is implemented as TanStack Start server routes. The principal endpoint groups are:

| Group | Endpoints / purpose |
|---|---|
| Public inquiries | `POST /api/v1/inquiries` |
| Authentication | `POST /api/v1/auth/login`, `/refresh`, `/logout`; `GET /api/v1/auth/me` |
| Admin inquiries | `GET /api/v1/admin/inquiries`, `GET /api/v1/admin/inquiries/{id}`, `PATCH /api/v1/admin/inquiries/{id}/status`, `DELETE /api/v1/admin/inquiries/{id}` |
| Operational | `/healthz`, `/readyz`, `/api/v1/csp-report` |
| SEO | `/sitemap.xml`, `/robots.txt` |

For request/response details and the canonical endpoint contract, use `docs/openapi.yaml` and `docs/ARCHITECTURE.md`.

## 5. Security and operational boundaries

- Caddy is the public edge and terminates HTTPS in the supplied deployment design.
- The application and database communicate on the private Compose network.
- Secrets are supplied through environment variables; `.env` must remain untracked.
- The backend validates incoming data and uses parameterized database operations.
- Authentication uses an access token and a rotating refresh-token cookie; authorization is enforced on protected staff routes.
- Rate limiting, audit logging, security headers and readiness/health endpoints are part of the server implementation.
- Inquiry notification uses an outbox/retry approach so email delivery is separate from the visitor's form submission response.

Refer to the original architecture document for the detailed token lifecycle, exact cookie settings, rate-limit policy, error codes and accepted security trade-offs.

## 6. Deployment topology

```mermaid
flowchart TB
    Internet((Internet)) --> Caddy[Caddy container\nports 80 / 443]
    subgraph Compose[Docker Compose private network]
      Caddy --> App[Application container\nNode.js 22 / port 3000]
      App --> DB[(PostgreSQL 16 container)]
      App --> SMTP[External SMTP provider]
    end
    DB --- Volume[(Persistent PostgreSQL volume)]
```

The repository includes `Dockerfile`, `docker-compose.yml` and `deploy/Caddyfile`. The intended production deployment runs the app, PostgreSQL and Caddy with persistent database storage. SMTP is an external service configured by environment variables.

## 7. Key quality gates

1. `bun run lint`
2. `bun run test`
3. `bun run build`
4. Run the documented server end-to-end checks against a test PostgreSQL database and SMTP sink.
5. Validate the deployed `/readyz` endpoint, TLS headers, inquiry submission, admin access and email notification in staging.

The build and test commands are defined in `package.json`. Deployment readiness and remaining launch tasks are documented in `docs/GO_LIVE.md`.
