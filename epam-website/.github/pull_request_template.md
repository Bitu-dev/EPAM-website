## What and why

<!-- One or two sentences. Link the issue if there is one. -->

## Checklist

- [ ] `bun run lint`, `bunx tsc --noEmit`, `bun run test` pass locally
- [ ] Backend changes: `NITRO_PRESET=node-server bun run build && node scripts/e2e.mjs` passes
- [ ] API changes: `docs/openapi.yaml` updated (the drift test fails otherwise)
- [ ] Database changes: a **new** migration appended (never edit an applied one)
- [ ] No secrets, personal data or `.env` files committed
- [ ] Visual changes: screenshots attached
