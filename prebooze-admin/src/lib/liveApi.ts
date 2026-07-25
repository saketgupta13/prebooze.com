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

export interface LiveOrganizer { id: string; brandName: string; username: string; city: string; verified: boolean; eventsHosted: number; }
export interface LivePromoter { id: string; name: string; slug: string; city: string; verified: boolean; eventsPromoted: number; }
export interface LiveVenue { id: string; name: string; city: string; type: string; capacity: number; verified: boolean; }
export interface LiveLineup { id: string; name: string; slug: string; city: string; category: string; verified: boolean; }

export const liveOrganizers = {
  list: () => liveFetch<LiveOrganizer[]>('/admin/organizers'),
  setVerified: (id: string, verified: boolean) => liveFetch<LiveOrganizer>(`/admin/organizers/${id}/verify`, { method: 'POST', body: { verified } }),
};
export const livePromoters = {
  list: () => liveFetch<LivePromoter[]>('/admin/promoters'),
  setVerified: (id: string, verified: boolean) => liveFetch<LivePromoter>(`/admin/promoters/${id}/verify`, { method: 'POST', body: { verified } }),
};
export const liveVenues = {
  list: () => liveFetch<LiveVenue[]>('/admin/venues'),
  setVerified: (id: string, verified: boolean) => liveFetch<LiveVenue>(`/admin/venues/${id}/verify`, { method: 'POST', body: { verified } }),
};
export const liveLineups = {
  list: () => liveFetch<LiveLineup[]>('/admin/lineups'),
  setVerified: (id: string, verified: boolean) => liveFetch<LiveLineup>(`/admin/lineups/${id}/verify`, { method: 'POST', body: { verified } }),
};

export interface LiveDashboard {
  grossSales: number;
  ticketsSold: number;
  commissionEarned: number;
  refundsAmount: number;
  refundedTickets: number;
  pendingEvents: number;
  pendingRefunds: number;
  pendingKyc: number;
  totalCustomers: number;
  totalOrganizers: number;
  verifiedOrganizers: number;
  totalEvents: number;
  liveNow: number;
  totalBookings: number;
  topSellingEvents: { id: string; title: string; city: string; sold: number }[];
  ticketStats: { sold: number; available: number; checkedIn: number; refunded: number; cap: number };
  topPromoters: { id: string; name: string; showRate: number; earned: number }[];
  salesTrend: { date: string; gross: number }[];
  liveAndUpcoming: { id: string; title: string; date: string; status: string; revenue: number; sold: number }[];
}
export const liveDashboard = {
  overview: (days?: number, city?: string) => {
    const q = new URLSearchParams();
    if (days) q.set('days', String(days));
    if (city) q.set('city', city);
    const qs = q.toString();
    return liveFetch<LiveDashboard>('/admin/dashboard' + (qs ? `?${qs}` : ''));
  },
};

export interface LiveFinance {
  commissionIncome: number;
  feeIncome: number;
  otherIncome: number;
  expensesByCat: Record<string, number>;
  totalExpenses: number;
  gstPayable: number;
  gross: number;
  payoutsDue: number;
  paidOut: number;
  totalIncome: number;
  netProfit: number;
  cash: number;
  refundsPending: number;
  topEvents: { id: string; title: string; revenue: number; commission: number | null }[];
  settings: { bookingFee: number; gstPct: number };
}
export const liveFinance = {
  get: (city?: string) => liveFetch<LiveFinance>('/admin/reports/finance' + (city ? `?city=${city}` : '')),
};

export interface LivePayoutRow {
  id: string;
  title: string;
  organizer: string;
  revenue: number;
  commission: number | null;
  commissionAmt: number;
  gst: number;
  net: number;
  paidOut: boolean;
  payoutUtr: string | null;
}
export const livePayments = {
  due: () => liveFetch<{ rows: LivePayoutRow[]; collected: number; commissionKept: number; gstCollected: number; dueTotal: number }>('/admin/payments/due'),
  runBatch: (eventIds: string[]) => liveFetch<{ ok: true; count: number }>('/admin/payments/run-batch', { body: { eventIds } }),
};

export interface LiveLedgerEntry {
  id: string;
  kind: 'income' | 'expense';
  category: string;
  amount: number;
  note: string | null;
  auto: boolean;
  createdAt: string;
}
export const liveLedger = {
  list: (kind?: 'income' | 'expense') => liveFetch<{ entries: LiveLedgerEntry[]; totalIncome: number; totalExpense: number; net: number }>('/admin/ledger' + (kind ? `?kind=${kind}` : '')),
  addEntry: (body: { kind: 'income' | 'expense'; category: string; amount: number; note?: string }) => liveFetch<LiveLedgerEntry>('/admin/ledger', { body }),
  removeEntry: (id: string) => liveFetch<{ ok: true }>(`/admin/ledger/${id}`, { method: 'DELETE' }),
  categories: () => liveFetch<{ income: string[]; expense: string[] }>('/admin/ledger/categories'),
  addCategory: (kind: 'income' | 'expense', name: string) => liveFetch<unknown>('/admin/ledger/categories', { body: { kind, name } }),
};

export const PERM_MODULES = [
  'Dashboard', 'Events & approvals', 'Event commission (per event)', 'Bookings', 'Refunds',
  'Payments & payouts', 'Customers', 'Organizers', 'Promoters', 'Lineups', 'Venues',
  'Verifications (KYC)', 'Reviews', 'Locations', 'Abandoned carts', 'Featured', 'Content',
  'Careers', 'Reels', 'Promo codes', 'Gate check-in', 'Reports',
] as const;
export type PermKey = 'view' | 'edit' | 'approve';
export type Perms = Record<string, Record<PermKey, boolean>>;

export interface LiveStaff {
  id: string;
  email: string;
  name: string;
  roleName: string;
  city: string | null;
  phone: string | null;
  lastActiveAt: string | null;
  createdAt: string;
}
export const liveStaff = {
  list: () => liveFetch<LiveStaff[]>('/admin/staff'),
  create: (body: { email: string; name?: string; roleName: string; city?: string; phone?: string }) =>
    liveFetch<LiveStaff & { tempPassword: string }>('/admin/staff', { body }),
  updateRole: (id: string, roleName: string) => liveFetch<LiveStaff>(`/admin/staff/${id}`, { method: 'PATCH', body: { roleName } }),
  remove: (id: string) => liveFetch<{ ok: true }>(`/admin/staff/${id}`, { method: 'DELETE' }),
};

export const liveRoles = {
  list: () => liveFetch<Record<string, Perms>>('/admin/roles'),
  add: (name: string) => liveFetch<unknown>('/admin/roles', { body: { name } }),
  setPerm: (name: string, module: string, key: PermKey, value: boolean) =>
    liveFetch<unknown>(`/admin/roles/${encodeURIComponent(name)}`, { method: 'PATCH', body: { module, key, value } }),
  remove: (name: string) => liveFetch<{ ok: true }>(`/admin/roles/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};

export interface LiveSettings {
  bookingFee: number;
  gstPct: number;
  feeLabel: string;
  absorbedBy: string;
  payoutDay: string;
  autoPayout: boolean;
  weeklyEmail: boolean;
  whatsappAlerts: boolean;
  require2fa: boolean;
  maintenanceMode: boolean;
  salesPaused: boolean;
  comingSoonMode: boolean;
  socials: Record<string, string>;
  siteSeo: Record<string, string>;
  contact: Record<string, string>;
  footerCopyright: string;
}
export const liveSettings = {
  get: () => liveFetch<LiveSettings>('/admin/settings'),
  update: (body: Partial<LiveSettings>) => liveFetch<LiveSettings>('/admin/settings', { method: 'PATCH', body }),
};

export { LiveApiError };
