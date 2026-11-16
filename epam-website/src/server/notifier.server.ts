import nodemailer, { type Transporter } from "nodemailer";
import { getEnv } from "./env.server.ts";
import { sql } from "./db.server.ts";
import { logLine } from "./http.server.ts";

const MAX_ATTEMPTS = 8;
let transport: Transporter | undefined;
let running = false;

function getTransport(): Transporter {
  transport ??= nodemailer.createTransport({
    url: getEnv().SMTP_URL!,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transport;
}

interface Pending {
  id: string;
  kind: string;
  name: string;
  email: string;
  organization: string | null;
  message: string;
  created_at: Date;
  notify_attempts: number;
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ");

/**
 * Transactional outbox: a new inquiry is stored first (never lost), and this worker emails the team with retries and
 * exponential backoff. If SMTP is down, messages wait in the table and are sent when it recovers.
 */
export async function processOutbox(limit = 25): Promise<{ sent: number; failed: number }> {
  const env = getEnv();
  if (!env.notificationsEnabled || running) return { sent: 0, failed: 0 };
  running = true;
  let sent = 0;
  let failed = 0;
  try {
    await sql().begin(async (tx) => {
      const rows = await tx<Pending[]>`
        SELECT id, kind, name, email, organization, message, created_at, notify_attempts
        FROM inquiries
        WHERE notified_at IS NULL AND next_notify_at <= now() AND notify_attempts < ${MAX_ATTEMPTS}
        ORDER BY created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED`;
      for (const r of rows) {
        try {
          await getTransport().sendMail({
            from: env.SMTP_FROM!,
            to: env.NOTIFY_TO!,
            replyTo: r.email,
            subject: `[Website] New ${r.kind} inquiry`,
            text: [
              `Kind:         ${r.kind}`,
              `Received:     ${r.created_at.toISOString()}`,
              `Name:         ${oneLine(r.name)}`,
              `Email:        ${r.email}`,
              `Organization: ${r.organization ? oneLine(r.organization) : "-"}`,
              "",
              r.message,
              "",
              `Inquiry ID: ${r.id}`,
            ].join("\n"),
          });
          await tx`UPDATE inquiries SET notified_at = now() WHERE id = ${r.id}`;
          sent++;
        } catch (e) {
          const attempts = r.notify_attempts + 1;
          const backoff = Math.min(2 ** attempts * 30, 3600);
          await tx`
            UPDATE inquiries SET notify_attempts = ${attempts}, next_notify_at = now() + make_interval(secs => ${backoff})
            WHERE id = ${r.id}`;
          failed++;
          logLine(attempts >= MAX_ATTEMPTS ? "error" : "warn", "notification failed", {
            inquiryId: r.id,
            attempts,
            reason: e instanceof Error ? e.message.slice(0, 200) : "unknown",
          });
        }
      }
    });
  } finally {
    running = false;
  }
  return { sent, failed };
}

/** Fire-and-forget nudge right after a submission so the email goes out immediately. */
export function nudgeOutbox(): void {
  if (!getEnv().notificationsEnabled) return;
  processOutbox().catch((e) =>
    logLine("warn", "outbox run failed", { reason: String(e).slice(0, 200) }),
  );
}

export function resetTransportForTests(): void {
  transport?.close();
  transport = undefined;
}
