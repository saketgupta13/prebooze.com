/** Typed API surface — one function per backend endpoint (see BACKEND.md).
 * These are the real connections: point VITE_API_URL at the server and every
 * feature swaps from localStorage to live data. */
import { apiFetch, apiUpload } from './client';
import type {
  Booking, Coupon, Event, Featured, HelpTicket, JobApplication, PayMethod, Person, User, Venue, WaitlistEntry,
} from '../types';
import type { CartRecord, GuestReview, PromoterGuest, Referral, SubPromoter, WalletTx } from '../store/AppContext';

// ---------- auth ----------
export const auth = {
  requestOtp: (phone: string) => apiFetch<{ requestId: string }>('/auth/otp', { body: { phone } }),
  verifyOtp: (requestId: string, code: string) => apiFetch<{ token: string; user: User; isNew: boolean }>('/auth/verify', { body: { requestId, code } }),
  me: () => apiFetch<User>('/me'),
  updateMe: (patch: Partial<User>) => apiFetch<User>('/me', { method: 'PATCH', body: patch }),
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
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
  events: (q: { city?: string; cat?: string; sub?: string; search?: string; sort?: string }) => apiFetch<Event[]>('/events', { query: q }),
  event: (slug: string) => apiFetch<Event>(`/events/${slug}`),
  venues: (city: string) => apiFetch<Venue[]>('/venues', { query: { city } }),
  venueSeo: (id: string) => apiFetch<{ title: string; description: string; keywords: string }>(`/venues/${id}/seo`),
  organizers: (city: string) => apiFetch<unknown[]>('/organizers', { query: { city } }),
  organizerSeo: (id: string) => apiFetch<{ title: string; description: string; keywords: string }>(`/organizers/${id}/seo`),
  promoters: (city: string) => apiFetch<unknown[]>('/promoters', { query: { city } }),
  promoterSeo: (id: string) => apiFetch<{ title: string; description: string; keywords: string }>(`/promoters/${id}/seo`),
  lineups: (city: string) => apiFetch<unknown[]>('/lineups', { query: { city } }),
  lineupSeo: (id: string) => apiFetch<{ title: string; description: string; keywords: string }>(`/lineups/${id}/seo`),
  people: (city: string) => apiFetch<Person[]>('/people', { query: { city } }),
  featured: (city: string) => apiFetch<Featured[]>('/featured', { query: { city } }),
  categories: () => apiFetch<{ name: string; icon: string; subs: string[] }[]>('/categories'),
  cities: () => apiFetch<{ name: string; icon?: string; top: boolean; events: number }[]>('/cities'),
  search: (q: string) => apiFetch<{ label: string; type: string; to: string }[]>('/search', { query: { q } }),
  trending: () => apiFetch<string[]>('/search/trending'),
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
  checkIn: (id: string, count: number) => apiFetch<Booking>(`/bookings/${id}/check-in`, { body: { count } }),
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
  followers: () => apiFetch<Person[]>('/me/followers'),
  followRequests: () => apiFetch<Person[]>('/me/follow-requests'),
  respondRequest: (personId: string, accept: boolean) => apiFetch<void>(`/me/follow-requests/${personId}`, { body: { accept } }),
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
export const promoter = {
  promotions: () => apiFetch<Event[]>('/promoter/promotions'),
  guests: (eventId: string) => apiFetch<PromoterGuest[]>(`/promoter/events/${eventId}/guests`),
  captureGuest: (eventSlug: string, promoterSlug: string, guest: Omit<PromoterGuest, 'id' | 'createdAt' | 'arrived'>) =>
    apiFetch<PromoterGuest>(`/p/${eventSlug}/${promoterSlug}`, { body: guest }),
  checkInGuest: (id: string) => apiFetch<void>(`/promoter/guests/${id}/check-in`, { method: 'POST' }),
  earnings: () => apiFetch<{ perHead: number; commission: number; withdrawn: number }>('/promoter/earnings'),
  withdraw: (amount: number) => apiFetch<void>('/promoter/withdraw', { body: { amount } }),
  team: () => apiFetch<SubPromoter[]>('/promoter/team'),
  addTeamMember: (m: SubPromoter) => apiFetch<SubPromoter>('/promoter/team', { body: m }),
  usage: () => apiFetch<{ used: number; quota: number }>('/promoter/usage'),
  subscription: subscriptionApi('promoter'),
};

// ---------- organizer ----------
export const organizer = {
  events: () => apiFetch<Event[]>('/organizer/events'),
  upsertEvent: (e: Partial<Event>) => apiFetch<Event>('/organizer/events', { body: e }),
  attendees: (eventId: string) => apiFetch<unknown[]>(`/organizer/events/${eventId}/attendees`),
  coupons: () => apiFetch<Coupon[]>('/organizer/coupons'),
  upsertCoupon: (c: Partial<Coupon>) => apiFetch<Coupon>('/organizer/coupons', { body: c }),
  payouts: () => apiFetch<unknown>('/organizer/payouts'),
  withdraw: (amount: number) => apiFetch<void>('/organizer/withdraw', { body: { amount } }),
  abandonedCarts: () => apiFetch<CartRecord[]>('/organizer/carts'),
  remindCart: (id: string) => apiFetch<void>(`/organizer/carts/${id}/remind`, { method: 'POST' }),
  subscription: subscriptionApi('organizer'),
};

// ---------- lineup (artist) ----------
export const lineup = {
  subscription: subscriptionApi('lineup'),
};

// ---------- featured ----------
export const featured = {
  request: (input: Omit<Featured, 'id' | 'status' | 'createdAt'>) => apiFetch<Featured>('/featured/request', { body: input }),
  rates: () => apiFetch<{ perEvent: number; organizerMonthly: number; promoterMonthly: number; lineupMonthly: number }>('/featured/rates'),
};

// ---------- support / careers / misc ----------
export const support = {
  tickets: () => apiFetch<HelpTicket[]>('/support/tickets'),
  raise: (t: Omit<HelpTicket, 'id' | 'status' | 'createdAt'>) => apiFetch<HelpTicket>('/support/tickets', { body: t }),
};

export const careers = {
  jobs: () => apiFetch<unknown[]>('/careers/jobs'),
  apply: (a: Omit<JobApplication, 'id' | 'appliedAt'>) => apiFetch<JobApplication>('/careers/apply', { body: a }),
};

export const notifications = {
  send: (channel: 'whatsapp' | 'email', to: string, template: string, data: Record<string, string>) =>
    apiFetch<void>('/notifications/send', { body: { channel, to, template, data } }),
};

// ---------- platform settings (public, no auth) ----------
export interface PlatformInfo {
  maintenanceMode: boolean;
  comingSoonMode: boolean;
  socials: { instagram: string; x: string; youtube: string; whatsapp: string; facebook: string };
  siteSeo: { title: string; description: string; keywords: string };
  contact: { email: string; phone: string; address: string; organizerEmail: string };
  footerCopyright: string;
  feeLabel: string;
  absorbedBy: 'Organizer' | 'Guest' | 'Split' | string;
  bookingFee: number;
  gstPct: number;
}
export const platform = {
  settings: () => apiFetch<PlatformInfo>('/settings'),
};

// ---------- venue partner ----------
export const venuePartner = {
  onboard: (v: Partial<Venue> & { licenseDoc?: string; addressProofDoc?: string }) => apiFetch<Venue>('/venue/onboard', { body: v }),
  myListing: () => apiFetch<Venue>('/venue/listing'),
  updateListing: (patch: Partial<Venue>) => apiFetch<Venue>('/venue/listing', { method: 'PATCH', body: patch }),
  events: () => apiFetch<Event[]>('/venue/events'),
  subscription: subscriptionApi('venue'),
};
