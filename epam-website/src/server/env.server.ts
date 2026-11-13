import { z } from "zod";

/**
 * Server-side configuration, validated once at first use. A bad or missing value fails loudly with a readable
 * message instead of surfacing later as a confusing runtime error. Empty strings count as "not set" so that
 * `VAR=${VAR:-}` in docker-compose behaves like an unset variable.
 */
const flag = z.enum(["true", "false"]).transform((v) => v === "true");
const csv = z.string().transform((v) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

const schema = z
  .object({
    NODE_ENV: z.string().default("development"),
    DATABASE_URL: z
      .string()
      .url()
      .refine((v) => /^postgres(ql)?:\/\//.test(v), "must be a postgres:// URL"),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),

    /** base64, decoding to >= 32 bytes: `openssl rand -base64 48` */
    JWT_SECRET: z.string().refine((v) => Buffer.from(v, "base64").length >= 32, {
      message: "must be base64 and decode to at least 32 bytes (openssl rand -base64 48)",
    }),
    JWT_ISSUER: z.string().min(1).default("epam-website"),
    ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TTL_SECONDS: z.coerce.number().int().min(3600).max(2_592_000).default(604_800),

    /** A just-rotated refresh token may be replayed this long (two tabs refreshing at once) without alarm. */
    REFRESH_GRACE_SECONDS: z.coerce.number().int().min(0).max(60).default(10),
    OUTBOX_INTERVAL_SECONDS: z.coerce.number().int().min(1).max(3600).default(30),

    COOKIE_SECURE: flag.optional(),
    /** Number of reverse proxies in front of the app that append to X-Forwarded-For (0 = none, trust nothing). */
    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    /** Extra browser origins allowed to call the API with credentials (dev only; same-origin needs none). */
    ALLOWED_ORIGINS: csv.default(""),
    PUBLIC_URL: z.string().url().optional(),

    RATE_INQUIRY_LIMIT: z.coerce.number().int().min(1).default(5),
    RATE_INQUIRY_WINDOW_SECONDS: z.coerce.number().int().min(10).default(600),
    RATE_AUTH_PER_MINUTE: z.coerce.number().int().min(1).default(10),
    RATE_API_PER_MINUTE: z.coerce.number().int().min(1).default(120),

    /** e.g. smtp://user:pass@smtp.example.org:587 (STARTTLS) or smtps://user:pass@host:465 */
    SMTP_URL: z.string().url().optional(),
    SMTP_FROM: z.string().min(3).optional(),
    NOTIFY_TO: csv.optional(),

    BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(128).optional(),
    BOOTSTRAP_ADMIN_NAME: z.string().min(1).max(120).default("Administrator"),
  })
  .transform((e) => ({
    ...e,
    isProd: e.NODE_ENV === "production",
    COOKIE_SECURE: e.COOKIE_SECURE ?? e.NODE_ENV === "production",
    notificationsEnabled: Boolean(
      e.SMTP_URL && e.SMTP_FROM && e.NOTIFY_TO && e.NOTIFY_TO.length > 0,
    ),
  }));

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(source)) if (v !== undefined && v !== "") cleaned[k] = v;
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`,
    );
    throw new Error(`Invalid server configuration:\n${lines.join("\n")}`);
  }
  return result.data;
}

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Test helper. */
export function resetEnvForTests(): void {
  cached = undefined;
}
