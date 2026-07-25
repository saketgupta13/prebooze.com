import { API_URL } from '../api/client';

/** Real staff login used only to bypass the "coming soon" gate (see
 * ComingSoonGate.tsx) — deliberately separate from the guest auth token
 * (`pb_auth_token`/apiFetch) so a staff member unlocking the site doesn't
 * also become "logged in as a guest," and so a real guest session on the
 * same browser is never touched by this. Same real `POST /admin/auth/login`
 * staff-auth endpoint (with 2FA) used by prebooze-admin's one real page. */
const BYPASS_KEY = 'pb_staff_bypass_token';

export const getBypassToken = () => localStorage.getItem(BYPASS_KEY);
export const clearBypassToken = () => localStorage.removeItem(BYPASS_KEY);

class StaffAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function staffFetch<T>(path: string, body: unknown): Promise<T> {
  if (!API_URL) throw new StaffAuthError(0, 'Backend not configured');
  const res = await fetch(API_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new StaffAuthError(res.status, data.message ?? res.statusText);
  return data;
}

export const staffAuth = {
  login: (email: string, password: string) =>
    staffFetch<{ token?: string; requires2fa?: boolean; staffId?: string }>('/admin/auth/login', { email, password }),
  verify2fa: (staffId: string, code: string) => staffFetch<{ token: string }>('/admin/auth/verify-2fa', { staffId, code }),
};

/** Confirms the stored bypass token is still a real, currently-valid staff
 * session — not just "a token exists" (it could be expired/revoked).
 * `/admin/auth/me` only requires StaffAuthGuard (no specific module
 * permission), so any staff role passes regardless of what they're allowed
 * to edit — the gate only cares "is this a real staff member." */
export async function verifyBypassToken(token: string): Promise<boolean> {
  if (!API_URL) return false;
  const res = await fetch(`${API_URL}/admin/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  return res.ok;
}

export { StaffAuthError };
export function setBypassToken(token: string) {
  localStorage.setItem(BYPASS_KEY, token);
}
