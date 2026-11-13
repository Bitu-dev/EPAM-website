/**
 * User management CLI. Reuses the server's own code, so hashing/validation can never drift from the app.
 *
 *   node scripts/user.ts list
 *   USER_PASSWORD='...' node scripts/user.ts create --email a@b.org --name "Full Name" --role STAFF
 *   USER_PASSWORD='...' node scripts/user.ts set-password --email a@b.org
 *   node scripts/user.ts disable --email a@b.org      (also revokes all of their sessions)
 *   node scripts/user.ts enable  --email a@b.org
 *
 * Needs DATABASE_URL (and JWT_SECRET, which the shared config requires). Passwords come from the USER_PASSWORD
 * environment variable so they never land in shell history or the process list.
 */
import { parseArgs } from "node:util";
import { closeDb, sql } from "../src/server/db.server.ts";
import { runMigrations } from "../src/server/migrations.server.ts";
import { createUser, normalizeEmail } from "../src/server/auth.server.ts";
import { hashPassword, PASSWORD_MAX, PASSWORD_MIN } from "../src/server/password.server.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { email: { type: "string" }, name: { type: "string" }, role: { type: "string" } },
});
const [command] = positionals;
const fail = (m: string): never => {
  console.error(`error: ${m}`);
  process.exit(1);
};
const emailArg = () => normalizeEmail(values.email ?? fail("--email is required"));
const passwordEnv = () => {
  const p = process.env["USER_PASSWORD"] ?? fail("set USER_PASSWORD");
  if (p.length < PASSWORD_MIN || p.length > PASSWORD_MAX)
    fail(`password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters`);
  return p;
};

try {
  await runMigrations(sql());
  switch (command) {
    case "list": {
      const rows =
        await sql()`SELECT email, full_name, role, enabled, created_at FROM users ORDER BY created_at`;
      console.table(
        rows.map((r) => ({ email: r.email, name: r.full_name, role: r.role, enabled: r.enabled })),
      );
      break;
    }
    case "create": {
      const role = values.role ?? "STAFF";
      if (role !== "ADMIN" && role !== "STAFF") fail("--role must be ADMIN or STAFF");
      const u = await createUser({
        email: emailArg(),
        password: passwordEnv(),
        fullName: values.name ?? fail("--name is required"),
        role: role as "ADMIN" | "STAFF",
      });
      console.log(`created ${u.role} ${u.email}`);
      break;
    }
    case "set-password": {
      const email = emailArg();
      const rows =
        await sql()`UPDATE users SET password_hash = ${await hashPassword(passwordEnv())}, updated_at = now() WHERE email = ${email} RETURNING id`;
      if (!rows.length) fail("no such user");
      await sql()`UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()), rotated_at = NULL WHERE user_id = ${rows[0]!["id"]}`;
      console.log(`password updated for ${email}; existing sessions revoked`);
      break;
    }
    case "disable":
    case "enable": {
      const email = emailArg();
      const rows =
        await sql()`UPDATE users SET enabled = ${command === "enable"}, updated_at = now() WHERE email = ${email} RETURNING id`;
      if (!rows.length) fail("no such user");
      if (command === "disable")
        await sql()`UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now()), rotated_at = NULL WHERE user_id = ${rows[0]!["id"]}`;
      console.log(`${command}d ${email}`);
      break;
    }
    default:
      fail(
        "usage: user.ts <list|create|set-password|disable|enable> [--email ..] [--name ..] [--role ADMIN|STAFF]",
      );
  }
} finally {
  await closeDb();
}
