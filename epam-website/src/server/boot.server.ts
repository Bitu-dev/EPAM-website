import { getEnv } from "./env.server.ts";
import { sql } from "./db.server.ts";
import { runMigrations } from "./migrations.server.ts";
import { createUser } from "./auth.server.ts";
import { purgeTokens } from "./auth.server.ts";
import { purgeExpired } from "./ratelimit.server.ts";
import { processOutbox } from "./notifier.server.ts";
import { logLine } from "./http.server.ts";

let ready: Promise<void> | undefined;
let workersStarted = false;

async function bootstrapAdmin(): Promise<void> {
  const env = getEnv();
  if (!env.BOOTSTRAP_ADMIN_EMAIL || !env.BOOTSTRAP_ADMIN_PASSWORD) return;
  const rows = await sql()<{ n: number }[]>`SELECT count(*)::int AS n FROM users`;
  if ((rows[0]?.n ?? 0) > 0) return; // only ever seeds an empty system
  await createUser({
    email: env.BOOTSTRAP_ADMIN_EMAIL,
    password: env.BOOTSTRAP_ADMIN_PASSWORD,
    fullName: env.BOOTSTRAP_ADMIN_NAME,
    role: "ADMIN",
  });
  logLine("info", "bootstrap admin created", {
    hint: "remove BOOTSTRAP_ADMIN_* from the environment now",
  });
}

function startWorkers(): void {
  if (workersStarted) return;
  workersStarted = true;
  const every = (ms: number, fn: () => Promise<unknown>, label: string) => {
    const t = setInterval(
      () =>
        fn().catch((e) => logLine("warn", `${label} failed`, { reason: String(e).slice(0, 200) })),
      ms,
    );
    t.unref();
  };
  every(getEnv().OUTBOX_INTERVAL_SECONDS * 1000, () => processOutbox(), "outbox");
  every(
    3_600_000,
    async () => {
      await purgeExpired();
      await purgeTokens();
    },
    "cleanup",
  );
  void processOutbox().catch(() => {});
}

/** Runs once per process: validates config, migrates the schema, seeds the first admin, starts background jobs. */
export function ensureReady(): Promise<void> {
  ready ??= (async () => {
    getEnv();
    const applied = await runMigrations(sql());
    if (applied.length) logLine("info", "migrations applied", { applied });
    await bootstrapAdmin();
    startWorkers();
    logLine("info", "backend ready");
  })().catch((e) => {
    logLine("error", "backend failed to start", {
      reason: e instanceof Error ? e.message : String(e),
    });
    setTimeout(() => (ready = undefined), 5_000).unref(); // retry on a later request
    throw e;
  });
  return ready;
}

export async function dbHealthy(): Promise<boolean> {
  try {
    await sql()`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
