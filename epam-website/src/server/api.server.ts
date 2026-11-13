import { ZodError } from "zod";
import { getEnv } from "./env.server.ts";
import { ensureReady } from "./boot.server.ts";
import { hit } from "./ratelimit.server.ts";
import {
  ApiError,
  clientIpOf,
  fail,
  logLine,
  originVerdict,
  requestIdOf,
  violationsFrom,
  type Ctx,
} from "./http.server.ts";

export type Bucket = "api" | "auth" | "inquiry";
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Wraps every API handler: readiness, origin check (CSRF defence in depth), CORS for allow-listed dev origins,
 * rate limiting, uniform error envelope, and a PII-free access log.
 */
export function api(
  bucket: Bucket,
  handler: (ctx: Ctx, params: Record<string, string>) => Promise<Response>,
) {
  return async ({
    request,
    params,
  }: {
    request: Request;
    params?: Record<string, string>;
  }): Promise<Response> => {
    const started = Date.now();
    const ctx: Ctx = {
      request,
      requestId: requestIdOf(request),
      ip: "unknown",
      headers: new Headers(),
    };
    let response: Response;
    try {
      ctx.ip = clientIpOf(request);
      const origin = originVerdict(request);
      if (!origin.allowed) throw new ApiError("ACCESS_DENIED");
      if (origin.corsOrigin) {
        ctx.headers.set("access-control-allow-origin", origin.corsOrigin);
        ctx.headers.set("access-control-allow-credentials", "true");
        ctx.headers.append("vary", "Origin");
      }
      if (request.method === "OPTIONS") {
        ctx.headers.set("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
        ctx.headers.set(
          "access-control-allow-headers",
          "authorization,content-type,x-requested-with,x-request-id",
        );
        ctx.headers.set("access-control-max-age", "600");
        return new Response(null, { status: 204, headers: ctx.headers });
      }
      if (
        bucket === "auth" &&
        UNSAFE.has(request.method) &&
        request.headers.get("x-requested-with") !== "XMLHttpRequest"
      ) {
        // Cookie-based auth endpoints demand a custom header, which a cross-site form cannot send.
        throw new ApiError("ACCESS_DENIED");
      }

      try {
        await ensureReady();
      } catch {
        throw new ApiError("SERVICE_UNAVAILABLE");
      }

      const env = getEnv();
      await enforce(ctx, `api:${ctx.ip}`, env.RATE_API_PER_MINUTE, 60);
      if (bucket === "auth" && UNSAFE.has(request.method)) {
        await enforce(ctx, `auth:${ctx.ip}`, env.RATE_AUTH_PER_MINUTE, 60);
      }
      if (bucket === "inquiry" && request.method === "POST") {
        await enforce(
          ctx,
          `inq:${ctx.ip}`,
          env.RATE_INQUIRY_LIMIT,
          env.RATE_INQUIRY_WINDOW_SECONDS,
        );
      }

      response = await handler(ctx, params ?? {});
    } catch (e) {
      if (e instanceof ApiError) response = fail(ctx, e);
      else if (e instanceof ZodError)
        response = fail(ctx, new ApiError("VALIDATION_FAILED", undefined, violationsFrom(e)));
      else {
        logLine("error", "unhandled error", {
          requestId: ctx.requestId,
          reason: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 300) : "unknown",
        });
        response = fail(ctx, new ApiError("INTERNAL_ERROR"));
      }
    }
    logLine("info", "request", {
      requestId: ctx.requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      status: response.status,
      ms: Date.now() - started,
    });
    return response;
  };
}

async function enforce(ctx: Ctx, key: string, limit: number, windowSeconds: number): Promise<void> {
  const h = await hit(key, limit, windowSeconds);
  if (!h.allowed) {
    throw new ApiError("RATE_LIMITED", undefined, undefined, {
      "retry-after": String(h.retryAfterSeconds),
    });
  }
  ctx.headers.set("x-ratelimit-remaining", String(h.remaining));
}
