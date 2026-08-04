/** The ONE real, live-backend-connected slice of prebooze-admin — everything
 * else in this app is mock/localStorage (see AdminContext.tsx), since there
 * was never a real staff session to call the live Admin API with. This does
 * its own real login (POST /admin/auth/login, real staff email+password,
 * handling the optional 2FA step) and stores the resulting JWT separately
 * from the mock `pba_session` — a deliberate, scoped exception, not a
 * pattern to copy elsewhere without the same real-auth treatment. */
import type { Seo } from '../types';

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

export interface LiveStaffMe {
  id: string;
  name: string;
  email: string;
  roleName: string;
  permissions: Record<string, Record<string, boolean>>;
  city?: string;
  lastActiveAt?: string;
}
/** The signed-in staffer's own account — distinct from AdminStaffController
 * (Owner-only management of everyone else's Staff rows). */
export const liveMe = {
  get: () => liveFetch<LiveStaffMe>('/admin/auth/me'),
  update: (body: { name?: string; email?: string }) => liveFetch<LiveStaffMe>('/admin/auth/me', { method: 'PATCH', body }),
  changePassword: (currentPassword: string, newPassword: string) =>
    liveFetch<{ ok: true }>('/admin/auth/me/password', { body: { currentPassword, newPassword } }),
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
  description: string | null;
  includes: string[];
  sold: number;
}
export interface LiveSeo { title: string; description: string; keywords: string; }
export interface LiveLineupItem { name: string; role: string; }
export interface LivePartyRule { title: string; body: string; }
export interface LivePromoterConfig { enabled: boolean; cap: number; cutoff: string; allowedPromoters: string[]; perHeadPayout: boolean; perHeadAmount: number; allowTeams: boolean; }
export interface LiveEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  subCategory: string | null;
  ageLimit: string;
  tags: string[];
  date: string;
  durationHrs: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  conditions: string[];
  rules: LivePartyRule[];
  lineup: LiveLineupItem[];
  posterHue: number;
  posterUrl: string | null;
  galleryUrls: string[];
  teaserVideoUrl: string | null;
  socialBanners: { postUrl?: string; storyUrl?: string } | null;
  seo: LiveSeo | null;
  promoterConfig: LivePromoterConfig | null;
  commission: number | null;
  paidOut: boolean;
  salesPaused: boolean;
  // Optional — a private-address event has no venueId at all; privateCity/
  // privateLocality are set instead, and that's all guests ever see.
  venueId: string | null;
  privateCity: string | null;
  privateLocality: string | null;
  organizerId: string;
  venue: { id: string; name: string; city: string } | null;
  organizer: { id: string; brandName: string };
  tiers: LiveTicketTier[];
}
export interface LiveEventInput {
  id?: string;
  organizerId: string;
  title: string;
  description?: string;
  category?: string;
  subCategory?: string;
  ageLimit?: string;
  date?: string;
  durationHrs?: number;
  venueId?: string;
  privateCity?: string;
  privateLocality?: string;
  status?: 'draft' | 'pending';
  conditions?: string[];
  rules?: LivePartyRule[];
  lineup?: LiveLineupItem[];
  posterHue?: number;
  seo?: LiveSeo;
  promoterConfig?: LivePromoterConfig;
  galleryUrls?: string[];
  teaserVideoUrl?: string | null;
  socialBanners?: { postUrl?: string; storyUrl?: string };
  tiers?: { id?: string; name: string; price: number; quantity: number; description?: string; includes?: string[] }[];
}
export const liveEvents = {
  list: (status?: string) => liveFetch<LiveEvent[]>('/admin/events' + (status ? `?status=${status}` : '')),
  create: (body: LiveEventInput) => liveFetch<LiveEvent>('/admin/events', { body }),
  update: (id: string, body: Omit<LiveEventInput, 'id'>) => liveFetch<LiveEvent>(`/admin/events/${id}`, { method: 'PATCH', body }),
  approve: (id: string) => liveFetch<LiveEvent>(`/admin/events/${id}/approve`, { method: 'POST' }),
  reject: (id: string, reason: string) => liveFetch<LiveEvent>(`/admin/events/${id}/reject`, { method: 'POST', body: { reason } }),
  setCommission: (id: string, commission: number | null) => liveFetch<LiveEvent>(`/admin/events/${id}/commission`, { method: 'PATCH', body: { commission } }),
  setPaidOut: (id: string, paidOut: boolean) => liveFetch<LiveEvent>(`/admin/events/${id}/paid-out`, { method: 'PATCH', body: { paidOut } }),
  setSalesPaused: (id: string, paused: boolean) => liveFetch<LiveEvent>(`/admin/events/${id}/pause-sales`, { method: 'PATCH', body: { paused } }),
  setPoster: (id: string, posterUrl: string | null) => liveFetch<LiveEvent>(`/admin/events/${id}/poster`, { method: 'PATCH', body: { posterUrl } }),
};

export const liveMedia = {
  upload: async (file: File): Promise<{ url: string }> => {
    const token = getLiveToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_URL}/admin/media/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) throw new LiveApiError(res.status, 'Upload failed');
    return res.json();
  },
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

/** KYC documents are served outside the /v1 prefix (see main.ts); older rows
 * (saved before StorageService started returning an absolute URL) still have
 * a bare "/uploads/…" path, so resolve those against the API origin here. */
export function resolveDocUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return (API_URL ?? '').replace(/\/v1\/?$/, '') + path;
}

export interface LiveBooking {
  id: string;
  userId: string;
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
/** Full profile — admin-only detail view (GET /admin/customers/:id).
 * Organizers never get this shape; they only ever see the basic
 * name/gender/whatsapp Booking.guests already carries. */
export interface LiveCustomerDetail extends LiveCustomer {
  state?: string;
  country?: string;
  pincode?: string;
  dob?: string;
  profession?: string;
  languages?: string;
  bio?: string;
  socialLinks: Record<string, string>;
  interests: string[];
  avatarUrl?: string;
  phoneVerified: boolean;
  idVerified: boolean;
  profilePct: number;
  joined: string;
  blocked: boolean;
}
export const liveCustomers = {
  list: (segment?: 'guests' | 'organizers') => liveFetch<LiveCustomer[]>('/admin/customers' + (segment ? `?segment=${segment}` : '')),
  get: (id: string) => liveFetch<LiveCustomerDetail>(`/admin/customers/${id}`),
  create: (body: { name: string; phone: string; email?: string; city?: string; gender?: string; verified?: boolean }) =>
    liveFetch<LiveCustomer>('/admin/customers', { body }),
  setBlocked: (id: string, blocked: boolean) => liveFetch<{ ok: true }>(`/admin/customers/${id}/block`, { method: 'PATCH', body: { blocked } }),
};

export interface LiveOrganizer {
  id: string; brandName: string; username: string; verified: boolean; city: string;
  state: string | null; country: string | null; pincode: string | null; since: string;
  rating: number; reviewCount: number; eventsHosted: number; followers: number; following: number;
  about: string; logoHue: number; contact: string; contactPerson: string | null; phone: string | null;
  eventTypes: string | null; socialLinks: { instagram?: string; facebook?: string; other?: string[] } | null; gstin: string | null; pan: string | null;
  bankLast4: string | null; seo: Seo | null;
}
export interface LivePromoter {
  id: string; slug: string; name: string; verified: boolean; city: string; bio: string; links: string[];
  followers: number; eventsPromoted: number; guestsBrought: number; showRate: number; planId: string;
  contact: string | null; seo: Seo | null;
}
export interface LiveLineup {
  id: string; slug: string; name: string; category: string; verified: boolean; city: string;
  state: string | null; country: string | null; pincode: string | null; bio: string; logoUrl: string | null;
  links: string[]; followers: number; eventsPlayed: number; hue: number; emoji: string; seo: Seo | null;
}
export interface LiveVenue {
  id: string; name: string; verified: boolean; type: string; locality: string; city: string;
  state: string | null; country: string | null; pincode: string | null; pendingCity: string | null;
  address: string;
  capacity: number; rating: number; followers: number; amenities: string[]; about: string; timings: string | null;
  photoHue: number; license: string | null; contact: string | null; rules: string | null; seo: Seo | null;
  contactPerson: string | null; contactPersonPhone: string | null;
  socialLinks: { instagram?: string; facebook?: string; other?: string[] } | null;
  logoUrl: string | null; galleryUrls: string[];
}

export interface LiveOrgStaffMember {
  id: string; name: string; phone: string | null; roleName: string; scan: boolean; userId: string | null; createdAt: string;
}
export const liveOrganizers = {
  list: () => liveFetch<LiveOrganizer[]>('/admin/organizers'),
  create: (body: { brandName: string; city?: string; state?: string; country?: string; pincode?: string; contact?: string }) => liveFetch<LiveOrganizer>('/admin/organizers', { body }),
  update: (id: string, body: Partial<LiveOrganizer>) => liveFetch<LiveOrganizer>(`/admin/organizers/${id}`, { method: 'PATCH', body }),
  setVerified: (id: string, verified: boolean) => liveFetch<LiveOrganizer>(`/admin/organizers/${id}/verify`, { method: 'POST', body: { verified } }),
  team: (id: string) => liveFetch<LiveOrgStaffMember[]>(`/admin/organizers/${id}/team`),
  removeTeamMember: (id: string, staffId: string) => liveFetch<{ ok: true }>(`/admin/organizers/${id}/team/${staffId}`, { method: 'DELETE' }),
};
export const livePromoters = {
  list: () => liveFetch<LivePromoter[]>('/admin/promoters'),
  create: (body: { name: string; city?: string; contact?: string }) => liveFetch<LivePromoter>('/admin/promoters', { body }),
  update: (id: string, body: Partial<LivePromoter>) => liveFetch<LivePromoter>(`/admin/promoters/${id}`, { method: 'PATCH', body }),
  setVerified: (id: string, verified: boolean) => liveFetch<LivePromoter>(`/admin/promoters/${id}/verify`, { method: 'POST', body: { verified } }),
};
export const liveVenues = {
  list: () => liveFetch<LiveVenue[]>('/admin/venues'),
  create: (body: { name: string; city: string; state?: string; country?: string; pincode?: string; address?: string; capacity?: number; type?: string }) => liveFetch<LiveVenue>('/admin/venues', { body }),
  update: (id: string, body: Partial<LiveVenue>) => liveFetch<LiveVenue>(`/admin/venues/${id}`, { method: 'PATCH', body }),
  setVerified: (id: string, verified: boolean) => liveFetch<LiveVenue>(`/admin/venues/${id}/verify`, { method: 'POST', body: { verified } }),
  approveCityChange: (id: string) => liveFetch<LiveVenue>(`/admin/venues/${id}/city-change/approve`, { method: 'POST' }),
  rejectCityChange: (id: string) => liveFetch<LiveVenue>(`/admin/venues/${id}/city-change/reject`, { method: 'POST' }),
};
export const liveLineups = {
  list: () => liveFetch<LiveLineup[]>('/admin/lineups'),
  create: (body: { name: string; category?: string; city?: string; state?: string; country?: string; pincode?: string }) => liveFetch<LiveLineup>('/admin/lineups', { body }),
  update: (id: string, body: Partial<LiveLineup>) => liveFetch<LiveLineup>(`/admin/lineups/${id}`, { method: 'PATCH', body }),
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

export const FUNNEL_STAGES = [
  { type: 'event_viewed', label: 'Viewed an event' },
  { type: 'book_clicked', label: 'Clicked "Book"' },
  { type: 'otp_requested', label: 'Requested OTP' },
  { type: 'otp_verified', label: 'Logged in' },
  { type: 'checkout_viewed', label: 'Reached checkout' },
  { type: 'payment_widget_opened', label: 'Opened payment' },
  { type: 'payment_submitted', label: 'Submitted payment' },
  { type: 'booking_completed', label: 'Booking completed' },
] as const;
export interface FunnelStageCount {
  type: string;
  sessions: number;
}
export interface LiveFunnel {
  stages: FunnelStageCount[];
  totalEvents: number;
}
export const liveFunnel = {
  get: (params: { from?: string; to?: string; eventId?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.eventId) q.set('eventId', params.eventId);
    const qs = q.toString();
    return liveFetch<LiveFunnel>('/admin/funnel' + (qs ? `?${qs}` : ''));
  },
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
  /** Records a real transfer you already made yourself — there's no bank
   * integration behind this, so it never moves money or invents a UTR. */
  markPaid: (eventId: string, utr: string) => liveFetch<{ id: string; paidOut: boolean; payoutUtr: string | null }>('/admin/payments/mark-paid', { body: { eventId, utr } }),
};

export const LEAD_SOURCES = ['Instagram', 'WhatsApp', 'Phone call', 'Referral / walk-in', 'Website inquiry', 'Other social', 'Other'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_STAGES = ['New', 'Contacted', 'Interested', 'Negotiating', 'Signed up', 'Declined'] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export interface LeadActivity {
  id: string;
  leadId: string;
  text: string;
  createdAt: string;
}
export interface Lead {
  id: string;
  name: string;
  source: string;
  contact: string | null;
  email: string | null;
  contactPerson: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  eventType: string | null;
  stage: string;
  followUpAt: string | null;
  followUpDone: boolean;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  organizerId: string | null;
  organizer: { id: string; brandName: string; username: string } | null;
  activities: LeadActivity[];
  createdAt: string;
  updatedAt: string;
}
export interface LeadOrganizerHit {
  id: string;
  brandName: string;
  username: string;
  city: string;
}
/** Organizer sales pipeline — pre-signup leads across every outreach channel,
 * not just Instagram. `link-organizer` is a manual, staff-picked match (no
 * reliable way to auto-match a scribbled phone number or IG handle to the
 * account someone actually signs up with), which is what makes it possible
 * to later ask "which source actually converts organizers." */
interface LeadWriteFields {
  name: string;
  source: string;
  contact?: string;
  email?: string;
  contactPerson?: string;
  country?: string;
  state?: string;
  city?: string;
  eventType?: string;
  assignedToId?: string;
  followUpAt?: string;
}
export const liveLeads = {
  list: () => liveFetch<Lead[]>('/admin/leads'),
  get: (id: string) => liveFetch<Lead>(`/admin/leads/${id}`),
  create: (body: LeadWriteFields) => liveFetch<Lead>('/admin/leads', { body }),
  update: (
    id: string,
    body: Partial<Omit<LeadWriteFields, 'assignedToId' | 'followUpAt'>> & { stage?: string; assignedToId?: string | null; followUpAt?: string | null },
  ) => liveFetch<Lead>(`/admin/leads/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => liveFetch<{ ok: true }>(`/admin/leads/${id}`, { method: 'DELETE' }),
  addActivity: (id: string, text: string) => liveFetch<LeadActivity>(`/admin/leads/${id}/activity`, { body: { text } }),
  searchOrganizers: (q: string) => liveFetch<LeadOrganizerHit[]>(`/admin/leads/organizer-search?q=${encodeURIComponent(q)}`),
  linkOrganizer: (id: string, organizerId: string) => liveFetch<Lead>(`/admin/leads/${id}/link-organizer`, { body: { organizerId } }),
  /** Real onboarding-link send (email is guaranteed-delivered; WhatsApp is
   * best-effort until the new 'lead_onboarding_invite' AiSensy campaign is
   * approved — see LeadsService.sendOnboardingLink). */
  sendOnboarding: (id: string, channels: { email?: boolean; whatsapp?: boolean }) =>
    liveFetch<{ ok: true; sent: string[] }>(`/admin/leads/${id}/send-onboarding`, { body: channels }),
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
  'Careers', 'Reels', 'Promo codes', 'Gate check-in', 'Reports', 'Leads',
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
  socials: { instagram: string; x: string; youtube: string; whatsapp: string; facebook: string };
  siteSeo: Seo;
  contact: { email: string; phone: string; address: string; organizerEmail: string };
  footerCopyright: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}
export const liveSettings = {
  get: () => liveFetch<LiveSettings>('/admin/settings'),
  update: (body: Partial<LiveSettings>) => liveFetch<LiveSettings>('/admin/settings', { method: 'PATCH', body }),
};

/** The public branding fields only, via the same unauthenticated GET /settings
 * prebooze-web's usePlatformInfo already reads — lets pre-login admin pages
 * (Login) show the admin-uploaded logo without needing a staff session yet. */
export const livePublicBranding = {
  get: () => liveFetch<{ logoUrl: string | null; faviconUrl: string | null }>('/settings'),
};

export interface LiveBanner {
  id: string; title: string; statusLabel: string; heading: string | null; description: string | null;
  ctaLabel: string | null; ctaLink: string | null; imageUrl: string | null; active: boolean; sort: number;
}
export interface LiveBlogCategory { id: string; name: string; bannerUrl: string | null; seo: Seo | null; }
export interface LiveBlog {
  id: string; title: string; meta: string; status: string; category: string | null;
  content: string | null; bannerUrl: string | null; seo: Seo | null; createdAt: string; updatedAt: string;
}
export interface LiveSitePage { slug: string; title: string; content: string | null; navGroup: string | null; seo: Seo | null; }
export interface LiveTestimonial { id: string; author: string; location: string; rating: number; quote: string; featured: boolean; }
export interface LiveFaq { id: string; question: string; answer: string; audience: string; sort: number; }
export interface LivePolicy { id: string; title: string; slug: string; sections: { heading: string; body: string }[]; seo: Seo | null; updatedAt: string; }
export interface LiveMenu { header: { label: string; to: string }[]; footer: { title: string; links: { label: string; to: string }[] }[]; }

export const liveBanners = {
  list: () => liveFetch<LiveBanner[]>('/admin/banners'),
  create: (body: { title: string; heading?: string; description?: string; ctaLabel?: string; ctaLink?: string; imageUrl?: string; statusLabel?: string; active?: boolean }) =>
    liveFetch<LiveBanner>('/admin/banners', { body }),
  update: (id: string, body: Partial<LiveBanner>) => liveFetch<LiveBanner>(`/admin/banners/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => liveFetch<{ ok: true }>(`/admin/banners/${id}`, { method: 'DELETE' }),
};
export const liveBlogCategories = {
  list: () => liveFetch<LiveBlogCategory[]>('/admin/blog-categories'),
  create: (body: { name: string; bannerUrl?: string; seo?: Seo }) => liveFetch<LiveBlogCategory>('/admin/blog-categories', { body }),
  remove: (id: string) => liveFetch<{ ok: true }>(`/admin/blog-categories/${id}`, { method: 'DELETE' }),
};
export const liveBlogs = {
  list: () => liveFetch<LiveBlog[]>('/admin/blogs'),
  create: (body: { title: string; status?: string; category?: string; content?: string; bannerUrl?: string; seo?: Seo; meta?: string }) =>
    liveFetch<LiveBlog>('/admin/blogs', { body }),
  update: (id: string, body: Partial<LiveBlog>) => liveFetch<LiveBlog>(`/admin/blogs/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => liveFetch<{ ok: true }>(`/admin/blogs/${id}`, { method: 'DELETE' }),
};
export const livePages = {
  list: () => liveFetch<LiveSitePage[]>('/admin/pages'),
  create: (body: { slug: string; title: string; content?: string; navGroup?: string; seo?: Seo }) => liveFetch<LiveSitePage>('/admin/pages', { body }),
  update: (slug: string, body: Partial<LiveSitePage>) => liveFetch<LiveSitePage>(`/admin/pages/${encodeURIComponent(slug)}`, { method: 'PATCH', body }),
  remove: (slug: string) => liveFetch<{ ok: true }>(`/admin/pages/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
};
export const liveTestimonials = {
  list: () => liveFetch<LiveTestimonial[]>('/admin/testimonials'),
  create: (body: { author: string; location: string; rating: number; quote: string }) => liveFetch<LiveTestimonial>('/admin/testimonials', { body }),
  update: (id: string, body: Partial<LiveTestimonial>) => liveFetch<LiveTestimonial>(`/admin/testimonials/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => liveFetch<{ ok: true }>(`/admin/testimonials/${id}`, { method: 'DELETE' }),
};
export const liveFaqs = {
  list: () => liveFetch<LiveFaq[]>('/admin/faqs'),
  create: (body: { question: string; answer: string; audience: string }) => liveFetch<LiveFaq>('/admin/faqs', { body }),
  update: (id: string, body: Partial<LiveFaq>) => liveFetch<LiveFaq>(`/admin/faqs/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => liveFetch<{ ok: true }>(`/admin/faqs/${id}`, { method: 'DELETE' }),
};
export const livePolicies = {
  list: () => liveFetch<LivePolicy[]>('/admin/policies'),
  create: (body: { title: string; slug: string; sections?: { heading: string; body: string }[]; seo?: Seo }) => liveFetch<LivePolicy>('/admin/policies', { body }),
  update: (id: string, body: { sections?: { heading: string; body: string }[]; seo?: Seo }) => liveFetch<LivePolicy>(`/admin/policies/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => liveFetch<{ ok: true }>(`/admin/policies/${id}`, { method: 'DELETE' }),
};
export const liveMenu = {
  get: () => liveFetch<LiveMenu>('/admin/menu'),
  update: (body: LiveMenu) => liveFetch<LiveMenu>('/admin/menu', { method: 'PATCH', body }),
};

export interface LiveCategory { name: string; icon: string; imageUrl: string | null; seo: Seo | null; subs: string[]; sort: number; }
export const liveCategories = {
  list: () => liveFetch<LiveCategory[]>('/admin/categories'),
  add: (name: string, icon?: string) => liveFetch<LiveCategory>('/admin/categories', { body: { name, icon } }),
  update: (name: string, body: { icon?: string; imageUrl?: string; seo?: Seo; subs?: string[]; sort?: number }) =>
    liveFetch<LiveCategory>(`/admin/categories/${encodeURIComponent(name)}`, { method: 'PATCH', body }),
  remove: (name: string) => liveFetch<{ ok: true }>(`/admin/categories/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};

export interface LiveTrendingTerm { term: string; sort: number; }
export const liveTrending = {
  list: () => liveFetch<LiveTrendingTerm[]>('/admin/trending'),
  add: (term: string) => liveFetch<LiveTrendingTerm>('/admin/trending', { body: { term } }),
  reorder: (term: string, sort: number) =>
    liveFetch<LiveTrendingTerm>(`/admin/trending/${encodeURIComponent(term)}`, { method: 'PATCH', body: { sort } }),
  remove: (term: string) => liveFetch<{ ok: true }>(`/admin/trending/${encodeURIComponent(term)}`, { method: 'DELETE' }),
};

export interface LiveVenueType { name: string; icon: string | null; sort: number; events: number; }
export const liveVenueTypes = {
  list: () => liveFetch<LiveVenueType[]>('/admin/venue-types'),
  add: (name: string, icon?: string) => liveFetch<LiveVenueType>('/admin/venue-types', { body: { name, icon } }),
  update: (name: string, body: { icon?: string; sort?: number }) =>
    liveFetch<LiveVenueType>(`/admin/venue-types/${encodeURIComponent(name)}`, { method: 'PATCH', body }),
  remove: (name: string) => liveFetch<{ ok: true }>(`/admin/venue-types/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};

export interface LivePromo {
  id: string;
  code: string;
  type: 'percent' | 'flat';
  value: number;
  maxDiscount: number | null;
  usageLimit: number;
  used: number;
  perUserLimit: number;
  eventScope: string;
  validTill: string;
  firstTimeOnly: boolean;
  gender: string;
  description: string | null;
  status: string;
}
export const livePromos = {
  list: () => liveFetch<LivePromo[]>('/admin/promos'),
  create: (body: {
    code: string; type: 'percent' | 'flat'; value: number; maxDiscount?: number; usageLimit?: number;
    perUserLimit?: number; eventScope?: string; validTill?: string; firstTimeOnly?: boolean; gender?: string; description?: string;
  }) => liveFetch<LivePromo>('/admin/promos', { body }),
  update: (code: string, body: {
    value?: number; maxDiscount?: number; usageLimit?: number; perUserLimit?: number; eventScope?: string;
    validTill?: string; firstTimeOnly?: boolean; gender?: string; status?: 'active' | 'paused'; description?: string;
  }) => liveFetch<LivePromo>(`/admin/promos/${code}`, { method: 'PATCH', body }),
  remove: (code: string) => liveFetch<{ ok: true }>(`/admin/promos/${code}`, { method: 'DELETE' }),
};

export interface LiveReel { id: string; title: string; hue: number; active: boolean; videoUrl: string | null; }
export const liveReels = {
  list: () => liveFetch<LiveReel[]>('/admin/reels'),
  create: (body: { title: string; videoUrl?: string }) => liveFetch<LiveReel>('/admin/reels', { body }),
  toggle: (id: string) => liveFetch<LiveReel>(`/admin/reels/${id}/toggle`, { method: 'POST' }),
  remove: (id: string) => liveFetch<{ ok: true }>(`/admin/reels/${id}`, { method: 'DELETE' }),
};

export interface LiveReview { id: string; rating: number; text: string; createdAt: string; user: { name: string; phone: string }; organizerId: string; organizerName: string; }
export const liveReviews = {
  list: (organizerId?: string) => liveFetch<LiveReview[]>('/admin/reviews' + (organizerId ? `?organizerId=${organizerId}` : '')),
  update: (id: string, body: { rating?: number; text?: string }) => liveFetch<LiveReview>(`/admin/reviews/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => liveFetch<{ ok: true }>(`/admin/reviews/${id}`, { method: 'DELETE' }),
};

export interface LiveCity { name: string; icon: string | null; top: boolean; enabled: boolean; }
export interface LiveState { id: string; name: string; enabled: boolean; cities: LiveCity[]; }
export interface LiveCountry { id: string; name: string; enabled: boolean; states: LiveState[]; }
export const liveLocations = {
  tree: () => liveFetch<LiveCountry[]>('/admin/locations'),
  addCountry: (name: string) => liveFetch<LiveCountry>('/admin/locations/countries', { body: { name } }),
  addState: (countryId: string, name: string) => liveFetch<LiveState>('/admin/locations/states', { body: { countryId, name } }),
  addCity: (stateId: string, name: string) => liveFetch<LiveCity>('/admin/locations/cities', { body: { stateId, name } }),
  toggleCountry: (id: string) => liveFetch<{ ok: true; enabled: boolean }>(`/admin/locations/countries/${id}/toggle`, { method: 'POST' }),
  toggleState: (id: string) => liveFetch<{ ok: true; enabled: boolean }>(`/admin/locations/states/${id}/toggle`, { method: 'POST' }),
  toggleCity: (name: string) => liveFetch<LiveCity>(`/admin/locations/cities/${encodeURIComponent(name)}/toggle`, { method: 'POST' }),
  updateCity: (name: string, patch: { icon?: string; top?: boolean }) => liveFetch<LiveCity>(`/admin/locations/cities/${encodeURIComponent(name)}`, { method: 'PATCH', body: patch }),
  removeCountry: (id: string) => liveFetch<{ ok: true }>(`/admin/locations/countries/${id}`, { method: 'DELETE' }),
  removeState: (id: string) => liveFetch<{ ok: true }>(`/admin/locations/states/${id}`, { method: 'DELETE' }),
  removeCity: (name: string) => liveFetch<{ ok: true }>(`/admin/locations/cities/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};

export interface LiveJob { id: string; title: string; team: string; loc: string; type: string; status: string; about: string; }
export interface LiveApplicant { id: string; jobId: string; name: string; email: string; phone: string; note: string; appliedAt: string; }
export interface LiveCareerTeam { name: string }
export const liveCareers = {
  listJobs: () => liveFetch<LiveJob[]>('/admin/careers/jobs'),
  createJob: (body: { title: string; team?: string; loc?: string; type?: string; about?: string }) => liveFetch<LiveJob>('/admin/careers/jobs', { body }),
  updateJob: (id: string, patch: { title?: string; team?: string; loc?: string; type?: string; about?: string }) =>
    liveFetch<LiveJob>(`/admin/careers/jobs/${id}`, { method: 'PATCH', body: patch }),
  toggleJob: (id: string) => liveFetch<LiveJob>(`/admin/careers/jobs/${id}/toggle`, { method: 'POST' }),
  removeJob: (id: string) => liveFetch<{ ok: true }>(`/admin/careers/jobs/${id}`, { method: 'DELETE' }),
  listApplicants: (jobId?: string) => liveFetch<LiveApplicant[]>('/admin/careers/applicants' + (jobId ? `?jobId=${jobId}` : '')),
  listTeams: () => liveFetch<LiveCareerTeam[]>('/admin/careers/teams'),
  addTeam: (name: string) => liveFetch<LiveCareerTeam>('/admin/careers/teams', { body: { name } }),
};

export interface LiveReferralRow {
  code: string;
  referrer: string;
  referrerPhone: string;
  referee: string;
  refereePhone: string;
  status: string;
  createdAt: string;
}
export interface LiveReferralAnalytics {
  totalReferrals: number;
  qualified: number;
  conversion: number;
  creditsIssued: number;
  topReferrers: { name: string; joined: number; qualified: number }[];
  referrals: LiveReferralRow[];
}
export const liveReferrals = {
  analytics: () => liveFetch<LiveReferralAnalytics>('/admin/referrals'),
  rates: () => liveFetch<{ referee: number; referrer: number }>('/admin/referrals/rates'),
  updateRates: (body: { referee?: number; referrer?: number }) => liveFetch<{ referee: number; referrer: number }>('/admin/referrals/rates', { method: 'PATCH', body }),
};

export interface LiveInvoice {
  id: string;
  number: string;
  type: string;
  role: string;
  refId: string;
  payerName: string;
  payerEmail: string | null;
  payerPhone: string | null;
  city: string | null;
  description: string;
  subtotal: number;
  gstPct: number;
  gstAmount: number;
  total: number;
  status: string;
  issuedAt: string;
  lastSentAt: string | null;
}
export const liveInvoices = {
  list: (filters?: { role?: string; city?: string; type?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams();
    Object.entries(filters ?? {}).forEach(([k, v]) => { if (v) q.set(k, v); });
    const qs = q.toString();
    return liveFetch<LiveInvoice[]>('/admin/invoices' + (qs ? `?${qs}` : ''));
  },
  get: (id: string) => liveFetch<LiveInvoice>(`/admin/invoices/${id}`),
  downloadPdf: async (id: string, filename: string) => {
    const token = getLiveToken();
    const res = await fetch(`${API_URL}/admin/invoices/${id}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new LiveApiError(res.status, 'Failed to download PDF');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  resendEmail: (id: string) => liveFetch<{ ok: true }>(`/admin/invoices/${id}/resend-email`, { method: 'POST' }),
  resendWhatsapp: (id: string) => liveFetch<{ ok: true }>(`/admin/invoices/${id}/resend-whatsapp`, { method: 'POST' }),
};

export interface LiveEmailTemplate {
  id: string;
  name: string;
  category: string;
  trigger: string;
  tokens: string[];
  hasCta: boolean;
  ctaLabel?: string;
  subject: string;
  bodyHtml: string;
  defaultSubject: string;
  defaultBody: string;
  customized: boolean;
  custom: boolean;
}
export const liveEmailTemplates = {
  list: () => liveFetch<LiveEmailTemplate[]>('/admin/email-templates'),
  create: (body: { name: string; subject: string; bodyHtml: string }) => liveFetch<LiveEmailTemplate>('/admin/email-templates', { body }),
  preview: (id: string) => liveFetch<{ subject: string; html: string }>(`/admin/email-templates/${id}/preview`),
  update: (id: string, patch: { subject?: string; bodyHtml?: string }) => liveFetch<LiveEmailTemplate>(`/admin/email-templates/${id}`, { method: 'PATCH', body: patch }),
  reset: (id: string) => liveFetch<{ ok: true }>(`/admin/email-templates/${id}`, { method: 'DELETE' }),
  sendNow: (id: string, to: string) => liveFetch<{ ok: true }>(`/admin/email-templates/${id}/send`, { method: 'POST', body: { to } }),
};

export interface LiveGuestListEntry {
  id: string;
  eventId: string;
  name: string;
  phone: string;
  plusOnes: number;
  companions: { name: string; phone: string }[];
  addedBy: string;
  arrived: boolean;
}
export const liveGuestList = {
  list: (eventId: string) => liveFetch<{ entries: LiveGuestListEntry[]; namesCount: number; totalHeads: number; arrived: number }>(`/admin/events/${eventId}/guest-list`),
  add: (eventId: string, body: { name: string; phone: string; plusOnes?: number; companions?: { name: string; phone: string }[] }) =>
    liveFetch<LiveGuestListEntry>(`/admin/events/${eventId}/guest-list`, { body }),
  toggleArrived: (id: string) => liveFetch<LiveGuestListEntry>(`/admin/guest-list/${id}/toggle-arrived`, { method: 'POST' }),
  remove: (id: string) => liveFetch<{ ok: true }>(`/admin/guest-list/${id}`, { method: 'DELETE' }),
};

export interface LiveCart { id: string; guest: string; phone: string; eventId: string; eventTitle: string; amount: number; reminded: boolean; createdAt: string; }
export interface LiveCartStats { openCount: number; recoverable: number; recoveredCount: number; recoveredValue: number; recoveryRate: number; }
export const liveCarts = {
  list: (eventId?: string) => liveFetch<LiveCart[]>('/admin/carts' + (eventId ? `?eventId=${eventId}` : '')),
  stats: () => liveFetch<LiveCartStats>('/admin/carts/stats'),
  remind: (id: string) => liveFetch<{ ok: true }>(`/admin/carts/${id}/remind`, { method: 'POST' }),
  bulkRemind: (ids: string[]) => liveFetch<{ ok: true; count: number }>('/admin/carts/bulk-remind', { body: { ids } }),
};

export interface LiveMonitor {
  total: number;
  checkedIn: number;
  remaining: number;
  pct: number;
  rejected: number;
  scanRate: number;
  histogram: number[];
  feed: { ok: boolean; text: string; at: string }[];
  salesPaused: boolean;
}
export const liveLiveMonitor = {
  get: (eventId: string) => liveFetch<LiveMonitor>(`/admin/events/${eventId}/live`),
  checkIn: (eventId: string, name: string, count?: number) => liveFetch<unknown>(`/admin/events/${eventId}/live/check-in`, { body: { name, count } }),
};

export const liveManualBooking = {
  create: (body: {
    eventId: string; tierId: string; qty: number; guestName: string; phone: string; gender?: string;
    others?: { name: string; gender?: string; whatsapp?: string }[]; method: string;
  }) => liveFetch<LiveBooking>('/admin/bookings', { body }),
};

export interface LiveNotification {
  id: string;
  icon: string;
  text: string;
  to: string | null;
  read: boolean;
  createdAt: string;
}
export const liveNotifications = {
  list: () => liveFetch<LiveNotification[]>('/admin/notifications'),
  markRead: (id: string) => liveFetch<LiveNotification>(`/admin/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => liveFetch<{ ok: true }>('/admin/notifications/mark-all-read', { method: 'POST' }),
};

export { LiveApiError };
