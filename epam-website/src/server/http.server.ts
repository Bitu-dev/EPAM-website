import { z } from "zod";
import { getEnv } from "./env.server.ts";

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "MALFORMED_REQUEST"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "INVALID_REFRESH_TOKEN"
  | "ACCESS_DENIED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "ACCOUNT_LOCKED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  MALFORMED_REQUEST: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  INVALID_REFRESH_TOKEN: 401,
  ACCESS_DENIED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  ACCOUNT_LOCKED: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

const MESSAGE: Record<ErrorCode, string> = {
  VALIDATION_FAILED: "Some fields are invalid.",
  MALFORMED_REQUEST: "The request could not be understood.",
  UNAUTHENTICATED: "Authentication is required.",
  INVALID_CREDENTIALS: "Invalid email or password.",
  INVALID_REFRESH_TOKEN: "Your session has expired. Please sign in again.",
  ACCESS_DENIED: "You do not have access to this resource.",
  NOT_FOUND: "Not found.",
  CONFLICT: "The record was changed by someone else. Reload and try again.",
  PAYLOAD_TOO_LARGE: "The request is too large.",
  UNSUPPORTED_MEDIA_TYPE: "Content-Type must be application/json.",
  RATE_LIMITED: "Too many requests. Please try again later.",
  ACCOUNT_LOCKED: "Too many failed attempts. Please try again later.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable.",
  INTERNAL_ERROR: "Something went wrong on our side.",
};

export interface FieldViolation {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: FieldViolation[] | undefined;
  readonly headers: Record<string, string>;
  constructor(
    code: ErrorCode,
    message?: string,
    details?: FieldViolation[],
    headers: Record<string, string> = {},
  ) {
    super(message ?? MESSAGE[code]);
    this.code = code;
    this.details = details;
    this.headers = headers;
    this.status = STATUS[code];
  }
}

export function violationsFrom(error: z.ZodError): FieldViolation[] {
  return error.issues.map((i) => ({ field: i.path.join(".") || "(body)", message: i.message }));
}

/** Parses with zod and converts failure into a 400 with per-field details. */
export function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw new ApiError("VALIDATION_FAILED", undefined, violationsFrom(r.error));
  return r.data;
}

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

export function requestIdOf(request: Request): string {
  const incoming = request.headers.get("x-request-id");
  return incoming && REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
}

export interface Ctx {
  request: Request;
  requestId: string;
  ip: string;
  /** Extra headers merged into the final response (cookies, rate-limit info, CORS). */
  headers: Headers;
}

export function ok<T>(ctx: Ctx, data: T, status = 200): Response {
  return respond(ctx, status, {
    success: true,
    data,
    requestId: ctx.requestId,
    timestamp: new Date().toISOString(),
  });
}

export function fail(ctx: Ctx, err: ApiError): Response {
  const body = {
    success: false,
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
    requestId: ctx.requestId,
    timestamp: new Date().toISOString(),
  };
  for (const [k, v] of Object.entries(err.headers)) ctx.headers.set(k, v);
  return respond(ctx, err.status, body);
}

function respond(ctx: Ctx, status: number, body: unknown): Response {
  const headers = new Headers(ctx.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-request-id", ctx.requestId);
  return new Response(JSON.stringify(body), { status, headers });
}

/** Reads a JSON body with a hard size cap, without buffering more than the cap. */
export async function readJson(request: Request, maxBytes = 16 * 1024): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) throw new ApiError("UNSUPPORTED_MEDIA_TYPE");
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new ApiError("PAYLOAD_TOO_LARGE");
  if (!request.body) throw new ApiError("MALFORMED_REQUEST");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      void reader.cancel();
      throw new ApiError("PAYLOAD_TOO_LARGE");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError("MALFORMED_REQUEST");
  }
}

/**
 * Real client address. X-Forwarded-For is only believed for the number of proxies we are told sit in front
 * of us (TRUSTED_PROXY_HOPS): the entry that many places from the right is the one our outermost trusted
 * proxy saw. Anything the client prepended to the header sits further left and is ignored.
 */
export function resolveClientIp(
  xff: string | null,
  socketIp: string | undefined,
  hops: number,
): string {
  if (hops > 0 && xff) {
    const list = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const idx = list.length - hops;
    const candidate = idx >= 0 ? list[idx] : list[0];
    if (candidate && /^[0-9a-fA-F:.]{3,45}$/.test(candidate)) return candidate;
  }
  return socketIp && socketIp.length > 0 ? socketIp : "unknown";
}

interface NodeishRequest extends Request {
  ip?: string;
  runtime?: { node?: { req?: { socket?: { remoteAddress?: string } } } };
}

export function clientIpOf(request: Request): string {
  const r = request as NodeishRequest;
  const socketIp = r.ip ?? r.runtime?.node?.req?.socket?.remoteAddress;
  return resolveClientIp(
    request.headers.get("x-forwarded-for"),
    socketIp,
    getEnv().TRUSTED_PROXY_HOPS,
  );
}

/** Origin allow-list check for browser requests. Same-origin always passes; other origins must be listed. */
export function originVerdict(request: Request): { allowed: boolean; corsOrigin: string | null } {
  const origin = request.headers.get("origin");
  if (!origin) return { allowed: true, corsOrigin: null }; // non-browser clients, same-origin GETs
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return { allowed: false, corsOrigin: null };
  }
  const own = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (own && host === own) return { allowed: true, corsOrigin: null };
  if (getEnv().ALLOWED_ORIGINS.includes(origin)) return { allowed: true, corsOrigin: origin };
  return { allowed: false, corsOrigin: null };
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function logLine(
  level: "info" | "warn" | "error",
  msg: string,
  fields: Record<string, unknown> = {},
): void {
  // One JSON object per line. Never pass names, emails, messages, passwords or tokens in `fields`.
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    service: "epam-website",
    msg,
    ...fields,
  });
  (level === "error" ? console.error : console.log)(line);
}
