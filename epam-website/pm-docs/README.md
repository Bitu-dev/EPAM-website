# pm-docs — Project Management Documentation

This folder contains the **expert-level project management documentation** for the EPAM Website project.
It is **read-only reference material** — no source code, no configuration, no build artifacts.
Nothing in this folder affects the application, tests, or deployment.

---

## Contents

| File | Description |
|---|---|
| [`EPAM-PROJECT-DOCUMENTATION.md`](./EPAM-PROJECT-DOCUMENTATION.md) | Master reference document — all 19 sections below |

---

## Document Sections

| # | Section | What It Covers |
|---|---|---|
| 1 | Project Overview | Purpose, public pages, design principles |
| 2 | Technology Stack | Every library, version, and role (25+ technologies) |
| 3 | System Architecture | Topology diagram, Docker service map, request lifecycle |
| 4 | Directory Structure | Every folder and file with descriptions |
| 5 | Database Design | ER diagram, all 6 tables, indexes, CHECK constraints |
| 6 | API Reference | All 11 endpoints, schemas, query params, 14 error codes |
| 7 | Authentication & Security | Auth lifecycle, full security controls matrix |
| 8 | Environment Configuration | All env vars — required, optional, bootstrap, tuning |
| 9 | Local Development Setup | Prerequisites, step-by-step setup, all scripts |
| 10 | Testing Strategy | 6 test levels, counts, coverage, known gap |
| 11 | CI/CD Pipeline | Both `ci.yml` and `deploy.yml` fully documented |
| 12 | Docker & Containerization | Multi-stage build, hardening, health check, networking |
| 13 | Production Deployment | Server specs, first-time setup, update procedures |
| 14 | Backup & Recovery | Backup commands, cron schedule, restore procedure |
| 15 | Monitoring & Alerting | Health endpoints, 5 recommended alert rules, log format |
| 16 | Developer Contribution Guide | Branch naming, workflow, inviolable rules, code style |
| 17 | Admin Operations | User CLI commands, inquiry workflow, role permissions |
| 18 | Known Risks & Decisions | Technical decisions, security risks, organizational items |
| 19 | Pre-Launch Checklist | 30+ items: technical, organizational, operations readiness |

---

> This documentation was prepared by the Project Management Office and verified against the actual codebase.
> Update it whenever the architecture, API, or operational procedures change.
