/** Typed API surface — one function per backend endpoint (see BACKEND.md).
 * These are the real connections: point VITE_API_URL at the server and every
 * feature swaps from localStorage to live data. */
import { apiFetch, apiUpload, API_URL, getToken, ApiError } from './client';
import type {
  Booking, CareerJob, CmsBlog, CmsBlogSummary, CmsFaq, CmsPolicy, CmsPolicySummary, CmsTestimonial, Coupon, Event, Featured, FeaturedSubscription, HelpTicket,
  Invoice, JobApplication, LineupProfile, Organizer, PayMethod, PaymentProfile, Person, PersonDetail, PromoterProfile, User, Venue, WaitlistEntry,
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
  quickSignupOrganizer: (payload: {
    brand: string;
    city: string; state?: string; country?: string; pincode?: string;
    types: string[];
    socialLinks?: { instagram?: string; facebook?: string; other?: string[] };
  }) => apiFetch<{ status: 'approved'; user: User }>('/kyc/organizer/quick-signup', { body: payload }),
  /** Identity verification only (Aadhaar+selfie, or registration+owner's
   * Aadhaar+selfie for a firm) — entirely separate from payout details, see
   * organizer.createPaymentProfile below. `docs` order must match
   * `payload.docLabels` order — see OrganizerVerification.tsx. */
  submitOrganizerVerification: (
    payload: {
      entityType: 'individual' | 'firm';
      contactName: string; contactPhone: string; contactEmail: string;
      contactRole: 'Owner' | 'Manager' | 'Accountant' | 'Other'; contactRoleOther?: string;
      docLabels: string[];
    },
    docs: File[],
  ) => {
    const form = new FormData();
    form.append('payload', JSON.stringify(payload));
    docs.forEach((f) => form.append('documents', f));
    return apiUpload<{ id: string; status: string }>('/kyc/organizer/verification', form);
  },
  quickSignupPromoter: (payload: {
    brand: string;
    city: string; state?: string; country?: string; pincode?: string;
    bio: string; links?: string; audience?: string;
  }) => apiFetch<{ status: 'approved'; user: User }>('/kyc/promoter/quick-signup', { body: payload }),
  /** 2 files, in order: id document, selfie. */
  submitPromoterVerification: (docs: File[]) => {
    const form = new FormData();
    docs.forEach((f) => form.append('documents', f));
    return apiUpload<{ id: string; status: string }>('/kyc/promoter/verification', form);
  },
  quickSignupLineup: (payload: {
    name: string; category: string;
    city: string; state?: string; country?: string; pincode?: string;
    bio: string; links?: string[]; logoUrl?: string;
  }) => apiFetch<{ status: 'approved'; user: User }>('/kyc/lineup/quick-signup', { body: payload }),
  /** 2 files, in order: id document, selfie. */
  submitLineupVerification: (docs: File[]) => {
    const form = new FormData();
    docs.forEach((f) => form.append('documents', f));
    return apiUpload<{ id: string; status: string }>('/kyc/lineup/verification', form);
  },
  /** 2 files: license, address proof — tagged via payload.docLabels in the
   * same order they're attached. Venue's own signup no longer takes any
   * documents at all — see venuePartner.onboard below. */
  submitVenueVerification: (
    payload: {
      contactName: string; contactPhone: string; contactEmail: string;
      contactRole: 'Owner' | 'Manager' | 'Accountant' | 'Other'; contactRoleOther?: string;
      docLabels: string[];
    },
    docs: File[],
  ) => {
    const form = new FormData();
    form.append('payload', JSON.stringify(payload));
    docs.forEach((f) => form.append('documents', f));
    return apiUpload<{ id: string; status: string }>('/kyc/venue/verification', form);
  },
};

/** Captures an incomplete role application as a draft Lead (Admin > Leads),
 * so it doesn't just disappear if someone verifies OTP and leaves, or fills
 * part of the form and abandons it — see useDraftLead.ts for the two call
 * sites (on page load, and debounced as the form fills in). Best-effort:
 * every call site swallows failures, never blocks the real onboarding flow. */
export const leadDraft = {
  capture: (role: 'organizer' | 'promoter' | 'lineup' | 'venue', fields: { name?: string; city?: string; eventType?: string; utmSource?: string }) =>
    apiFetch<void>('/leads/draft', { body: { role, ...fields } }),
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
  cities: () => apiFetch<{ name: string; icon?: string; top: boolean; state?: string; events: number }[]>('/cities'),
  venueTypes: () => apiFetch<{ name: string; icon?: string; events: number }[]>('/venue-types'),
  search: (q: string) => apiFetch<{ label: string; type: string; to: string }[]>('/search', { query: { q } }),
  trending: () => apiFetch<string[]>('/search/trending'),
  reels: () => apiFetch<{ id: string; title: string; hue: number; videoUrl: string | null; posterUrl: string | null }[]>('/reels'),
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
  // present only when this hold is attributed to a promoter with a
  // nonzero revenue-share % set for this event — see BookingsService.priceHold
  promoterMarkupApplies?: boolean;
  promoterShare?: number;
  platformShare?: number;
  razorpayOrderId?: string;
  razorpayKeyId?: string;
}
export interface AvailableCoupon {
  code: string;
  type: 'percent' | 'flat';
  value: number;
  maxDiscount: number | null;
  description: string | null;
}
export interface CreateBookingInput {
  holdId: string;
  mainGuest: string;
  whatsapp: string;
  guests?: { name: string; gender?: string; whatsapp?: string }[];
  couponCode?: string;
  walletCredit?: number;
  promoterRef?: string;
  promoterVia?: string;
  payMethodId?: string;
  razorpay?: { orderId: string; paymentId: string; signature: string };
}
export const bookings = {
  hold: (eventId: string, qty: Record<string, number>) => apiFetch<{ holdId: string; expiresAt: string }>('/bookings/hold', { body: { eventId, qty } }),
  availableCoupons: (eventId: string) => apiFetch<AvailableCoupon[]>('/bookings/coupons', { query: { eventId } }),
  quote: (holdId: string, couponCode?: string, walletCredit?: number, promoterRef?: string) =>
    apiFetch<BookingQuote>('/bookings/quote', { body: { holdId, couponCode, walletCredit, promoterRef } }),
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
  country: string | null;
  state: string | null;
  pincode: string | null;
  bio: string;
  links: string[];
  verified: boolean;
  followers: number;
  eventsPromoted: number;
  guestsBrought: number;
  planId: string;
  audienceReach: string | null;
  bankName: string | null;
  bankLast4: string | null;
  accountHolderName: string | null;
  ifsc: string | null;
  logoUrl: string | null;
  createdAt: string;
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
  updateMe: (patch: {
    brandName?: string; username?: string; city?: string; country?: string; state?: string; pincode?: string;
    bio?: string; links?: string[]; audienceReach?: string;
    bankName?: string; bankAccount?: string; accountHolderName?: string; ifsc?: string; logoUrl?: string;
  }) => apiFetch<PromoterMe>('/promoter/me', { method: 'PATCH', body: patch }),
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<{ url: string }>('/promoter/upload', form);
  },
  invoices: () => apiFetch<Invoice[]>('/promoter/invoices'),
  downloadInvoicePdf: async (id: string, filename: string) => {
    const res = await fetch(`${API_URL}/promoter/invoices/${id}/pdf`, { headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} });
    if (!res.ok) throw new ApiError(res.status, 'ERROR', 'Failed to download PDF');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  promotions: () => apiFetch<Event[]>('/promoter/promotions'),
  guests: (eventId: string) => apiFetch<PromoterGuest[]>(`/promoter/events/${eventId}/guests`),
  paidGuests: (eventId: string) =>
    apiFetch<{ id: string; mainGuest: string; qty: number; subtotal: number; promoterCommission: number; createdAt: string }[]>(
      `/promoter/events/${eventId}/paid-guests`
    ),
  captureGuest: (eventSlug: string, promoterSlug: string, guest: Omit<PromoterGuest, 'id' | 'createdAt' | 'arrived'>) =>
    apiFetch<PromoterGuest>(`/p/${eventSlug}/${promoterSlug}`, { body: guest }),
  pass: (id: string) => apiFetch<PromoterPass>(`/p/pass/${id}`),
  checkInGuest: (id: string) => apiFetch<void>(`/promoter/guests/${id}/check-in`, { method: 'POST' }),
  earnings: () => apiFetch<{ perHead: number; commission: number; withdrawn: number }>('/promoter/earnings'),
  eventEarnings: () =>
    apiFetch<
      {
        eventId: string; title: string; date: string; organizerId: string; organizerName: string;
        perHead: number; perHeadRate: number; perHeadCount: number; commission: number; total: number;
        status: 'pending' | 'reminder_sent' | 'received';
      }[]
    >('/promoter/events/earnings'),
  markEventReceived: (eventId: string) => apiFetch<{ ok: true }>(`/promoter/events/${eventId}/mark-received`, { method: 'POST' }),
  remindOrganizerToPay: (eventId: string) => apiFetch<{ ok: true }>(`/promoter/events/${eventId}/remind-payout`, { method: 'POST' }),
  withdraw: (amount: number) => apiFetch<void>('/promoter/withdraw', { body: { amount } }),
  withdrawals: () => apiFetch<PromoterWithdrawal[]>('/promoter/withdrawals'),
  team: () => apiFetch<PromoterTeamMember[]>('/promoter/team'),
  addTeamMember: (m: SubPromoter) => apiFetch<PromoterTeamMember>('/promoter/team', { body: m }),
  updateTeamMember: (id: string, patch: { payoutSplitPct?: number; monthlyQuotaShare?: number | null }) =>
    apiFetch<PromoterTeamMember>(`/promoter/team/${id}`, { method: 'PATCH', body: patch }),
  removeTeamMember: (id: string) => apiFetch<{ ok: true }>(`/promoter/team/${id}`, { method: 'DELETE' }),
  teamEarnings: () =>
    apiFetch<
      {
        teamMemberId: string; memberName: string; eventId: string; eventTitle: string; eventDate: string;
        perHead: number; commission: number; rawTotal: number; splitPct: number; owed: number; status: 'pending' | 'paid';
      }[]
    >('/promoter/team/earnings'),
  markTeamMemberPaid: (teamMemberId: string, eventId: string) =>
    apiFetch<{ ok: true }>(`/promoter/team/${teamMemberId}/events/${eventId}/mark-paid`, { method: 'POST' }),
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
  isMainGuest: boolean;
  gender?: string;
  whatsapp: string;
  checkedIn: boolean;
  coverCharge: number;
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
  updateMe: (patch: { brandName?: string; username?: string; city?: string; country?: string; state?: string; pincode?: string; logoUrl?: string; about?: string; socialLinks?: { instagram?: string; facebook?: string; other?: string[] }; contact?: string; contactPerson?: string; phone?: string; eventTypes?: string }) =>
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
    tags?: string[]; date?: string; durationHrs?: number; venueId?: string; privateCity?: string; privateLocality?: string; status?: 'draft' | 'pending';
    conditions?: string[]; rules?: unknown; lineup?: unknown; seo?: unknown; promoterConfig?: unknown;
    posterUrl?: string | null; galleryUrls?: string[]; teaserVideoUrl?: string | null; socialBanners?: { postUrl?: string; storyUrl?: string };
    tiers?: { id?: string; name: string; price: number; quantity: number; includes?: string[]; description?: string }[];
  }) => apiFetch<Event>('/organizer/events', { body: e }),
  attendees: (eventId: string) => apiFetch<OrgAttendee[]>(`/organizer/events/${eventId}/attendees`),
  coupons: () => apiFetch<Coupon[]>('/organizer/coupons'),
  upsertCoupon: (c: Partial<Coupon>) => apiFetch<Coupon>('/organizer/coupons', { body: c }),
  payouts: () => apiFetch<{ balance: number; ledger: OrgLedgerTx[] }>('/organizer/payouts'),
  promoterPayouts: () =>
    apiFetch<{ eventId: string; eventTitle: string; eventDate: string; promoterId: string; promoterName: string; perHead: number; commission: number; total: number; status: 'pending' | 'reminder_sent' | 'received' }[]>(
      '/organizer/promoter-payouts'
    ),
  promoters: () =>
    apiFetch<
      {
        promoterId: string; promoterSlug: string; promoterName: string; city: string; bio: string; contact: string | null; verified: boolean;
        bankName: string | null; bankAccountNumber: string | null; bankLast4: string | null; accountHolderName: string | null; ifsc: string | null;
        eventCount: number; totalOwed: number; pendingEvents: number;
      }[]
    >('/organizer/promoters'),
  withdraw: (amount: number) => apiFetch<void>('/organizer/withdraw', { body: { amount } }),
  // ---- payment profiles (bank accounts to withdraw to) — self-serve,
  // no admin review, plural. Entirely separate from identity verification
  // (kyc.submitOrganizerVerification above). ----
  paymentProfiles: () => apiFetch<PaymentProfile[]>('/organizer/payment-profiles'),
  createPaymentProfile: (data: {
    legalName: string; businessAddress: string; country?: string; state?: string; city?: string; pincode?: string;
    bankAccountNumber: string; accountHolderName: string; ifsc: string; branch?: string;
    pan: string; gstin?: string; noGst?: boolean;
  }) => apiFetch<PaymentProfile>('/organizer/payment-profiles', { body: data }),
  updatePaymentProfile: (id: string, data: Partial<{
    legalName: string; businessAddress: string; country: string; state: string; city: string; pincode: string;
    bankAccountNumber: string; accountHolderName: string; ifsc: string; branch: string;
    pan: string; gstin: string; noGst: boolean;
  }>) => apiFetch<PaymentProfile>(`/organizer/payment-profiles/${id}`, { method: 'PATCH', body: data }),
  deletePaymentProfile: (id: string) => apiFetch<{ ok: true }>(`/organizer/payment-profiles/${id}`, { method: 'DELETE' }),
  setDefaultPaymentProfile: (id: string) => apiFetch<{ ok: true }>(`/organizer/payment-profiles/${id}/default`, { method: 'POST' }),
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
export interface VipPass extends OrgGuestListEntry {
  event: Event;
}
export const vip = {
  pass: (id: string) => apiFetch<VipPass>(`/vip/pass/${id}`),
};
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
  // Real Razorpay Subscription (e-mandate) — auto-renews monthly, no manual
  // "renew now" click needed. organizer/promoter/lineup/venue only.
  subscribe: (input: { type: FeaturedSubscription['type']; refId: string }) =>
    apiFetch<{ ok: boolean; requiresAuthorization: boolean; shortUrl?: string; subscriptionId?: string; keyId?: string }>('/featured/subscribe', { body: input }),
  cancelSubscription: (type: FeaturedSubscription['type'], refId: string) =>
    apiFetch<{ ok: boolean }>('/featured/subscription/cancel', { body: { type, refId } }),
  mySubscription: (type: FeaturedSubscription['type'], refId: string) =>
    apiFetch<FeaturedSubscription | null>('/featured/mine-subscription', { query: { type, refId } }),
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

export interface VenueLedgerTx {
  id: string;
  type: 'sale' | 'refund' | 'withdrawal';
  amount: number;
  eventId?: string;
  eventTitle?: string;
  note?: string;
  createdAt: string;
}
export interface VenueHostingRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  contactedAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}
export interface VenueCollaboratorOption {
  id: string;
  brandName: string;
  username: string;
  city: string;
}

// ---------- venue partner ----------
export const venuePartner = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<{ url: string }>('/venue/upload', form);
  },
  onboard: (v: Partial<Venue>) => apiFetch<Venue>('/venue/onboard', { body: v }),
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
  // ---- hosting (opt-in, admin-gated — see VenueService doc comments) ----
  hostingStatus: () => apiFetch<{ hostingEnabled: boolean; request: VenueHostingRequest | null }>('/venue/hosting'),
  requestHosting: () => apiFetch<VenueHostingRequest>('/venue/hosting/request'),
  hostedEvents: () => apiFetch<Event[]>('/venue/hosting/events'),
  upsertHostedEvent: (e: {
    id?: string; title: string; description?: string; category?: string; subCategory?: string; ageLimit?: string;
    tags?: string[]; date?: string; durationHrs?: number; organizerId?: string | null; status?: 'draft' | 'pending';
    conditions?: string[]; rules?: unknown; lineup?: unknown; seo?: unknown; promoterConfig?: unknown;
    posterUrl?: string | null; galleryUrls?: string[]; teaserVideoUrl?: string | null; socialBanners?: { postUrl?: string; storyUrl?: string };
    tiers?: { id?: string; name: string; price: number; quantity: number; includes?: string[]; description?: string }[];
  }) => apiFetch<Event>('/venue/hosting/events', { body: e }),
  myLedger: () => apiFetch<{ balance: number; transactions: VenueLedgerTx[] }>('/venue/hosting/ledger'),
  withdraw: (amount: number) => apiFetch<{ ok: true }>('/venue/hosting/withdraw', { body: { amount } }),
  collaboratorOptions: () => apiFetch<VenueCollaboratorOption[]>('/venue/hosting/collaborator-options'),
};
