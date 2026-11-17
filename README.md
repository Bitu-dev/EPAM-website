[EPAM_README_SETUP.md](https://github.com/user-attachments/files/34979664/EPAM_README_SETUP.md)
# EPAM Website — Project Setup Guide

This guide explains how to install, configure, run, test, and build the EPAM website on Windows or other development machines.

## 1. Project overview

EPAM Website is a full-stack web application for the Ethiopian Peace Mothers Association.

The project uses:

- **Frontend:** React 19, TypeScript, Tailwind CSS 4
- **Web framework and routing:** TanStack Start
- **Backend:** TypeScript server code running on Node.js
- **API:** REST endpoints under `/api/v1`
- **Database:** PostgreSQL 16
- **Database access and migrations:** Drizzle ORM / Drizzle Kit
- **Authentication:** Short-lived JWT access tokens and rotating refresh tokens
- **Email notifications:** SMTP via Nodemailer
- **Production reverse proxy and HTTPS:** Caddy
- **Container deployment:** Docker Compose
- **Testing:** Vitest

The website and API are served by the same application process.

## 2. Important: open the correct project folder

The folder you open in VS Code must contain `package.json` and `bun.lock` directly.

For example:

```text
Downloads/
└── epam-website/
    ├── package.json
    ├── bun.lock
    ├── vite.config.ts
    ├── src/
    ├── public/
    └── ...
```

In VS Code:

1. Choose **File → Open Folder**.
2. Select the folder that contains `package.json`.
3. Open **Terminal → New Terminal**.
4. Run:

```powershell
dir
```

You should see `package.json` in the output. If you do not, you are in the wrong folder. Do not run `npm init` or create a replacement `package.json`.

To search below the current folder for the real project manifest:

```powershell
Get-ChildItem -Path . -Filter package.json -Recurse
```

If the result shows a nested folder, change into that folder. Example:

```powershell
cd .\epam-website
```

Use the actual folder name shown on your computer.

## 3. Requirements

Install these tools:

- **Git** (optional for downloading/cloning and version control)
- **Node.js 22** (the runtime used by the production container)
- **Bun** (recommended package manager; the repository includes `bun.lock`)
- **PostgreSQL 16**, or Docker Desktop to run PostgreSQL in a container

Check whether Node.js and npm are available:

```powershell
node --version
npm --version
```

Check Bun:

```powershell
bun --version
```

### Install Bun on Windows

Open PowerShell and run the official installer:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

When it finishes:

1. Close all VS Code windows.
2. Reopen VS Code and the project folder.
3. Open a new PowerShell terminal.
4. Check:

```powershell
bun --version
```

If the installer reports a network download failure, check your internet connection or network restrictions and retry. You can also install Bun using Windows Package Manager if `winget` is available:

```powershell
winget install --id Oven-sh.Bun -e
```

Restart the terminal after installation. If `bun` is still not recognized, verify that `%USERPROFILE%\.bun\bin` is in your Windows user `PATH`, then reopen the terminal.

## 4. Install project dependencies

First confirm that the terminal is in the folder containing `package.json`.

Recommended command:

```powershell
bun install --frozen-lockfile
```

If Bun cannot be installed on your machine but Node.js and npm are available, you can try:

```powershell
npm install
```

The repository's lockfile is `bun.lock`; npm installation does not use that Bun lockfile. Prefer Bun for reproducible installs.

## 5. Configure local environment variables

The server validates its configuration at startup. At minimum, local development needs a PostgreSQL connection string and a sufficiently strong base64 JWT secret.

Create a file named `.env` in the same folder as `package.json`. Do not commit this file or share its secrets.

Example for a local PostgreSQL database:

```env
NODE_ENV=development
DATABASE_URL=postgres://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/postgres
JWT_SECRET=REPLACE_WITH_A_BASE64_SECRET_OF_AT_LEAST_32_BYTES
COOKIE_SECURE=false
BOOTSTRAP_ADMIN_EMAIL=admin@example.org
BOOTSTRAP_ADMIN_PASSWORD=CHANGE_THIS_TO_A_LONG_PASSWORD
BOOTSTRAP_ADMIN_NAME=Administrator
```

Replace the example database password and admin credentials with your own values. The bootstrap admin password must be at least 12 characters. The bootstrap account is created only when the users table is empty.

Generate a JWT secret with OpenSSL, if installed:

```powershell
openssl rand -base64 48
```

Copy the generated value into `JWT_SECRET` in `.env`.

If OpenSSL is not installed, PowerShell can generate a base64 secret:

```powershell
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

### Start PostgreSQL with Docker (optional)

If Docker Desktop is installed and running, this command starts a local PostgreSQL 16 database:

```powershell
docker run --name epam-postgres -e POSTGRES_PASSWORD=YOUR_POSTGRES_PASSWORD -p 5432:5432 -d postgres:16-alpine
```

Use the same password in `DATABASE_URL`. If a container named `epam-postgres` already exists, do not create another with the same name; start the existing container:

```powershell
docker start epam-postgres
```

The project applies its database schema/migrations during server startup. Make sure PostgreSQL is running and the database URL is correct before starting the app.

## 6. Run the website in development

From the project root:

```powershell
bun run dev
```

Open the local address printed in the terminal. The repository README documents the local site and API at `http://localhost:3000`; use the actual address printed by your terminal if it differs.

Keep the terminal running while you use the website. To stop the development server, press `Ctrl + C`.

## 7. Useful project commands

Run these from the folder containing `package.json`:

| Command | Purpose |
|---|---|
| `bun install --frozen-lockfile` | Install the exact dependencies from the Bun lockfile |
| `bun run dev` | Start the development server |
| `bun run build` | Build the application |
| `bun run preview` | Preview a built application |
| `bun run lint` | Run ESLint |
| `bunx tsc --noEmit` | Check TypeScript types |
| `bun run test` | Run Vitest tests |
| `bun run test:watch` | Run tests in watch mode |

For the Node.js production server build used by the Dockerfile:

```powershell
$env:NITRO_PRESET = "node-server"
bun run build
```

## 8. Build for production

The project includes a `Dockerfile` and `docker-compose.yml`. The documented production stack is:

```text
Browser
  |
  | HTTPS
  v
Caddy (TLS / reverse proxy)
  |
  v
EPAM application (React SSR + REST API)
  |
  v
PostgreSQL
```

Before deployment:

1. Install Docker Engine and Docker Compose on the deployment machine.
2. Configure a domain and DNS records.
3. Copy `.env.example` to `.env`.
4. Set strong values for `POSTGRES_PASSWORD` and `JWT_SECRET`.
5. Set `SITE_ADDRESS`, `PUBLIC_URL`, SMTP settings, and bootstrap admin settings as appropriate.
6. Follow `docs/GO_LIVE.md`.

Production start command:

```bash
docker compose up -d --build
```

Do not use example passwords or placeholder domain names in production. Remove the `BOOTSTRAP_ADMIN_*` values after the first administrator account has been created and verified.

## 9. Project structure

```text
epam-website/
├── public/                  # Public files served by the website
├── src/
│   ├── components/          # Reusable React and UI components
│   ├── features/             # Feature-specific frontend logic
│   ├── hooks/                # React hooks
│   ├── integrations/         # External integrations (including Supabase-related code)
│   ├── routes/               # TanStack Start pages and API route handlers
│   ├── server/               # Server configuration, auth, database, API services
│   ├── assets/               # Imported assets
│   ├── router.tsx            # Router setup
│   └── styles.css            # Global styles
├── drizzle/                  # Database schema and migrations
├── docs/                     # Architecture, stack, API and deployment documentation
├── deploy/                   # Caddy configuration
├── scripts/                  # User, backup, restore and end-to-end utilities
├── supabase/                 # Supabase-related project configuration
├── Dockerfile                # Container build
├── docker-compose.yml        # Application, database and Caddy services
├── package.json              # Dependencies and npm/Bun scripts
├── bun.lock                  # Bun dependency lockfile
├── .env.example              # Environment variable template
└── README.md                 # Original project README
```

## 10. Troubleshooting

### `bun is not recognized`

Bun is not installed or its installation folder is not in Windows `PATH`.

- Install Bun using the instructions in section 3.
- Restart VS Code completely.
- Run `bun --version` in a new terminal.
- If needed, add `%USERPROFILE%\.bun\bin` to your user `PATH`.

### `npm error ENOENT ... package.json`

The terminal is not in the project root.

Run:

```powershell
dir
```

If `package.json` is not listed, locate it:

```powershell
Get-ChildItem -Path . -Filter package.json -Recurse
```

Then use `cd` to enter the folder that contains it. Do not create a new package file.

### Database connection error

- Confirm PostgreSQL is running.
- Check the username, password, host, port and database name in `DATABASE_URL`.
- Confirm that port `5432` is available.
- Restart the development server after changing `.env`.

### Missing or invalid JWT secret

Set `JWT_SECRET` to a base64-encoded value that decodes to at least 32 bytes. Restart the server after updating `.env`.

### Dependency download fails

Check your internet connection, proxy, firewall or network restrictions. Retry the install after connectivity is restored.

## 11. Security reminders

- Never commit `.env`, database passwords, JWT secrets, SMTP credentials or real admin passwords.
- Use HTTPS in production.
- Use strong, unique passwords.
- Remove bootstrap administrator credentials after initial setup.
- Keep PostgreSQL backups secure and test restoration.
- Do not edit a database migration that has already been applied; add a new migration instead.

## 12. More project documentation

The repository already includes detailed documentation:

- `docs/ARCHITECTURE.md` — application architecture, API, data model and security decisions.
- `docs/STACK.md` — technology choices and implementation mapping.
- `docs/GO_LIVE.md` — production deployment and operational checklist.
- `docs/openapi.yaml` — API contract.
- `CONTRIBUTING.md` — development workflow.
- `SECURITY.md` — security reporting information.

---

**Important:** This guide documents the project files and configuration found in the supplied EPAM Website archive. Successful installation and startup still depend on your computer having the required tools, a reachable PostgreSQL database, valid environment variables and network access to download dependencies.
