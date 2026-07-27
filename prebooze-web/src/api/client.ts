/** HTTP client for the Prebooze backend.
 * When VITE_API_URL is unset the app runs in offline/mock mode (localStorage
 * store) — every feature keeps working. Set the env var and the same typed
 * endpoint functions hit the real server. */

export const API_URL: string = import.meta.env.VITE_API_URL ?? '';

export const isBackendEnabled = () => Boolean(API_URL);

const TOKEN_KEY = 'pb_auth_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY) ?? '';
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(path: string, options: { method?: string; body?: unknown; query?: Record<string, string | number | boolean | undefined> } = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'OFFLINE', 'Backend not configured (VITE_API_URL missing) — running in mock mode');
  const url = new URL(API_URL + path);
  Object.entries(options.query ?? {}).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString(), {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  // Nest sends an empty body (not "null") for a controller returning null —
  // res.json() throws on that, so check for empty text first.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Multipart upload — for KYC document + selfie submissions. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'OFFLINE', 'Backend not configured (VITE_API_URL missing) — running in mock mode');
  const res = await fetch(API_URL + path, {
    method: 'POST',
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : undefined,
    body: form, // browser sets multipart/form-data + boundary automatically
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? res.statusText);
  }
  return res.json();
}
