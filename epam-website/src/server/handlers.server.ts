import { z } from "zod";
import { getEnv } from "./env.server.ts";
import { ApiError, ok, parse, parseCookies, readJson, type Ctx } from "./http.server.ts";
import { api } from "./api.server.ts";
import * as auth from "./auth.server.ts";
import * as inquiries from "./inquiries.server.ts";
import { nudgeOutbox } from "./notifier.server.ts";
import { dbHealthy, ensureReady } from "./boot.server.ts";
import { logLine } from "./http.server.ts";

const COOKIE = "epam_rt";
const COOKIE_PATH = "/api/v1/auth";

function refreshCookie(value: string, maxAge: number): string {
  const env = getEnv();
  return [
    `${COOKIE}=${encodeURIComponent(value)}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Strict",
    env.COOKIE_SECURE ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

const authResponse = (s: auth.Session) => ({
  accessToken: s.accessToken,
  tokenType: s.tokenType,
  expiresIn: s.expiresIn,
  user: s.user,
});

// ---------- public ----------

export const submitInquiry = api("inquiry", async (ctx) => {
  const input = parse(inquiries.submitSchema, await readJson(ctx.request));
  const receipt = await inquiries.submit(input);
  if (!input.website) nudgeOutbox();
  return ok(ctx, receipt, 201);
});

export const cspReport = api("api", async (ctx) => {
  try {
    const body = (await readJson(ctx.request, 8 * 1024).catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const r = (body?.["csp-report"] ?? body) as Record<string, unknown> | null;
    if (r) {
      logLine("warn", "csp violation", {
        directive: String(r["violated-directive"] ?? r["effectiveDirective"] ?? "").slice(0, 80),
        blocked: String(r["blocked-uri"] ?? r["blockedURL"] ?? "").slice(0, 200),
      });
    }
  } catch {
    /* reports are best-effort */
  }
  return new Response(null, { status: 204 });
});

// ---------- auth ----------

const loginSchema = z
  .object({ email: z.string().email().max(255), password: z.string().min(1).max(128) })
  .strict();

export const login = api("auth", async (ctx) => {
  const body = parse(loginSchema, await readJson(ctx.request, 4 * 1024));
  const session = await auth.login(
    body.email,
    body.password,
    ctx.ip,
    ctx.request.headers.get("user-agent"),
  );
  ctx.headers.append(
    "set-cookie",
    refreshCookie(session.refreshToken, getEnv().REFRESH_TTL_SECONDS),
  );
  return ok(ctx, authResponse(session));
});

export const refresh = api("auth", async (ctx) => {
  const raw = parseCookies(ctx.request.headers.get("cookie"))[COOKIE];
  if (!raw) throw new ApiError("INVALID_REFRESH_TOKEN");
  try {
    const session = await auth.refresh(raw, ctx.request.headers.get("user-agent"));
    ctx.headers.append(
      "set-cookie",
      refreshCookie(session.refreshToken, getEnv().REFRESH_TTL_SECONDS),
    );
    return ok(ctx, authResponse(session));
  } catch (e) {
    if (e instanceof ApiError && e.code === "INVALID_REFRESH_TOKEN")
      ctx.headers.append("set-cookie", refreshCookie("", 0));
    throw e;
  }
});

export const logout = api("auth", async (ctx) => {
  await auth.logout(parseCookies(ctx.request.headers.get("cookie"))[COOKIE]);
  ctx.headers.append("set-cookie", refreshCookie("", 0));
  return new Response(null, { status: 204, headers: ctx.headers });
});

export const me = api("auth", async (ctx) => ok(ctx, await auth.authenticate(ctx.request)));

// ---------- admin ----------

export const adminList = api("api", async (ctx) => {
  await auth.authenticate(ctx.request);
  const params = Object.fromEntries(new URL(ctx.request.url).searchParams);
  return ok(ctx, await inquiries.search(parse(inquiries.listQuerySchema, params)));
});

export const adminGet = api("api", async (ctx, p) => {
  await auth.authenticate(ctx.request);
  return ok(ctx, await inquiries.get(p["id"] ?? ""));
});

export const adminSetStatus = api("api", async (ctx, p) => {
  const user = await auth.authenticate(ctx.request);
  const body = parse(inquiries.statusBodySchema, await readJson(ctx.request, 1024));
  const updated = await inquiries.updateStatus(p["id"] ?? "", body.status, body.version, user);
  await inquiries.audit(user, "inquiry.status", { type: "inquiry", id: updated.id }, ctx);
  return ok(ctx, updated);
});

export const adminDelete = api("api", async (ctx, p) => {
  const user = await auth.authenticate(ctx.request);
  auth.requireRole(user, "ADMIN");
  const id = p["id"] ?? "";
  await inquiries.remove(id);
  await inquiries.audit(user, "inquiry.delete", { type: "inquiry", id }, ctx);
  return new Response(null, { status: 204, headers: ctx.headers });
});

// ---------- ops ----------

export async function healthz(_ctx?: unknown): Promise<Response> {
  return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}

export async function readyz(_ctx?: unknown): Promise<Response> {
  let ready = false;
  try {
    await ensureReady();
    ready = await dbHealthy();
  } catch {
    ready = false;
  }
  return Response.json(
    { status: ready ? "ready" : "unavailable" },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}

export type { Ctx };

// ---------- SEO ----------

const PAGES = ["/", "/about", "/impact", "/partners", "/media", "/contact"];

function siteOrigin(request: Request): string {
  const configured = getEnv().PUBLIC_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host}`;
}

export function sitemap({ request }: { request: Request }): Response {
  const origin = siteOrigin(request);
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    PAGES.map((p) => `  <url><loc>${origin}${p === "/" ? "/" : p}</loc></url>`).join("\n") +
    `\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

export function robots({ request }: { request: Request }): Response {
  const body = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${siteOrigin(request)}/sitemap.xml\n`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
