/**
 * API base URL. The backend lives in this same server (see src/server), so the default is the same-origin path.
 *   - same origin (default):  /api/v1
 *   - separate host (dev):    VITE_API_URL=http://localhost:3000/api/v1  (and add the site origin to ALLOWED_ORIGINS)
 */
const raw = import.meta.env["VITE_API_URL"] as string | undefined;

export const API_BASE_URL = (raw && raw.length > 0 ? raw : "/api/v1").replace(/\/+$/, "");
export const API_ENABLED = true;
export const REQUEST_TIMEOUT_MS = 10_000;
