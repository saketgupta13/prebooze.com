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

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | number | boolean | undefined> } = {},
): Promise<T> {
  const url = new URL(API_URL + path);
  Object.entries(options.query ?? {}).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });
  const token = getToken();
  const res = await fetch(url.toString(), {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Multipart upload — RN's fetch/FormData sets its own boundary the same
 * way a browser does; pass a { uri, name, type } part for each file field. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const token = getToken();
  const res = await fetch(API_URL + path, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? res.statusText);
  }
  return res.json();
}
