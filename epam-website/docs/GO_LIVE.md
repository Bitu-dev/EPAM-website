# Go-live runbook

## Before anything else (needs you)

- [x] Logo: `public/epma_logo.jpg` (320 px, 25 KB) is in place; the full-resolution original is kept in
      `docs/brand/epma_logo_original.jpg` for print use. To change the logo, replace `public/epma_logo.jpg`.
- [ ] Replace placeholder content: ACSO registration number, phone number, "Statements will be published here", the
      "Download PDF" link. Have leadership review the claims on About / Impact.
- [ ] Add a short privacy notice near the contact form and decide how long inquiries are kept. Check obligations
      under Ethiopian data-protection law with counsel.

## One-time server setup (any small VPS, Docker + Compose installed)

1. Point your domain's A/AAAA record at the server. Open ports 80 and 443.
2. `git clone <repo> /srv/epam && cd /srv/epam && cp .env.example .env` and fill in every value
   (`openssl rand -base64 48` for `JWT_SECRET`; set `SITE_ADDRESS`, `PUBLIC_URL`, SMTP settings, `NOTIFY_TO`,
   and `BOOTSTRAP_ADMIN_*`).
3. `docker compose up -d --build` then watch `docker compose logs -f app` for `backend ready`.
4. Sign in at `https://your-domain/admin/inquiries`, **then delete `BOOTSTRAP_ADMIN_*` from `.env`** and run
   `docker compose up -d`.
5. Send a test inquiry from the contact page: confirm the email arrives and the message is readable in the inbox.

## Verify

- `curl -fsS https://your-domain/readyz` → `{"status":"ready"}`
- `curl -sI https://your-domain/ | grep -i -E 'strict-transport|x-frame|content-security'`
- Submit 6 inquiries quickly from one network: the 6th must return 429.
- Run Lighthouse and an axe scan on a staging copy; fix contrast/keyboard findings (see review notes).

## Hosting requirements

- Linux VPS, 2 vCPU / 2 GB RAM / 20 GB disk is ample. Docker + Compose installed. Static IP.
- Pick the region closest to your readers (check latency from your main audience's networks before committing).
- Turn on **disk encryption** and **provider snapshots** when creating the server. Keep SSH key-only, firewall open
  only on 22 (restricted to your IP if possible), 80 and 443; enable automatic OS security updates.
- If you later use a managed PostgreSQL instead of the bundled container, set `DATABASE_URL` to the provider's URL
  ending in `?sslmode=require` and remove the `db` service from `docker-compose.yml`.

## Backups (do not skip)

Encrypted, verified on every run (it decrypts its own output and refuses to keep an empty or unreadable file):

```bash
BACKUP_PASSPHRASE='a long secret kept in your password manager' ./scripts/backup.sh /srv/backups
# cron, daily at 02:30:   30 2 * * * cd /srv/epam && BACKUP_PASSPHRASE=... ./scripts/backup.sh /srv/backups
```

Copy the files off the server (another provider or another machine). **Test a restore once** into a scratch
environment: `BACKUP_PASSPHRASE=... ./scripts/restore.sh /srv/backups/epam-<date>.sql.gz.enc` (it asks you to type
YES because it overwrites live data). The encryption and verification logic is tested; the live `pg_dump`/`psql`
calls need a staging run.

## Deploying updates

Manual: `git pull && docker compose up -d --build`. Automated: GitHub Actions → *Deploy* (needs the `production`
environment secrets listed in `.github/workflows/deploy.yml`); it smoke-tests `/readyz` and rolls back on failure.

## Monitoring

Add an external uptime check on `/readyz`, and alert on log lines with `"level":"error"` or
`"msg":"notification failed"` with `attempts` ≥ 8 (an inquiry whose email never went out).

## Not verified in the build environment

Docker image build, `docker compose up`, Caddy TLS issuance and the deploy workflow could not be run where this was
built (no Docker daemon, no internet to ACME). The application itself, built output and runtime-as-non-root were
verified. Do a staging run first.
