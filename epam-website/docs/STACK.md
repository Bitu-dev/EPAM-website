# Technology stack: requirement → what this project does

| Layer | Requirement | In this project | Status |
|---|---|---|---|
| Frontend | HTML, CSS, JavaScript, React, Next.js | React 19 + TypeScript + Tailwind CSS 4 on **TanStack Start** (server-rendered React framework, the same role Next.js plays). Semantic HTML pages in `src/routes/`. | ✅ React. **Not Next.js**, see note 1 |
| Backend | Node.js, Django, Laravel or Dart Frog | **Node.js 22** (TypeScript) in `src/server/`, served by the same process as the site | ✅ |
| Database | PostgreSQL or MySQL | **PostgreSQL 16**; forward-only migrations in `src/server/migrations.server.ts`; CHECK constraints mirror input validation | ✅ |
| API | REST or GraphQL | **REST**, JSON, uniform envelope. Specified in `docs/openapi.yaml` (lint-clean; a test fails if it drifts from the code) | ✅ REST. GraphQL not needed, note 2 |
| Authentication | Secure sessions or JWT | **Both**: 15-min JWT access token (memory only) + rotating refresh token in an httpOnly, SameSite=Strict cookie; theft detection; per-(email, IP) lockout; roles ADMIN/STAFF | ✅ |
| Security: HTTPS | HTTPS | Caddy terminates TLS with automatic Let's Encrypt certificates; HSTS; HTTP→HTTPS redirect | ⚠️ configured, not run here |
| Security: validation | validation | zod on every request (server) and in the form (client); unknown fields rejected; control/bidi characters stripped; size caps; parameterised SQL | ✅ tested |
| Security: encryption | encryption | Passwords: scrypt. Refresh tokens: stored only as SHA-256 hashes. Backups: AES-256 (`scripts/backup.sh`, verified on every run). In transit: TLS to browsers; add `?sslmode=require` to `DATABASE_URL` if the database is on another host | ✅ / see note 3 |
| Hosting | Reliable cloud hosting | Any Linux VPS with Docker (`docker-compose.yml`). See `docs/GO_LIVE.md` for sizing and region | ⚠️ not deployed |
| Version control | Git and GitHub | PR + issue templates, CODEOWNERS, CONTRIBUTING (branching, protection rules), Dependabot, CI and deploy workflows, `.gitattributes`, `SECURITY.md` | ✅ files ready; owner creates the repo (see `CONTRIBUTING.md`) |
| Testing | Unit, integration, end-to-end | **Unit** (29 tests, Vitest): config, IP handling, sanitising, hashing, API client, spec drift. **Integration**: contact-form flow in jsdom (5 tests) and **33 HTTP checks** against real PostgreSQL + SMTP (`scripts/e2e.mjs`). **End-to-end**: backend yes; browser E2E not yet, note 4 | ✅ / see note 4 |

## Notes

1. **Why not Next.js.** The site is already React and server-rendered. Moving to Next.js would mean rewriting the routing
   and rendering layer and re-testing every page for no user-visible benefit, and it risks the visual design you asked
   me not to change. If your team standardises on Next.js, do that as a separate, planned migration.
2. **GraphQL** solves problems of many clients with varying data needs. This API has 9 endpoints and one client.
3. **Encryption at rest of the database disk** is a hosting-level setting (full-disk/volume encryption at your
   provider); the application cannot provide it. Turn it on when you create the server or volume.
4. **Browser end-to-end tests** (Playwright driving a real browser against staging) are the one gap. They could not
   be run where this was built (no browser available). Suggested first test: open `/contact`, submit, expect the
   thank-you message and an email in the inbox.
