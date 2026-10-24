/** HTTP client for the real prebooze-api backend — same contract as
 * prebooze-web/src/api/client.ts, just backed by SecureStore instead of
 * localStorage for token persistence. */
import * as SecureStore from 'expo-secure-store';

// Same env pattern as the web app's VITE_API_URL. Set EXPO_PUBLIC_API_URL to
// point at a local dev server; defaults to the real production API.
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.prebooze.com/v1';

const TOKEN_KEY = 'pb_auth_token';

let cachedToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (cachedToken !== null) return cachedToken;
  cachedToken = (await SecureStore.getItemAsync(TOKEN_KEY)) ?? '';
  return cachedToken || null;
}

export function getToken(): string {
  return cachedToken ?? '';
}

export async function setToken(t: string): Promise<void> {
  cachedToken = t;
  await SecureStore.setItemAsync(TOKEN_KEY, t);
  // A fresh token deserves a fresh chance to trigger the unauthorized
  // handler if it later goes bad too — otherwise a guest who logs back in
  // after one dead-token logout would never get a second one.
  unauthorizedFired = false;
}

export async function clearToken(): Promise<void> {
  cachedToken = '';
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Real gap: nothing anywhere reacted to a token that went bad mid-session
// (expired/revoked JWT, not the boot-time check AuthContext already
// handles) — every screen just caught its own ApiError and showed a local
// "couldn't load" message forever, with no path back to login. AuthContext
// registers the one handler here at startup; apiFetch calls it exactly
// once per dead-token episode (not once per failed request — a screen that
// fires several parallel calls would otherwise trigger several redundant
// logouts) whenever an *authenticated* request comes back 401. A 401 with
// no token attached is a different, unrelated kind of rejection and must
// never trigger this.
let onUnauthorized: (() => void) | null = null;
let unauthorizedFired = false;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
  unauthorizedFired = false;
}

function handleResponseError(res: Response, err: { code?: string; message?: string }, hadToken: boolean): never {
  if (res.status === 401 && hadToken && onUnauthorized && !unauthorizedFired) {
    unauthorizedFired = true;
    onUnauthorized();
  }
  throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? res.statusText);
}

// Real gap: no request anywhere had a timeout — a "connected but not
// actually getting through" network (flaky signal at a crowded venue door,
// distinct from fully offline, which fails fast with a clear error) left
// whatever button triggered the call spinning forever with no way to
// recover, found live via the logout button hanging indefinitely during
// testing. fetchWithTimeout aborts and throws a plain Error (not an
// ApiError — deliberately, so AuthContext's boot check and every other
// ApiError-specific branch in the app correctly treat a timeout the same
// as any other network failure, never as a 401/invalid-session). 15s for
// ordinary requests; apiUpload gets longer since a real photo over a slow
// connection can legitimately take a while.
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Request timed out — check your connection and try again.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 45_000;

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | number | boolean | undefined> } = {},
): Promise<T> {
  const url = new URL(API_URL + path);
  Object.entries(options.query ?? {}).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });
  const token = getToken();
  const res = await fetchWithTimeout(url.toString(), {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  }, DEFAULT_TIMEOUT_MS);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    handleResponseError(res, err, !!token);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Multipart upload — RN's fetch/FormData sets its own boundary the same
 * way a browser does; pass a { uri, name, type } part for each file field. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const token = getToken();
  const res = await fetchWithTimeout(API_URL + path, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  }, UPLOAD_TIMEOUT_MS);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    handleResponseError(res, err, !!token);
  }
  return res.json();
}
