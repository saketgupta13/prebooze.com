/** Typed API surface — one function per backend endpoint (see BACKEND.md).
 * These are the real connections: point VITE_API_URL at the server and every
 * feature swaps from localStorage to live data. */
import { apiFetch, apiUpload, API_URL, getToken, ApiError } from './client';
import type {
  Booking, CareerJob, CmsBlog, CmsBlogSummary, CmsFaq, CmsPolicy, CmsPolicySummary, CmsTestimonial, Coupon, Event, Featured, HelpTicket,
  Invoice, JobApplication, LineupProfile, Organizer, PayMethod, Person, PersonDetail, PromoterProfile, User, Venue, WaitlistEntry,
} from '../types';
import type { CartRecord, GuestReview, PromoterGuest, Referral, SubPromoter, WalletTx } from '../store/AppContext';

// ---------- auth ----------
export const auth = {
  requestOtp: (phone: string) => apiFetch<{ requestId: string }>('/auth/otp', { body: { phone } }),
  verifyOtp: (requestId: string, code: string) => apiFetch<{ token: string; user: User; isNew: boolean }>('/auth/verify', { body: { requestId, code } }),
  me: () => apiFetch<User>('/me'),
  updateMe: (patch: Partial<User>) => apiFetch<User>('/me', { method: 'PATCH', body: patch }),
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<{ url: string }>('/me/upload', form);
  },
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
  requestPhoneChange: (newPhone: string) => apiFetch<{ requestId: string; devCode?: string }>('/me/phone/request-change', { body: { newPhone } }),
  confirmPhoneChange: (requestId: string, code: string) => apiFetch<User>('/me/phone/confirm-change', { body: { requestId, code } }),
  /** Awards (or, if already claimed, just re-returns) the one-time 10%-off
   * coupon for finishing the soft-required "complete your profile" step. */
  claimProfileReward: () => apiFetch<{ code: string; maxDiscount: number; validTill: string; alreadyClaimed: boolean }>('/me/complete-profile-reward', { method: 'POST' }),
};

// ---------- identity & role verification ----------
// Guest ID verification is automatic (OCR + face-match). Organizer/promoter/
// lineup/venue applications are always manual — a human on the team reviews
// every one in the admin panel; submitting never grants the role directly.
// See BACKEND.md "Identity & KYC".
export const kyc = {
  submitGuest: (idDoc: File, selfie: File) => {
    const form = new FormData();
    form.append('idDoc', idDoc);
    form.append('selfie', selfie);
    return apiUpload<{ status: 'approved' | 'rejected'; score: number; reason?: string }>('/kyc/guest', form);
  },
  submitRole: (kind: 'organizer' | 'promoter' | 'lineup' | 'venue', payload: Record<string, unknown>, documents: File[]) => {
    const form = new FormData();
    form.append('kind', kind);
    form.append('payload', JSON.stringify(payload));
    documents.forEach((f) => form.append('documents', f));
    return apiUpload<{ status: 'pending'; user: User }>('/kyc/role', form);
  },
  myStatus: () => apiFetch<{ id: string; kind: string; status: string; createdAt: string; reviewNote?: string }[]>('/kyc/me'),
};

// ---------- discovery ----------
export const catalog = {
  events: (q: { city?: string; cat?: string; sub?: string; search?: string; sort?: string; organizerId?: string; venueId?: string; includePast?: boolean }) => apiFetch<Event[]>('/events', { query: q }),
  event: (slug: string) => apiFetch<Event>(`/events/${slug}`),
  venues: (city?: string) => apiFetch<Venue[]>('/venues', { query: { city } }),
  venue: (id: string) => apiFetch<Venue>(`/venues/${id}`),
  venueSeo: (id: string) => apiFetch<{ title: string; description: string; keywords: string }>(`/venues/${id}/seo`),
  organizers: (city?: string) => apiFetch<Organizer[]>('/organizers', { query: { city } }),
  organizer: (id: string) => apiFetch<Organizer>(`/organizers/${id}`),
  organizerSeo: (id: string) => apiFetch<{ title: string; description: string; keywords: string }>(`/organizers/${id}/seo`),
  promoters: (city?: string) => apiFetch<PromoterProfile[]>('/promoters', { query: { city } }),
  promoter: (slug: string) => apiFetch<PromoterProfile>(`/promoters/${slug}`),
  promoterSeo: (id: string) => apiFetch<{ title: string; description: string; keywords: string }>(`/promoters/${id}/seo`),
  lineups: (city?: string) => apiFetch<LineupProfile[]>('/lineups', { query: { city } }),
  lineup: (slug: string) => apiFetch<LineupProfile>(`/lineups/${slug}`),
  lineupSeo: (id: string) => apiFetch<{ title: string; description: string; keywords: string }>(`/lineups/${id}/seo`),
  people: (city?: string) => apiFetch<Person[]>('/people', { query: { city } }),
  person: (username: string) => apiFetch<PersonDetail>(`/people/${username}`),
  featured: (city: string) => apiFetch<Featured[]>('/featured', { query: { city } }),
  categories: () => apiFetch<{ name: string; icon: string; subs: string[] }[]>('/categories'),
  cities: () => apiFetch<{ name: string; icon?: string; top: boolean; events: number }[]>('/cities'),
  venueTypes: () => apiFetch<{ name: string; icon?: string; events: number }[]>('/venue-types'),
  search: (q: string) => apiFetch<{ label: string; type: string; to: string }[]>('/search', { query: { q } }),
  trending: () => apiFetch<string[]>('/search/trending'),
  reels: () => apiFetch<{ id: string; title: string; hue: number; videoUrl: string | null }[]>('/reels'),
};

// ---------- CMS content (guest-facing reads of admin's Content section) ----------
export const content = {
  testimonials: (featuredOnly?: boolean) => apiFetch<CmsTestimonial[]>('/testimonials', { query: { featured: featuredOnly } }),
  faqs: (audience?: 'guests' | 'organizers') => apiFetch<CmsFaq[]>('/faqs', { query: { audience } }),
  policies: () => apiFetch<CmsPolicySummary[]>('/policies'),
  policy: (slug: string) => apiFetch<CmsPolicy>(`/policies/${slug}`),
  blogs: () => apiFetch<CmsBlogSummary[]>('/blogs'),
  blog: (id: string) => apiFetch<CmsBlog>(`/blogs/${id}`),
};

// ---------- real organizer/venue reviews (guest-facing) ----------
export interface OrgReview {
  id: string;
  author: string;
  rating: number;
  text: string;
  organizerId: string;
  date: string;
}
export interface VenueReview {
  id: string;
  author: string;
  rating: number;
  text: string;
  venueId: string;
  date: string;
}
export const socialReviews = {
  organizer: (id: string) => apiFetch<OrgReview[]>(`/organizers/${id}/reviews`),
  addOrganizerReview: (id: string, rating: number, text: string) => apiFetch<OrgReview>(`/organizers/${id}/reviews`, { body: { rating, text } }),
  venue: (id: string) => apiFetch<VenueReview[]>(`/venues/${id}/reviews`),
  addVenueReview: (id: string, rating: number, text: string) => apiFetch<VenueReview>(`/venues/${id}/reviews`, { body: { rating, text } }),
};

// ---------- bookings, holds, waitlist ----------
export interface BookingQuote {
  subtotal: number;
  fee: number;
  discount: number;
  walletCreditUsed: number;
  total: number;
  razorpayOrderId?: string;
  razorpayKeyId?: string;
}
export interface CreateBookingInput {
  holdId: string;
  mainGuest: string;
  whatsapp: string;
  guests?: { name: string; gender?: string; whatsapp?: string }[];
  couponCode?: string;
  walletCredit?: number;
  promoterRef?: string;
  payMethodId?: string;
  razorpay?: { orderId: string; paymentId: string; signature: string };
}
export const bookings = {
  hold: (eventId: string, qty: Record<string, number>) => apiFetch<{ holdId: string; expiresAt: string }>('/bookings/hold', { body: { eventId, qty } }),
  quote: (holdId: string, couponCode?: string, walletCredit?: number) =>
    apiFetch<BookingQuote>('/bookings/quote', { body: { holdId, couponCode, walletCredit } }),
  create: (input: CreateBookingInput) => apiFetch<Booking>('/bookings', { body: input }),
  list: () => apiFetch<Booking[]>('/bookings'),
  // booking ids contain a literal "#" (e.g. "#TKT-12345"), which the URL
  // parser treats as a fragment separator if left unencoded — silently
  // truncating the path. Must percent-encode; server-side decodes it back.
  cancel: (id: string, refundTo: 'wallet' | 'source') => apiFetch<Booking>(`/bookings/${encodeURIComponent(id)}/cancel`, { body: { refundTo } }),
  resend: (id: string) => apiFetch<{ ok: true }>(`/bookings/${encodeURIComponent(id)}/resend`, { method: 'POST' }),
  // real route is /bookings/check-in with the QR's signed token in the body
  // — not /bookings/:id/check-in like this used to declare (that endpoint
  // never existed; nothing called this wrapper before now).
  checkIn: (token: string) => apiFetch<Booking>('/bookings/check-in', { body: { token } }),
  waitlistJoin: (eventId: string) => apiFetch<WaitlistEntry>(`/events/${eventId}/waitlist`, { method: 'POST' }),
  waitlist: (eventId: string) => apiFetch<WaitlistEntry[]>(`/events/${eventId}/waitlist`),
};

// ---------- wallet / payments ----------
export const wallet = {
  balance: () => apiFetch<{ balance: number; txs: WalletTx[] }>('/wallet'),
  payMethods: () => apiFetch<PayMethod[]>('/pay-methods'),
  addPayMethod: (m: Omit<PayMethod, 'id' | 'isDefault'> & { cvvToken?: string }) => apiFetch<PayMethod>('/pay-methods', { body: m }),
  removePayMethod: (id: string) => apiFetch<void>(`/pay-methods/${id}`, { method: 'DELETE' }),
  setDefault: (id: string) => apiFetch<void>(`/pay-methods/${id}/default`, { method: 'POST' }),
  setAutoRenew: (on: boolean) => apiFetch<void>('/me/auto-renew', { body: { on } }),
};

// ---------- referrals ----------
export const referrals = {
  mine: () => apiFetch<{ code: string; referrals: Referral[] }>('/referrals'),
  claim: (code: string) => apiFetch<void>('/referrals/claim', { body: { code } }),
};

// ---------- social ----------
export const social = {
  follow: (key: string) => apiFetch<void>('/follows', { body: { key } }),
  unfollow: (key: string) => apiFetch<void>('/follows', { method: 'DELETE', body: { key } }),
  mySocialState: () => apiFetch<{ following: string[]; interested: string[]; wishlist: string[]; favouriteVenues: string[] }>('/me/social'),
  followers: () => apiFetch<Person[]>('/me/followers'),
  setAttendanceVisibility: (v: 'off' | 'followers' | 'public') => apiFetch<void>('/me/attendance-visibility', { body: { v } }),
  interested: (eventId: string, on: boolean) => apiFetch<void>(`/events/${eventId}/interested`, { body: { on } }),
  wishlist: (eventId: string, on: boolean) => apiFetch<void>(`/events/${eventId}/wishlist`, { body: { on } }),
  favVenue: (venueId: string, on: boolean) => apiFetch<void>(`/venues/${venueId}/favourite`, { body: { on } }),
  reviewOrganizer: (orgId: string, rating: number, text: string) => apiFetch<GuestReview>(`/organizers/${orgId}/reviews`, { body: { rating, text } }),
  organizerReviews: (orgId: string) => apiFetch<GuestReview[]>(`/organizers/${orgId}/reviews`),
};

// ---------- subscriptions (organizer / promoter / venue / lineup billing) ----------
// One real, Razorpay-backed billing surface shared by all four roles — see
// SubscriptionsService on the backend. Paid tiers return `shortUrl`, a hosted
// Razorpay authorization link the caller must redirect the owner to; nothing
// actually activates until the `subscription.activated` webhook fires.
export interface SubTier {
  id: string;
  role: 'organizer' | 'promoter' | 'venue' | 'lineup';
  name: string;
  price: number;
  guests: number | null; // promoter-only monthly guest-list quota, -1 = unlimited
}
export interface SubscriptionCharge {
  id: string;
  amount: number;
  status: 'captured' | 'failed';
  occurredAt: string;
}
export interface RoleSubscription {
  id: string;
  role: SubTier['role'];
  entityId: string;
  tierId: string;
  tier: SubTier;
  status: 'created' | 'authenticated' | 'active' | 'pending' | 'halted' | 'cancelled' | 'completed' | 'expired';
  shortUrl: string | null;
  currentStart: string | null;
  currentEnd: string | null;
  paidCount: number;
  charges?: SubscriptionCharge[];
}
export interface SubscribeResult {
  ok: boolean;
  requiresAuthorization: boolean;
  subscriptionId?: string;
  shortUrl?: string;
  keyId?: string;
}
function subscriptionApi(prefix: 'organizer' | 'promoter' | 'venue' | 'lineup') {
  return {
    tiers: () => apiFetch<SubTier[]>(`/${prefix}/subscription/tiers`),
    mine: () => apiFetch<RoleSubscription | null>(`/${prefix}/subscription`),
    subscribe: (tierId: string) => apiFetch<SubscribeResult>(`/${prefix}/subscription`, { body: { tierId } }),
    cancel: () => apiFetch<{ ok: boolean }>(`/${prefix}/subscription/cancel`, { method: 'POST' }),
  };
}

// ---------- promoter ----------
export interface PromoterMe {
  id: string;
  slug: string;
  name: string;
  city: string;
  bio: string;
  links: string[];
  verified: boolean;
  followers: number;
  eventsPromoted: number;
  guestsBrought: number;
  planId: string;
}
export interface PromoterTeamMember extends SubPromoter {
  id: string;
}
export interface PromoterWithdrawal {
  id: string;
  amount: number;
  createdAt: string;
}
export interface LeaderboardRow {
  id: string;
  slug: string;
  name: string;
  verified: boolean;
  followers: number;
  brought: number;
  rate: number | null;
}
export interface PromoterPass extends PromoterGuest {
  event: Event;
}
export const promoter = {
  me: () => apiFetch<PromoterMe>('/promoter/me'),
  updateMe: (patch: { brandName?: string; username?: string; city?: string }) =>
    apiFetch<{ id: string; name: string; slug: string; city: string }>('/promoter/me', { method: 'PATCH', body: patch }),
  promotions: () => apiFetch<Event[]>('/promoter/promotions'),
  guests: (eventId: string) => apiFetch<PromoterGuest[]>(`/promoter/events/${eventId}/guests`),
  captureGuest: (eventSlug: string, promoterSlug: string, guest: Omit<PromoterGuest, 'id' | 'createdAt' | 'arrived'>) =>
    apiFetch<PromoterGuest>(`/p/${eventSlug}/${promoterSlug}`, { body: guest }),
  pass: (id: string) => apiFetch<PromoterPass>(`/p/pass/${id}`),
  checkInGuest: (id: string) => apiFetch<void>(`/promoter/guests/${id}/check-in`, { method: 'POST' }),
  earnings: () => apiFetch<{ perHead: number; commission: number; withdrawn: number }>('/promoter/earnings'),
  withdraw: (amount: number) => apiFetch<void>('/promoter/withdraw', { body: { amount } }),
  withdrawals: () => apiFetch<PromoterWithdrawal[]>('/promoter/withdrawals'),
  team: () => apiFetch<PromoterTeamMember[]>('/promoter/team'),
  addTeamMember: (m: SubPromoter) => apiFetch<PromoterTeamMember>('/promoter/team', { body: m }),
  removeTeamMember: (id: string) => apiFetch<{ ok: true }>(`/promoter/team/${id}`, { method: 'DELETE' }),
  leaderboard: () => apiFetch<LeaderboardRow[]>('/promoter/leaderboard'),
  usage: () => apiFetch<{ used: number; quota: number }>('/promoter/usage'),
  subscription: subscriptionApi('promoter'),
};

// ---------- organizer ----------
export interface OrgAttendee {
  bookingId: string;
  bookingStatus: string;
  tierName: string;
  name: string;
  gender?: string;
  whatsapp: string;
  checkedIn: boolean;
}
export interface OrgLedgerTx {
  id: string;
  type: 'sale' | 'refund' | 'withdrawal';
  amount: number;
  eventId?: string;
  eventTitle?: string;
  note?: string;
  createdAt: string;
}
export const organizer = {
  me: () => apiFetch<Organizer>('/organizer/me'),
  updateMe: (patch: { brandName?: string; username?: string; city?: string; country?: string; state?: string; pincode?: string; logoUrl?: string; about?: string; socialLinks?: { instagram?: string; facebook?: string; other?: string[] }; gstin?: string; pan?: string; bankAccount?: string; bankName?: string; accountHolderName?: string; ifsc?: string; contact?: string; contactPerson?: string; phone?: string; eventTypes?: string }) =>
    apiFetch<Organizer>('/organizer/me', { method: 'PATCH', body: patch }),
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<{ url: string }>('/organizer/upload', form);
  },
  invoices: () => apiFetch<Invoice[]>('/organizer/invoices'),
  downloadInvoicePdf: async (id: string, filename: string) => {
    const res = await fetch(`${API_URL}/organizer/invoices/${id}/pdf`, { headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} });
    if (!res.ok) throw new ApiError(res.status, 'ERROR', 'Failed to download PDF');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  events: () => apiFetch<Event[]>('/organizer/events'),
  upsertEvent: (e: {
    id?: string; title: string; description?: string; category?: string; subCategory?: string; ageLimit?: string;
    tags?: string[]; date?: string; durationHrs?: number; venueId: string; status?: 'draft' | 'pending';
    conditions?: string[]; rules?: unknown; lineup?: unknown; seo?: unknown; promoterConfig?: unknown;
    posterUrl?: string | null; galleryUrls?: string[]; teaserVideoUrl?: string | null; socialBanners?: { postUrl?: string; storyUrl?: string };
    tiers?: { id?: string; name: string; price: number; quantity: number; includes?: string[]; description?: string }[];
  }) => apiFetch<Event>('/organizer/events', { body: e }),
  attendees: (eventId: string) => apiFetch<OrgAttendee[]>(`/organizer/events/${eventId}/attendees`),
  coupons: () => apiFetch<Coupon[]>('/organizer/coupons'),
  upsertCoupon: (c: Partial<Coupon>) => apiFetch<Coupon>('/organizer/coupons', { body: c }),
  payouts: () => apiFetch<{ balance: number; ledger: OrgLedgerTx[] }>('/organizer/payouts'),
  withdraw: (amount: number) => apiFetch<void>('/organizer/withdraw', { body: { amount } }),
  abandonedCarts: () => apiFetch<CartRecord[]>('/organizer/carts'),
  remindCart: (id: string) => apiFetch<void>(`/organizer/carts/${id}/remind`, { method: 'POST' }),
  // ---- gate ops: guest list, promoter guests, live monitor ----
  guestList: (eventId: string) => apiFetch<{ entries: OrgGuestListEntry[]; namesCount: number; totalHeads: number; arrived: number }>(`/organizer/events/${eventId}/guest-list`),
  addGuestListEntry: (eventId: string, body: { name: string; phone: string; plusOnes?: number; companions?: { name: string; phone: string }[] }) =>
    apiFetch<OrgGuestListEntry>(`/organizer/events/${eventId}/guest-list`, { body }),
  toggleGuestArrived: (id: string) => apiFetch<OrgGuestListEntry>(`/organizer/guest-list/${id}/toggle-arrived`, { method: 'POST' }),
  removeGuestListEntry: (id: string) => apiFetch<{ ok: true }>(`/organizer/guest-list/${id}`, { method: 'DELETE' }),
  promoterGuests: (eventId: string) => apiFetch<OrgPromoterGuest[]>(`/organizer/events/${eventId}/promoter-guests`),
  live: (eventId: string) => apiFetch<OrgLiveMonitor>(`/organizer/events/${eventId}/live`),
  manualCheckIn: (eventId: string, name: string, count?: number) => apiFetch<unknown>(`/organizer/events/${eventId}/check-in`, { body: { name, count } }),
  setSalesPaused: (eventId: string, paused: boolean) => apiFetch<Event>(`/organizer/events/${eventId}/pause-sales`, { method: 'PATCH', body: { paused } }),
};

export interface OrgGuestListEntry {
  id: string;
  eventId: string;
  name: string;
  phone: string;
  plusOnes: number;
  companions: { name: string; phone: string }[];
  addedBy: string;
  arrived: boolean;
  createdAt: string;
}
export interface OrgPromoterGuest {
  id: string;
  eventId: string;
  promoterSlug: string;
  name: string;
  phone: string;
  age?: string;
  gender?: string;
  arrived: boolean;
  arrivedAt?: string;
  createdAt: string;
}
export interface OrgLiveMonitor {
  total: number;
  checkedIn: number;
  remaining: number;
  pct: number;
  scanRate: number;
  rejected: number;
  histogram: number[];
  feed: { ok: boolean; text: string; at: string }[];
  salesPaused: boolean;
}

// ---------- organizer team & roles ----------
export interface OrgStaffMember {
  id: string;
  name: string;
  phone: string | null;
  roleName: string;
  scan: boolean;
  createdAt: string;
}
export type OrgPermKey = 'view' | 'edit';
export type OrgModulePerms = Record<string, Record<OrgPermKey, boolean>>; // module -> {view, edit}
export interface OrgTeamAccess {
  organizerId: string;
  organizerBrand: string;
  organizerLogoUrl: string | null;
  roleName: string;
  permissions: OrgModulePerms;
  scan: boolean;
}
export const orgTeam = {
  /** "Am I on someone's team?" — null if not. Called once after login to
   * decide whether to route a non-owner into a permission-scoped organizer
   * console. */
  mine: () => apiFetch<OrgTeamAccess | null>('/organizer/team/mine'),
  listStaff: () => apiFetch<OrgStaffMember[]>('/organizer/team'),
  addStaff: (body: { name: string; phone: string; email?: string; roleName?: string; scan?: boolean }) => apiFetch<OrgStaffMember>('/organizer/team', { body }),
  updateStaffRole: (id: string, roleName: string) => apiFetch<OrgStaffMember>(`/organizer/team/${id}/role`, { body: { roleName } }),
  removeStaff: (id: string) => apiFetch<{ ok: true }>(`/organizer/team/${id}`, { method: 'DELETE' }),
};
export const orgRoles = {
  list: () => apiFetch<Record<string, OrgModulePerms>>('/organizer/roles'), // roleName -> module -> {view, edit}
  add: (name: string) => apiFetch<unknown>('/organizer/roles', { body: { name } }),
  setPerm: (name: string, module: string, key: OrgPermKey, value: boolean) =>
    apiFetch<unknown>(`/organizer/roles/${encodeURIComponent(name)}/perm`, { body: { module, key, value } }),
  remove: (name: string) => apiFetch<{ ok: true }>(`/organizer/roles/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};

// ---------- lineup (artist) ----------
export const lineup = {
  me: () => apiFetch<LineupProfile>('/lineup/me'),
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<{ url: string }>('/lineup/upload', form);
  },
  updateMe: (patch: { name?: string; category?: string; city?: string; state?: string; country?: string; pincode?: string; bio?: string; links?: string[]; logoUrl?: string; username?: string }) =>
    apiFetch<LineupProfile>('/lineup/me', { method: 'PATCH', body: patch }),
  events: () => apiFetch<(Event & { myRole?: string })[]>('/lineup/events'),
  invoices: () => apiFetch<Invoice[]>('/lineup/invoices'),
  downloadInvoicePdf: async (id: string, filename: string) => {
    const res = await fetch(`${API_URL}/lineup/invoices/${id}/pdf`, { headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} });
    if (!res.ok) throw new ApiError(res.status, 'ERROR', 'Failed to download PDF');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  subscription: subscriptionApi('lineup'),
};

// ---------- featured ----------
export const featured = {
  request: (input: { type: Featured['type']; refId: string; billing: 'per_event' | 'monthly' }) =>
    apiFetch<Featured & { razorpayOrder: { orderId: string; amount: number; keyId?: string } }>('/featured/request', { body: input }),
  confirmPayment: (id: string, proof: { paymentId: string; signature: string }) =>
    apiFetch<Featured>(`/featured/${id}/confirm-payment`, { body: proof }),
  mine: (type: Featured['type'], refId: string) => apiFetch<Featured | null>('/featured/mine', { query: { type, refId } }),
  rates: () => apiFetch<{ perEvent: number; organizerMonthly: number; promoterMonthly: number; lineupMonthly: number; venueMonthly: number }>('/featured/rates'),
};

// ---------- support / careers / misc ----------
export const support = {
  tickets: () => apiFetch<HelpTicket[]>('/support/tickets'),
  raise: (t: Omit<HelpTicket, 'id' | 'status' | 'createdAt'>) => apiFetch<HelpTicket>('/support/tickets', { body: t }),
  // Public Contact-us form — no auth, unlike the ticket endpoints above.
  contact: (body: { name: string; email: string; role: string; message: string }) =>
    apiFetch<{ id: string }>('/support/contact', { body }),
};

export const careers = {
  jobs: () => apiFetch<CareerJob[]>('/careers/jobs'),
  // multipart, not JSON — the optional cv file rides in the same request as
  // the application itself rather than through a separate freestanding
  // public upload endpoint (this app has no anonymous/unauthenticated
  // upload route anywhere else; bundling it here keeps that true).
  apply: (a: Omit<JobApplication, 'id' | 'appliedAt' | 'cv'>, cv?: File) => {
    const form = new FormData();
    Object.entries(a).forEach(([k, v]) => form.append(k, v));
    if (cv) form.append('cv', cv);
    return apiUpload<JobApplication>('/careers/apply', form);
  },
};

export const notifications = {
  send: (channel: 'whatsapp' | 'email', to: string, template: string, data: Record<string, string>) =>
    apiFetch<void>('/notifications/send', { body: { channel, to, template, data } }),
};

// ---------- platform settings (public, no auth) ----------
export interface PlatformInfo {
  maintenanceMode: boolean;
  comingSoonMode: boolean;
  salesPaused: boolean;
  socials: { instagram: string; x: string; youtube: string; whatsapp: string; facebook: string };
  siteSeo: { title: string; description: string; keywords: string };
  contact: { email: string; phone: string; address: string; organizerEmail: string };
  footerCopyright: string;
  feeLabel: string;
  absorbedBy: 'Organizer' | 'Guest' | 'Split' | string;
  bookingFee: number;
  gstPct: number;
  logoUrl: string | null;
  faviconUrl: string | null;
}
export const platform = {
  settings: () => apiFetch<PlatformInfo>('/settings'),
};

// ---------- venue partner ----------
export const venuePartner = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<{ url: string }>('/venue/upload', form);
  },
  onboard: (v: Partial<Venue> & { licenseDoc?: string; addressProofDoc?: string }) => apiFetch<Venue>('/venue/onboard', { body: v }),
  myListing: () => apiFetch<Venue & { favourites: number }>('/venue/listing'),
  updateListing: (patch: Partial<Venue>) => apiFetch<Venue>('/venue/listing', { method: 'PATCH', body: patch }),
  events: () => apiFetch<Event[]>('/venue/events'),
  invoices: () => apiFetch<Invoice[]>('/venue/invoices'),
  downloadInvoicePdf: async (id: string, filename: string) => {
    const res = await fetch(`${API_URL}/venue/invoices/${id}/pdf`, { headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} });
    if (!res.ok) throw new ApiError(res.status, 'ERROR', 'Failed to download PDF');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  subscription: subscriptionApi('venue'),
};
