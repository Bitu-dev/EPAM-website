import postgres from "postgres";
import { getEnv } from "./env.server.ts";

export type Sql = postgres.Sql;

let client: Sql | undefined;

export function sql(): Sql {
  if (!client) {
    const env = getEnv();
    client = postgres(env.DATABASE_URL, {
      max: env.DATABASE_POOL_MAX,
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 60 * 30,
      onnotice: () => {},
    });
  }
  return client;
}

export async function closeDb(): Promise<void> {
  const c = client;
  client = undefined;
  if (c) await c.end({ timeout: 5 });
}
