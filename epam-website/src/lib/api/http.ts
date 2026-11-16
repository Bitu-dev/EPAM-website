import type { z } from "zod";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "./config";
import { useAuthStore } from "./auth-store";
import { authResponseSchema, envelopeSchema } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: { field: string; message: string }[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  signal?: AbortSignal | undefined;
  /** Attach the access token and transparently refresh on 401. Default true. */
  auth?: boolean;
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);
const MAX_RETRIES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt: number) => 200 * 2 ** attempt + Math.random() * 100; // exponential + jitter

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return `${API_BASE_URL}${path}${qs ? `?${qs}` : ""}`;
}

/** Single-flight: if ten requests hit 401 together, only one refresh call is made. */
let refreshing: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        credentials: "include",
        headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
      });
      if (!res.ok) throw new Error("refresh rejected");
      const parsed = envelopeSchema(authResponseSchema).parse(await res.json());
      if (!parsed.data) throw new Error("empty refresh response");
      useAuthStore.getState().setSession(parsed.data.accessToken, parsed.data.user);
      return true;
    } catch {
      useAuthStore.getState().clear();
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function send(
  path: string,
  opts: RequestOptions,
  attempt = 0,
  refreshed = false,
): Promise<Response> {
  const { method = "GET", query, body, signal, auth = true } = opts;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Request-Id": crypto.randomUUID(),
    "X-Requested-With": "XMLHttpRequest", // required by the backend's cookie endpoints; harmless elsewhere
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = useAuthStore.getState().accessToken;
  if (auth && token) headers["Authorization"] = `Bearer ${token}`;

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
  signal?.addEventListener("abort", () => timeout.abort(), { once: true });

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      credentials: "include",
      signal: timeout.signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    // Network failure or timeout. Only idempotent reads are retried; never replay a POST/PATCH/DELETE.
    if (signal?.aborted) throw err;
    if (method === "GET" && attempt < MAX_RETRIES) {
      await sleep(backoff(attempt));
      return send(path, opts, attempt + 1, refreshed);
    }
    throw new ApiError("Network error. Check your connection and try again.", 0, "NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 && auth && !refreshed && useAuthStore.getState().accessToken) {
    if (await refreshSession()) return send(path, opts, attempt, true);
  }
  if (method === "GET" && RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
    await sleep(backoff(attempt));
    return send(path, opts, attempt + 1, refreshed);
  }
  return res;
}

/** Typed request: validates the envelope and the payload against a zod schema. Throws ApiError on any failure. */
export async function apiRequest<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  opts: RequestOptions = {},
): Promise<z.infer<S>> {
  const res = await send(path, opts);

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(
      "The server returned an unreadable response.",
      res.status,
      "INVALID_RESPONSE",
    );
  }

  const envelope = envelopeSchema(schema).safeParse(json);
  if (!envelope.success) {
    throw new ApiError(
      "The server response did not match the expected format.",
      res.status,
      "INVALID_RESPONSE",
    );
  }
  const { success, data, error, requestId } = envelope.data;
  if (!res.ok || !success || error) {
    throw new ApiError(
      error?.message ?? "Request failed",
      res.status,
      error?.code ?? "UNKNOWN",
      error?.details,
      requestId,
    );
  }
  return data as z.infer<S>;
}
