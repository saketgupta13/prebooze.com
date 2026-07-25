/** The ONE real, live-backend-connected slice of prebooze-admin — everything
 * else in this app is mock/localStorage (see AdminContext.tsx), since there
 * was never a real staff session to call the live Admin API with. This does
 * its own real login (POST /admin/auth/login, real staff email+password,
 * handling the optional 2FA step) and stores the resulting JWT separately
 * from the mock `pba_session` — a deliberate, scoped exception, not a
 * pattern to copy elsewhere without the same real-auth treatment. */
const API_URL = import.meta.env.VITE_API_URL as string | undefined;
const TOKEN_KEY = 'pba_live_staff_token';

export function getLiveToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setLiveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearLiveToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function liveApiEnabled(): boolean {
  return Boolean(API_URL);
}

class LiveApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function liveFetch<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!API_URL) throw new LiveApiError(0, 'Live API not configured (VITE_API_URL missing)');
  const token = getLiveToken();
  const res = await fetch(API_URL + path, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) clearLiveToken();
    throw new LiveApiError(res.status, err.message ?? res.statusText);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const liveAuth = {
  login: (email: string, password: string) =>
    liveFetch<{ token?: string; requires2fa?: boolean; staffId?: string; staff?: { name: string; roleName: string } }>('/admin/auth/login', {
      body: { email, password },
    }),
  verify2fa: (staffId: string, code: string) => liveFetch<{ token: string; staff: { name: string; roleName: string } }>('/admin/auth/verify-2fa', { body: { staffId, code } }),
};

export interface LiveSubTier {
  id: string;
  role: 'organizer' | 'promoter' | 'venue' | 'lineup';
  name: string;
  price: number;
  guests: number | null;
  razorpayPlanId: string | null;
}

export const liveSubTiers = {
  list: (role?: string) => liveFetch<LiveSubTier[]>('/admin/sub-tiers' + (role ? `?role=${role}` : '')),
  create: (body: { role: string; name: string; price: number; guests?: number }) => liveFetch<LiveSubTier>('/admin/sub-tiers', { body }),
  update: (id: string, body: { name?: string; price?: number; guests?: number }) => liveFetch<LiveSubTier>(`/admin/sub-tiers/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => liveFetch<{ ok: true }>(`/admin/sub-tiers/${id}`, { method: 'DELETE' }),
};

export interface LiveSubscription {
  id: string;
  role: string;
  entityId: string;
  entityName: string;
  status: string;
  paidCount: number;
  currentStart: string | null;
  currentEnd: string | null;
  tier: { name: string; price: number };
}

export const liveSubscriptions = {
  list: (role?: string) => liveFetch<LiveSubscription[]>('/admin/subscriptions' + (role ? `?role=${role}` : '')),
};

export interface LiveTicketTier {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
}
export interface LiveEvent {
  id: string;
  slug: string;
  title: string;
  category: string;
  date: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  commission: number | null;
  paidOut: boolean;
  salesPaused: boolean;
  venue: { id: string; name: string; city: string };
  organizer: { id: string; brandName: string };
  tiers: LiveTicketTier[];
}
export const liveEvents = {
  list: (status?: string) => liveFetch<LiveEvent[]>('/admin/events' + (status ? `?status=${status}` : '')),
  approve: (id: string) => liveFetch<LiveEvent>(`/admin/events/${id}/approve`, { method: 'POST' }),
  reject: (id: string, reason: string) => liveFetch<LiveEvent>(`/admin/events/${id}/reject`, { method: 'POST', body: { reason } }),
  setCommission: (id: string, commission: number | null) => liveFetch<LiveEvent>(`/admin/events/${id}/commission`, { method: 'PATCH', body: { commission } }),
  setPaidOut: (id: string, paidOut: boolean) => liveFetch<LiveEvent>(`/admin/events/${id}/paid-out`, { method: 'PATCH', body: { paidOut } }),
  setSalesPaused: (id: string, paused: boolean) => liveFetch<LiveEvent>(`/admin/events/${id}/pause-sales`, { method: 'PATCH', body: { paused } }),
};

export interface LiveKycApplication {
  id: string;
  kind: 'organizer' | 'promoter' | 'lineup' | 'venue';
  status: 'pending' | 'approved' | 'rejected';
  payload: Record<string, unknown>;
  documents: { type: string; path: string }[];
  createdAt: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  user: { phone: string; name: string; email: string | null };
}
export const liveKyc = {
  list: (status?: string) => liveFetch<LiveKycApplication[]>('/admin/kyc' + (status ? `?status=${status}` : '')),
  approve: (id: string) => liveFetch<{ ok: true }>(`/admin/kyc/${id}/approve`, { method: 'POST' }),
  reject: (id: string, reason: string) => liveFetch<{ ok: true }>(`/admin/kyc/${id}/reject`, { method: 'POST', body: { reason } }),
};

export interface LiveBooking {
  id: string;
  mainGuest: string;
  whatsapp: string;
  tierName: string;
  qty: number;
  total: number;
  status: 'confirmed' | 'cancelled' | 'refunded' | 'refund_requested';
  paymentMethod: string | null;
  createdAt: string;
  guests: { name: string; checkedIn: boolean; gender?: string; whatsapp?: string }[];
  user: { name: string; phone: string };
  event: { title: string };
}
export const liveBookings = {
  list: (status?: string) => liveFetch<LiveBooking[]>('/admin/bookings' + (status ? `?status=${status}` : '')),
  get: (id: string) => liveFetch<LiveBooking>(`/admin/bookings/${encodeURIComponent(id)}`),
  approveRefund: (id: string) => liveFetch<LiveBooking>(`/admin/bookings/${encodeURIComponent(id)}/refund/approve`, { method: 'POST' }),
  declineRefund: (id: string) => liveFetch<LiveBooking>(`/admin/bookings/${encodeURIComponent(id)}/refund/decline`, { method: 'POST' }),
};

export interface LiveCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city: string;
  gender: string;
  verified: boolean;
  bookings: number;
  spend: number;
  status: 'active' | 'unverified' | 'blocked';
  segment: 'guests' | 'organizers';
}
export const liveCustomers = {
  list: (segment?: 'guests' | 'organizers') => liveFetch<LiveCustomer[]>('/admin/customers' + (segment ? `?segment=${segment}` : '')),
  create: (body: { name: string; phone: string; email?: string; city?: string; gender?: string; verified?: boolean }) =>
    liveFetch<LiveCustomer>('/admin/customers', { body }),
  setBlocked: (id: string, blocked: boolean) => liveFetch<{ ok: true }>(`/admin/customers/${id}/block`, { method: 'PATCH', body: { blocked } }),
};

export { LiveApiError };
