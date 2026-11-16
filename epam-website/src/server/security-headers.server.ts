/**
 * Headers added to every SSR/API response (the edge proxy adds the same set for static files).
 * CSP is Report-Only on purpose: the SSR HTML carries inline hydration scripts, so enforcing a strict policy
 * needs nonces. Violations are logged through /api/v1/csp-report; tighten and enforce once the log is quiet.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "report-uri /api/v1/csp-report",
].join("; ");

export function withSecurityHeaders(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  const set = (k: string, v: string) => {
    if (!headers.has(k)) headers.set(k, v);
  };
  set("x-content-type-options", "nosniff");
  set("x-frame-options", "DENY");
  set("referrer-policy", "strict-origin-when-cross-origin");
  set("permissions-policy", "geolocation=(), camera=(), microphone=(), payment=(), usb=()");
  set("cross-origin-opener-policy", "same-origin");
  set("content-security-policy-report-only", CSP);

  const proto =
    request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  if (proto === "https") set("strict-transport-security", "max-age=31536000; includeSubDomains");

  const path = new URL(request.url).pathname;
  if (path.startsWith("/admin")) {
    set("x-robots-tag", "noindex, nofollow");
    set("cache-control", "no-store");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
