# Contributing

## Workflow

1. Create a branch from `main`: `feat/short-name`, `fix/short-name`, `docs/short-name`.
2. Commit in small steps with clear messages (`fix: stop double submit on contact form`).
3. Open a pull request. The template lists what to check. CI must be green and one person must approve.
4. Squash-merge. `main` is always deployable.

Before pushing: `bun run lint && bunx tsc --noEmit && bun run test`. For backend changes also run the end-to-end suite
(see README).

## One-time GitHub setup (repository owner)

```bash
git init -b main && git add -A && git commit -m "Initial commit"
gh repo create your-org/epam-website --private --source=. --push      # or create it on github.com and `git remote add`
```

Then in **Settings → Branches → Add rule** for `main`:

- Require a pull request before merging (1 approval, dismiss stale approvals)
- Require status checks: `Lint, types, tests, build, backend e2e`, `Dependency audit`, `Container image build and scan`
- Require branches to be up to date; block force pushes and deletions

In **Settings → Environments** create `production` with required reviewers, and add its secrets (listed at the top of
`.github/workflows/deploy.yml`). In **Settings → Code security** enable Dependabot alerts, secret scanning and push
protection.

## Rules that protect the project

- Never commit `.env` or any secret (it is git-ignored; secret scanning is a second net).
- Never edit a database migration that has been applied; append a new one.
- Keep `docs/openapi.yaml` in step with the API; a test enforces it.
