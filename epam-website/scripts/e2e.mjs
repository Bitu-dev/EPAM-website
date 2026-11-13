// End-to-end backend test: boots the BUILT server (.output) against a real PostgreSQL and a real SMTP sink,
// then exercises every endpoint over HTTP. Usage: DATABASE_ADMIN_URL=postgres://u:p@host:5432/postgres node scripts/e2e.mjs
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";
import { SMTPServer } from "smtp-server";
import { hashPassword } from "../src/server/password.server.ts";
import * as fe from "../src/lib/api/types.ts";

const ADMIN_URL = process.env.DATABASE_ADMIN_URL ?? "postgres://postgres@127.0.0.1:54329/postgres";
const PORT = 3100 + Math.floor(Math.random() * 500);
const SMTP_PORT = PORT + 1000;
const BASE = `http://127.0.0.1:${PORT}`;
const dbName = `epam_e2e_${randomBytes(4).toString("hex")}`;
const dbUrl = ADMIN_URL.replace(/\/[^/]*$/, `/${dbName}`);

let passed = 0;
const results = [];
async function t(name, fn) {
  try {
    await fn();
    passed++;
    results.push(`  ok   ${name}`);
  } catch (e) {
    results.push(`  FAIL ${name}\n       ${String(e.message).split("\n").join("\n       ")}`);
    failed.push(name);
  }
}
const failed = [];

// ---- helpers
let ipCounter = 0;
const freshIp = () =>
  `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter++ & 255}`;
async function call(
  method,
  path,
  { body, token, ip = freshIp(), headers = {}, cookie, raw, json = true } = {},
) {
  const h = { "x-forwarded-for": ip, ...headers };
  if (body !== undefined && json) h["content-type"] = "application/json";
  if (token) h.authorization = `Bearer ${token}`;
  if (cookie) h.cookie = cookie;
  const res = await fetch(BASE + path, {
    method,
    headers: h,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    redirect: "manual",
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  return { status: res.status, headers: res.headers, data, text };
}
const AUTHH = { "x-requested-with": "XMLHttpRequest" };
const cookieOf = (res) =>
  (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("epam_rt="));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- infrastructure
const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
await admin.unsafe(`CREATE DATABASE ${dbName}`);
const db = postgres(dbUrl, { max: 2, onnotice: () => {} });

const mails = [];
const makeSmtp = () =>
  new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    secure: false,
    onData(stream, _s, cb) {
      const chunks = [];
      stream.on("data", (c) => chunks.push(c));
      stream.on("end", () => {
        mails.push(Buffer.concat(chunks).toString("utf8"));
        cb();
      });
    },
  });
let smtp = makeSmtp();
const startSmtp = () =>
  new Promise((r) => {
    smtp = makeSmtp();
    smtp.listen(SMTP_PORT, "127.0.0.1", r);
  });
await startSmtp();

const ADMIN_PW = "Correct-Horse-Battery-9";
const server = spawn("node", [".output/server/index.mjs"], {
  env: {
    PATH: process.env.PATH,
    PORT: String(PORT),
    HOST: "127.0.0.1",
    NODE_ENV: "production",
    DATABASE_URL: dbUrl,
    JWT_SECRET: randomBytes(48).toString("base64"),
    COOKIE_SECURE: "false",
    TRUSTED_PROXY_HOPS: "1",
    PUBLIC_URL: "https://www.example.org",
    SMTP_URL: `smtp://127.0.0.1:${SMTP_PORT}`,
    SMTP_FROM: "Website <noreply@example.org>",
    NOTIFY_TO: "team@example.org",
    BOOTSTRAP_ADMIN_EMAIL: "Admin@Example.org",
    BOOTSTRAP_ADMIN_PASSWORD: ADMIN_PW,
    BOOTSTRAP_ADMIN_NAME: "Root Admin",
    REFRESH_GRACE_SECONDS: "2",
    OUTBOX_INTERVAL_SECONDS: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

async function cleanup() {
  server.kill("SIGTERM");
  await sleep(300);
  await new Promise((r) => smtp.close(r));
  await db.end({ timeout: 2 });
  await admin.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.end({ timeout: 2 });
}

try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE + "/readyz")).status === 200) break;
    } catch {}
    await sleep(200);
    if (i === 99) throw new Error("server never became ready\n" + serverLog);
  }

  await t("healthz and readyz", async () => {
    assert.equal((await call("GET", "/healthz")).status, 200);
    const r = await call("GET", "/readyz");
    assert.equal(r.status, 200);
    assert.equal(r.data.status, "ready");
  });

  await t(
    "migrations applied and bootstrap admin seeded (email normalised, password hashed)",
    async () => {
      const [m] = await db`SELECT count(*)::int n FROM schema_migrations`;
      assert.equal(m.n, 1);
      const [u] = await db`SELECT email, role, password_hash FROM users`;
      assert.equal(u.email, "admin@example.org");
      assert.equal(u.role, "ADMIN");
      assert.ok(u.password_hash.startsWith("scrypt$"));
      assert.ok(!u.password_hash.includes(ADMIN_PW));
    },
  );

  await t("security headers on SSR pages (+HSTS only over https)", async () => {
    const r = await fetch(BASE + "/", { headers: { "x-forwarded-proto": "https" } });
    assert.equal(r.status, 200);
    for (const h of [
      "x-content-type-options",
      "x-frame-options",
      "referrer-policy",
      "permissions-policy",
      "content-security-policy-report-only",
      "strict-transport-security",
      "cross-origin-opener-policy",
    ])
      assert.ok(r.headers.get(h), `missing ${h}`);
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    const plain = await fetch(BASE + "/about");
    assert.equal(plain.headers.get("strict-transport-security"), null);
    const adm = await fetch(BASE + "/admin/inquiries");
    assert.match(adm.headers.get("x-robots-tag") ?? "", /noindex/);
  });

  await t("sitemap.xml and robots.txt use PUBLIC_URL", async () => {
    const s = await (await fetch(BASE + "/sitemap.xml")).text();
    assert.match(s, /<loc>https:\/\/www\.example\.org\/about<\/loc>/);
    const r = await (await fetch(BASE + "/robots.txt")).text();
    assert.match(r, /Sitemap: https:\/\/www\.example\.org\/sitemap\.xml/);
    assert.match(r, /Disallow: \/admin/);
  });

  // ---------- public inquiry ----------
  const valid = {
    kind: "partner",
    name: "  Selam   Bekele ",
    email: "Selam@Example.COM",
    organization: "Peace Org",
    message: "Hello\r\nwe want to partner.\u0000",
  };
  let firstId;
  await t("POST /inquiries creates a record, sanitises input, returns envelope", async () => {
    const r = await call("POST", "/api/v1/inquiries", { body: valid });
    assert.equal(r.status, 201);
    assert.equal(r.data.success, true);
    assert.match(r.data.data.id, /^[0-9a-f-]{36}$/);
    assert.ok(r.data.requestId);
    assert.equal(r.headers.get("cache-control"), "no-store");
    firstId = r.data.data.id;
    const [row] = await db`SELECT * FROM inquiries WHERE id = ${firstId}`;
    assert.equal(row.name, "Selam Bekele");
    assert.equal(row.email, "selam@example.com");
    assert.equal(row.message, "Hello\nwe want to partner.");
    assert.equal(row.kind, "partner");
  });

  await t("notification email is delivered with Reply-To and message body", async () => {
    for (let i = 0; i < 40 && mails.length === 0; i++) await sleep(250);
    assert.equal(mails.length, 1, "no email received");
    assert.match(mails[0], /Reply-To: selam@example\.com/i);
    assert.match(mails[0], /we want to partner/);
    assert.match(mails[0], /To: team@example\.org/i);
    const [row] = await db`SELECT notified_at FROM inquiries WHERE id = ${firstId}`;
    assert.ok(row.notified_at);
  });

  await t(
    "validation: bad email, empty name, long message, unknown field, wrong kind -> 400 with field details",
    async () => {
      for (const bad of [
        { ...valid, email: "nope" },
        { ...valid, name: "   " },
        { ...valid, message: "x".repeat(3001) },
        { ...valid, extra: 1 },
        { ...valid, kind: "admin" },
        { ...valid, message: "" },
      ]) {
        const r = await call("POST", "/api/v1/inquiries", { body: bad });
        assert.equal(r.status, 400, JSON.stringify(bad).slice(0, 80));
        assert.equal(r.data.error.code, "VALIDATION_FAILED");
        assert.ok(Array.isArray(r.data.error.details) && r.data.error.details.length > 0);
      }
    },
  );

  await t(
    "transport errors: wrong content-type 415, bad JSON 400, oversized body 413",
    async () => {
      assert.equal(
        (
          await call("POST", "/api/v1/inquiries", {
            raw: "a=b",
            headers: { "content-type": "application/x-www-form-urlencoded" },
          })
        ).status,
        415,
      );
      assert.equal(
        (
          await call("POST", "/api/v1/inquiries", {
            raw: "{nope",
            headers: { "content-type": "application/json" },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call("POST", "/api/v1/inquiries", {
            raw: JSON.stringify({ message: "x".repeat(40000) }),
            headers: { "content-type": "application/json" },
          })
        ).status,
        413,
      );
    },
  );

  await t("honeypot: bots get a normal-looking 201 but nothing is stored or emailed", async () => {
    const before = (await db`SELECT count(*)::int n FROM inquiries`)[0].n;
    const mailsBefore = mails.length;
    const r = await call("POST", "/api/v1/inquiries", {
      body: { ...valid, website: "http://spam.example" },
    });
    assert.equal(r.status, 201);
    await sleep(1500);
    assert.equal((await db`SELECT count(*)::int n FROM inquiries`)[0].n, before);
    assert.equal(mails.length, mailsBefore);
  });

  await t("cross-origin POST from an unlisted origin is refused (403)", async () => {
    const r = await call("POST", "/api/v1/inquiries", {
      body: valid,
      headers: { origin: "https://evil.example" },
    });
    assert.equal(r.status, 403);
    const same = await call("POST", "/api/v1/inquiries", {
      body: valid,
      headers: { origin: BASE },
    });
    assert.equal(same.status, 201);
  });

  await t(
    "rate limit: 6th inquiry from one client is 429 with Retry-After; others unaffected; spoofed XFF prefix does not evade",
    async () => {
      const A = "203.0.113.50";
      for (let i = 0; i < 5; i++)
        assert.equal(
          (await call("POST", "/api/v1/inquiries", { body: valid, ip: A })).status,
          201,
          `req ${i + 1}`,
        );
      const blocked = await call("POST", "/api/v1/inquiries", { body: valid, ip: A });
      assert.equal(blocked.status, 429);
      assert.equal(blocked.data.error.code, "RATE_LIMITED");
      assert.ok(Number(blocked.headers.get("retry-after")) > 0);
      const spoof = await call("POST", "/api/v1/inquiries", {
        body: valid,
        ip: `9.9.9.9, 8.8.8.8, ${A}`,
      });
      assert.equal(spoof.status, 429, "left-side spoofing must not help");
      assert.equal(
        (await call("POST", "/api/v1/inquiries", { body: valid, ip: "203.0.113.51" })).status,
        201,
      );
    },
  );

  await t(
    "20 concurrent submissions from different clients all succeed (no lost writes)",
    async () => {
      const before = (await db`SELECT count(*)::int n FROM inquiries`)[0].n;
      const rs = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          call("POST", "/api/v1/inquiries", { body: { ...valid, name: `Load ${i}` } }),
        ),
      );
      assert.ok(rs.every((r) => r.status === 201));
      assert.equal((await db`SELECT count(*)::int n FROM inquiries`)[0].n, before + 20);
    },
  );

  // ---------- auth ----------
  let access, cookie;
  await t("login: wrong password and unknown user give the same generic 401", async () => {
    const a = await call("POST", "/api/v1/auth/login", {
      body: { email: "admin@example.org", password: "wrong-wrong-wrong" },
      headers: AUTHH,
    });
    const b = await call("POST", "/api/v1/auth/login", {
      body: { email: "ghost@example.org", password: "wrong-wrong-wrong" },
      headers: AUTHH,
    });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.deepEqual(a.data.error, b.data.error);
    assert.equal(a.data.error.code, "INVALID_CREDENTIALS");
  });

  await t("login requires X-Requested-With (CSRF guard)", async () => {
    assert.equal(
      (
        await call("POST", "/api/v1/auth/login", {
          body: { email: "admin@example.org", password: ADMIN_PW },
        })
      ).status,
      403,
    );
  });

  await t(
    "login succeeds (case-insensitive email): bearer token + hardened refresh cookie",
    async () => {
      const r = await call("POST", "/api/v1/auth/login", {
        body: { email: "ADMIN@example.org", password: ADMIN_PW },
        headers: AUTHH,
      });
      assert.equal(r.status, 200);
      const d = r.data.data;
      assert.equal(d.tokenType, "Bearer");
      assert.equal(d.expiresIn, 900);
      assert.equal(d.user.role, "ADMIN");
      assert.ok(!("refreshToken" in d) && !("password_hash" in d));
      const sc = r.headers.getSetCookie().find((c) => c.startsWith("epam_rt="));
      assert.match(sc, /HttpOnly/);
      assert.match(sc, /SameSite=Strict/);
      assert.match(sc, /Path=\/api\/v1\/auth/);
      access = d.accessToken;
      cookie = cookieOf(r);
      const [row] = await db`SELECT token_hash FROM refresh_tokens`;
      assert.ok(
        !cookie.includes(row.token_hash) && row.token_hash.length === 64,
        "only a hash is stored",
      );
    },
  );

  await t(
    "GET /auth/me: valid token ok; missing, tampered and alg=none tokens rejected",
    async () => {
      assert.equal(
        (await call("GET", "/api/v1/auth/me", { token: access })).data.data.email,
        "admin@example.org",
      );
      assert.equal((await call("GET", "/api/v1/auth/me")).status, 401);
      const tampered = access.slice(0, -3) + (access.endsWith("AAA") ? "BBB" : "AAA");
      assert.equal((await call("GET", "/api/v1/auth/me", { token: tampered })).status, 401);
      const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
      const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "x", role: "ADMIN", iss: "epam-website", exp: 9999999999 })}.`;
      assert.equal((await call("GET", "/api/v1/auth/me", { token: none })).status, 401);
    },
  );

  await t(
    "lockout is per (email, IP): attacker is locked, the real admin on another IP is not",
    async () => {
      const attacker = "198.51.100.7";
      for (let i = 0; i < 5; i++)
        assert.equal(
          (
            await call("POST", "/api/v1/auth/login", {
              body: { email: "admin@example.org", password: "bad-bad-bad-bad" },
              headers: AUTHH,
              ip: attacker,
            })
          ).status,
          401,
        );
      const locked = await call("POST", "/api/v1/auth/login", {
        body: { email: "admin@example.org", password: ADMIN_PW },
        headers: AUTHH,
        ip: attacker,
      });
      assert.equal(locked.status, 429);
      assert.equal(locked.data.error.code, "ACCOUNT_LOCKED");
      assert.ok(locked.headers.get("retry-after"));
      const real = await call("POST", "/api/v1/auth/login", {
        body: { email: "admin@example.org", password: ADMIN_PW },
        headers: AUTHH,
        ip: "198.51.100.99",
      });
      assert.equal(real.status, 200);
    },
  );

  await t(
    "refresh rotates the token; a replay inside the grace window is tolerated (two tabs)",
    async () => {
      const r1 = await call("POST", "/api/v1/auth/refresh", { headers: AUTHH, cookie });
      assert.equal(r1.status, 200);
      const c2 = cookieOf(r1);
      assert.notEqual(c2, cookie);
      const again = await call("POST", "/api/v1/auth/refresh", { headers: AUTHH, cookie }); // old token, within 2s
      assert.equal(again.status, 200);
      cookie = cookieOf(again);
      access = again.data.data.accessToken;
    },
  );

  await t(
    "refresh-token replay after the grace window is treated as theft: all sessions revoked",
    async () => {
      const stolen = cookie;
      const legit = await call("POST", "/api/v1/auth/refresh", { headers: AUTHH, cookie: stolen });
      assert.equal(legit.status, 200);
      const legitCookie = cookieOf(legit);
      await sleep(2600);
      const replay = await call("POST", "/api/v1/auth/refresh", { headers: AUTHH, cookie: stolen });
      assert.equal(replay.status, 401);
      assert.equal(replay.data.error.code, "INVALID_REFRESH_TOKEN");
      const after = await call("POST", "/api/v1/auth/refresh", {
        headers: AUTHH,
        cookie: legitCookie,
      });
      assert.equal(after.status, 401, "legit token must be revoked too");
    },
  );

  await t(
    "refresh without cookie / garbage cookie -> 401; logout revokes and clears cookie",
    async () => {
      assert.equal((await call("POST", "/api/v1/auth/refresh", { headers: AUTHH })).status, 401);
      assert.equal(
        (await call("POST", "/api/v1/auth/refresh", { headers: AUTHH, cookie: "epam_rt=garbage" }))
          .status,
        401,
      );
      const login = await call("POST", "/api/v1/auth/login", {
        body: { email: "admin@example.org", password: ADMIN_PW },
        headers: AUTHH,
      });
      access = login.data.data.accessToken;
      cookie = cookieOf(login);
      const out = await call("POST", "/api/v1/auth/logout", { headers: AUTHH, cookie });
      assert.equal(out.status, 204);
      assert.ok(out.headers.getSetCookie().some((c) => /epam_rt=;/.test(c) && /Max-Age=0/.test(c)));
      assert.equal(
        (await call("POST", "/api/v1/auth/refresh", { headers: AUTHH, cookie })).status,
        401,
      );
      const re = await call("POST", "/api/v1/auth/login", {
        body: { email: "admin@example.org", password: ADMIN_PW },
        headers: AUTHH,
      });
      access = re.data.data.accessToken;
    },
  );

  // ---------- admin ----------
  await t("admin endpoints require authentication", async () => {
    for (const [m, p] of [
      ["GET", "/api/v1/admin/inquiries"],
      ["GET", `/api/v1/admin/inquiries/${firstId}`],
      ["PATCH", `/api/v1/admin/inquiries/${firstId}/status`],
      ["DELETE", `/api/v1/admin/inquiries/${firstId}`],
    ])
      assert.equal(
        (await call(m, p, { body: m === "PATCH" ? { status: "resolved" } : undefined })).status,
        401,
        `${m} ${p}`,
      );
  });

  await t("list: paged envelope, newest first, no message bodies in summaries", async () => {
    const r = await call("GET", "/api/v1/admin/inquiries?page=0&size=5", { token: access });
    assert.equal(r.status, 200);
    const d = r.data.data;
    assert.equal(d.items.length, 5);
    assert.ok(d.totalElements >= 26);
    assert.equal(d.last, false);
    assert.equal(d.totalPages, Math.ceil(d.totalElements / 5));
    assert.ok(!("message" in d.items[0]));
    const times = d.items.map((i) => Date.parse(i.createdAt));
    assert.deepEqual(
      times,
      [...times].sort((a, b) => b - a),
    );
    const lastPage = await call("GET", `/api/v1/admin/inquiries?page=${d.totalPages - 1}&size=5`, {
      token: access,
    });
    assert.equal(lastPage.data.data.last, true);
  });

  await t(
    "list: filters, prefix search, LIKE wildcards are escaped, sort whitelist, size cap",
    async () => {
      const k = await call("GET", "/api/v1/admin/inquiries?kind=partner&size=100", {
        token: access,
      });
      assert.ok(k.data.data.items.every((i) => i.kind === "partner"));
      const q = await call("GET", "/api/v1/admin/inquiries?q=load%201&size=100", { token: access });
      assert.ok(
        q.data.data.totalElements >= 10 &&
          q.data.data.items.every((i) => i.name.toLowerCase().startsWith("load 1")),
      );
      const wild = await call("GET", "/api/v1/admin/inquiries?q=%25", { token: access });
      assert.equal(wild.data.data.totalElements, 0, "a literal % must not match everything");
      const sorted = await call("GET", "/api/v1/admin/inquiries?sort=name&direction=asc&size=100", {
        token: access,
      });
      const names = sorted.data.data.items.map((i) => i.name);
      assert.deepEqual(names, [...names].sort());
      assert.equal(
        (await call("GET", "/api/v1/admin/inquiries?sort=password_hash", { token: access })).status,
        400,
      );
      assert.equal(
        (
          await call("GET", "/api/v1/admin/inquiries?sort=created_at;drop table users", {
            token: access,
          })
        ).status,
        400,
      );
      assert.equal(
        (await call("GET", "/api/v1/admin/inquiries?size=1000", { token: access })).status,
        400,
      );
      assert.equal(
        (await call("GET", "/api/v1/admin/inquiries?status=bogus", { token: access })).status,
        400,
      );
      assert.equal(
        (await call("GET", "/api/v1/admin/inquiries?q=%27%20OR%201%3D1--", { token: access })).data
          .data.totalElements,
        0,
      );
      assert.equal((await db`SELECT count(*)::int n FROM users`)[0].n >= 1, true);
    },
  );

  await t("detail: returns the full message; invalid/unknown ids -> 404 (never 500)", async () => {
    const r = await call("GET", `/api/v1/admin/inquiries/${firstId}`, { token: access });
    assert.equal(r.status, 200);
    assert.equal(r.data.data.message, "Hello\nwe want to partner.");
    assert.equal(r.data.data.version, 0);
    assert.equal(
      (await call("GET", "/api/v1/admin/inquiries/not-a-uuid", { token: access })).status,
      404,
    );
    assert.equal(
      (
        await call("GET", "/api/v1/admin/inquiries/00000000-0000-4000-8000-000000000000", {
          token: access,
        })
      ).status,
      404,
    );
  });

  await t(
    "status update: version bumps, updatedBy recorded, stale version -> 409, bad status -> 400",
    async () => {
      const ok1 = await call("PATCH", `/api/v1/admin/inquiries/${firstId}/status`, {
        token: access,
        body: { status: "in_progress" },
      });
      assert.equal(ok1.status, 200);
      assert.equal(ok1.data.data.status, "in_progress");
      assert.equal(ok1.data.data.version, 1);
      assert.equal(ok1.data.data.updatedBy, "admin@example.org");
      const stale = await call("PATCH", `/api/v1/admin/inquiries/${firstId}/status`, {
        token: access,
        body: { status: "resolved", version: 0 },
      });
      assert.equal(stale.status, 409);
      assert.equal(stale.data.error.code, "CONFLICT");
      const good = await call("PATCH", `/api/v1/admin/inquiries/${firstId}/status`, {
        token: access,
        body: { status: "resolved", version: 1 },
      });
      assert.equal(good.status, 200);
      assert.equal(good.data.data.version, 2);
      assert.equal(
        (
          await call("PATCH", `/api/v1/admin/inquiries/${firstId}/status`, {
            token: access,
            body: { status: "deleted" },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call(
            "PATCH",
            "/api/v1/admin/inquiries/00000000-0000-4000-8000-000000000000/status",
            { token: access, body: { status: "new" } },
          )
        ).status,
        404,
      );
    },
  );

  // STAFF user + disabled user
  const staffPw = "Another-Strong-Pass-1";
  await db`INSERT INTO users (email, password_hash, full_name, role) VALUES ('staff@example.org', ${await hashPassword(staffPw)}, 'Staff Person', 'STAFF')`;
  await db`INSERT INTO users (email, password_hash, full_name, role, enabled) VALUES ('off@example.org', ${await hashPassword(staffPw)}, 'Disabled', 'STAFF', false)`;
  let staffToken;
  await t(
    "RBAC: STAFF can read and update but cannot delete; ADMIN can delete (and it is audited)",
    async () => {
      const l = await call("POST", "/api/v1/auth/login", {
        body: { email: "staff@example.org", password: staffPw },
        headers: AUTHH,
      });
      assert.equal(l.status, 200);
      staffToken = l.data.data.accessToken;
      assert.equal(
        (await call("GET", "/api/v1/admin/inquiries", { token: staffToken })).status,
        200,
      );
      const target = (await call("GET", "/api/v1/admin/inquiries?q=load%200", { token: access }))
        .data.data.items[0].id;
      const denied = await call("DELETE", `/api/v1/admin/inquiries/${target}`, {
        token: staffToken,
      });
      assert.equal(denied.status, 403);
      assert.equal(denied.data.error.code, "ACCESS_DENIED");
      assert.equal(
        (await call("DELETE", `/api/v1/admin/inquiries/${target}`, { token: access })).status,
        204,
      );
      assert.equal(
        (await call("GET", `/api/v1/admin/inquiries/${target}`, { token: access })).status,
        404,
      );
      assert.equal(
        (await call("DELETE", `/api/v1/admin/inquiries/${target}`, { token: access })).status,
        404,
      );
      const audit = await db`SELECT action, actor_email FROM audit_log ORDER BY id`;
      assert.ok(
        audit.some((a) => a.action === "inquiry.delete" && a.actor_email === "admin@example.org"),
      );
      assert.ok(audit.some((a) => a.action === "inquiry.status"));
    },
  );

  await t(
    "disabled user cannot log in; disabling a user kills their live access token immediately",
    async () => {
      const off = await call("POST", "/api/v1/auth/login", {
        body: { email: "off@example.org", password: staffPw },
        headers: AUTHH,
      });
      assert.equal(off.status, 401);
      await db`UPDATE users SET enabled = false WHERE email = 'staff@example.org'`;
      assert.equal(
        (await call("GET", "/api/v1/admin/inquiries", { token: staffToken })).status,
        401,
      );
    },
  );

  await t(
    "CONTRACT: real responses satisfy the frontend's own zod schemas (receipt, auth, page, detail, error envelope)",
    async () => {
      const rec = await call("POST", "/api/v1/inquiries", { body: valid });
      fe.envelopeSchema(fe.inquiryReceiptSchema).parse(rec.data);
      fe.inquiryReceiptSchema.parse(rec.data.data);
      const lg = await call("POST", "/api/v1/auth/login", {
        body: { email: "admin@example.org", password: ADMIN_PW },
        headers: AUTHH,
      });
      fe.authResponseSchema.parse(lg.data.data);
      const list = await call("GET", "/api/v1/admin/inquiries?size=3", {
        token: lg.data.data.accessToken,
      });
      fe.pageSchema(fe.inquirySummarySchema).parse(list.data.data);
      const one = await call("GET", `/api/v1/admin/inquiries/${list.data.data.items[0].id}`, {
        token: lg.data.data.accessToken,
      });
      fe.inquiryDetailSchema.parse(one.data.data);
      const upd = await call(
        "PATCH",
        `/api/v1/admin/inquiries/${list.data.data.items[0].id}/status`,
        { token: lg.data.data.accessToken, body: { status: "new" } },
      );
      fe.inquiryDetailSchema.parse(upd.data.data);
      const err = await call("POST", "/api/v1/inquiries", { body: { ...valid, email: "bad" } });
      fe.envelopeSchema(fe.inquiryReceiptSchema).parse(err.data);
      assert.equal(err.data.error.details[0].field, "email");
      fe.submitInquirySchema.parse({
        kind: "contact",
        name: "A",
        email: "a@b.org",
        organization: null,
        message: "m",
      });
    },
  );

  await t(
    "user CLI: create STAFF, sign in, reset password (old sessions die), disable (access token dies)",
    async () => {
      const { spawnSync } = await import("node:child_process");
      const cli = (args, pw) =>
        spawnSync("node", ["scripts/user.ts", ...args], {
          env: {
            PATH: process.env.PATH,
            DATABASE_URL: dbUrl,
            JWT_SECRET: randomBytes(48).toString("base64"),
            ...(pw ? { USER_PASSWORD: pw } : {}),
          },
          encoding: "utf8",
        });
      const pw1 = "Cli-Created-Pass-123",
        pw2 = "Cli-Rotated-Pass-456";
      const c = cli(
        ["create", "--email", "Volunteer@Example.org", "--name", "Vol Unteer", "--role", "STAFF"],
        pw1,
      );
      assert.equal(c.status, 0, c.stderr);
      assert.match(c.stdout, /created STAFF volunteer@example\.org/);
      assert.notEqual(
        cli(["create", "--email", "short@example.org", "--name", "S"], "short").status,
        0,
        "weak password refused",
      );
      assert.notEqual(
        cli(["create", "--email", "volunteer@example.org", "--name", "Dup"], pw1).status,
        0,
        "duplicate refused",
      );
      const l = await call("POST", "/api/v1/auth/login", {
        body: { email: "volunteer@example.org", password: pw1 },
        headers: AUTHH,
      });
      assert.equal(l.status, 200);
      const c1 = cookieOf(l);
      const tok = l.data.data.accessToken;
      assert.equal(cli(["set-password", "--email", "volunteer@example.org"], pw2).status, 0);
      assert.equal(
        (await call("POST", "/api/v1/auth/refresh", { headers: AUTHH, cookie: c1 })).status,
        401,
        "old session revoked",
      );
      assert.equal(
        (
          await call("POST", "/api/v1/auth/login", {
            body: { email: "volunteer@example.org", password: pw1 },
            headers: AUTHH,
          })
        ).status,
        401,
      );
      const l2 = await call("POST", "/api/v1/auth/login", {
        body: { email: "volunteer@example.org", password: pw2 },
        headers: AUTHH,
      });
      assert.equal(l2.status, 200);
      assert.equal(cli(["disable", "--email", "volunteer@example.org"]).status, 0);
      assert.equal(
        (await call("GET", "/api/v1/admin/inquiries", { token: l2.data.data.accessToken })).status,
        401,
      );
      assert.ok(tok);
    },
  );

  await t(
    "every API response carries X-Request-Id; a caller-supplied id is echoed; errors never leak internals",
    async () => {
      const r = await call("GET", "/api/v1/auth/me", {
        headers: { "x-request-id": "trace-12345678" },
      });
      assert.equal(r.headers.get("x-request-id"), "trace-12345678");
      assert.equal(r.data.requestId, "trace-12345678");
      assert.ok(!/at .*\.(ts|mjs|js):\d+|postgres|SELECT|stack/i.test(r.text));
      const bad = await call("GET", "/api/v1/auth/me", {
        headers: { "x-request-id": "bad id with spaces!" },
      });
      assert.match(bad.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
    },
  );

  await t(
    "CORS: allow-list only (no wildcard); preflight from unlisted origin is refused",
    async () => {
      const r = await fetch(BASE + "/api/v1/inquiries", {
        method: "OPTIONS",
        headers: { origin: "https://evil.example", "access-control-request-method": "POST" },
      });
      assert.equal(r.status, 403);
      assert.equal(r.headers.get("access-control-allow-origin"), null);
    },
  );

  await t(
    "email outbox survives SMTP downtime: queued, retried, delivered after recovery, never lost",
    async () => {
      await new Promise((r) => smtp.close(r));
      const before = mails.length;
      const r = await call("POST", "/api/v1/inquiries", {
        body: { ...valid, name: "Outage Person", message: "sent while SMTP was down" },
      });
      assert.equal(r.status, 201, "the visitor must still succeed when email is down");
      const id = r.data.data.id;
      let pending;
      for (let i = 0; i < 60; i++) {
        [pending] = await db`SELECT notified_at, notify_attempts FROM inquiries WHERE id = ${id}`;
        if (pending.notify_attempts >= 1) break;
        await sleep(250);
      }
      assert.equal(pending.notified_at, null);
      assert.ok(pending.notify_attempts >= 1, "worker never attempted delivery");
      await startSmtp();
      await db`UPDATE inquiries SET next_notify_at = now() WHERE id = ${id}`;
      for (let i = 0; i < 40 && mails.length === before; i++) await sleep(250);
      const [after] =
        await db`SELECT notified_at, notify_attempts, next_notify_at, now() AS db_now FROM inquiries WHERE id = ${id}`;
      assert.ok(
        mails.slice(before).some((m) => m.includes("sent while SMTP was down")),
        `email not delivered after recovery: row=${JSON.stringify(after)} newMails=${mails.length - before}`,
      );
    },
  );

  await t("no PII in server logs (names, emails, messages, passwords, tokens)", async () => {
    for (const secret of [
      "Selam",
      "selam@example.com",
      "we want to partner",
      ADMIN_PW,
      staffPw,
      access,
      "epam_rt=",
    ])
      assert.ok(!serverLog.includes(secret), `log leaked: ${secret.slice(0, 20)}`);
    assert.match(serverLog, /"msg":"request"/);
  });
} finally {
  console.log(results.join("\n"));
  console.log(`\n${passed} passed, ${failed.length} failed`);
  if (failed.length)
    console.log("\n--- server log tail ---\n" + serverLog.split("\n").slice(-25).join("\n"));
  await cleanup().catch((e) => console.error("cleanup:", e.message));
  process.exit(failed.length ? 1 : 0);
}
