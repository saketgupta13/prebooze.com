/** Typed API surface — one function per backend endpoint (see BACKEND.md).
 * These are the real connections: point VITE_API_URL at the server and every
 * feature swaps from localStorage to live data. */
import { apiFetch } from './client';
import type {
  Booking, Coupon, Event, Featured, HelpTicket, JobApplication, PayMethod, Person, User, Venue, WaitlistEntry,
} from '../types';
import type { CartRecord, OrgReview, PromoterGuest, Referral, SubPromoter, WalletTx } from '../store/AppContext';

// ---------- auth ----------
export const auth = {
  requestOtp: (phone: string) => apiFetch<{ requestId: string }>('/auth/otp', { body: { phone } }),
  verifyOtp: (requestId: string, code: string) => apiFetch<{ token: string; user: User; isNew: boolean }>('/auth/verify', { body: { requestId, code } }),
  me: () => apiFetch<User>('/me'),
  updateMe: (patch: Partial<User>) => apiFetch<User>('/me', { method: 'PATCH', body: patch }),
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
};

// ---------- discovery ----------
export const catalog = {
  events: (q: { city?: string; cat?: string; sub?: string; search?: string; sort?: string }) => apiFetch<Event[]>('/events', { query: q }),
  event: (slug: string) => apiFetch<Event>(`/events/${slug}`),
  venues: (city: string) => apiFetch<Venue[]>('/venues', { query: { city } }),
  organizers: (city: string) => apiFetch<unknown[]>('/organizers', { query: { city } }),
  promoters: (city: string) => apiFetch<unknown[]>('/promoters', { query: { city } }),
  lineups: (city: string) => apiFetch<unknown[]>('/lineups', { query: { city } }),
  people: (city: string) => apiFetch<Person[]>('/people', { query: { city } }),
  featured: (city: string) => apiFetch<Featured[]>('/featured', { query: { city } }),
  categories: () => apiFetch<{ name: string; icon: string; subs: string[] }[]>('/categories'),
  cities: () => apiFetch<{ name: string; icon?: string; top: boolean; events: number }[]>('/cities'),
  search: (q: string) => apiFetch<{ label: string; type: string; to: string }[]>('/search', { query: { q } }),
  trending: () => apiFetch<string[]>('/search/trending'),
};

// ---------- bookings, holds, waitlist ----------
export const bookings = {
  hold: (eventId: string, qty: Record<string, number>) => apiFetch<{ holdId: string; expiresAt: string }>('/bookings/hold', { body: { eventId, qty } }),
  create: (holdId: string, payload: Partial<Booking> & { walletCredit?: number; payMethodId?: string; couponCode?: string; promoterRef?: string }) =>
    apiFetch<Booking>('/bookings', { body: { holdId, ...payload } }),
  list: () => apiFetch<Booking[]>('/bookings'),
  cancel: (id: string, refundTo: 'wallet' | 'source') => apiFetch<Booking>(`/bookings/${id}/cancel`, { body: { refundTo } }),
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
  reviewOrganizer: (orgId: string, rating: number, text: string) => apiFetch<OrgReview>(`/organizers/${orgId}/reviews`, { body: { rating, text } }),
};

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
  subscribe: (planId: string) => apiFetch<void>('/promoter/subscription', { body: { planId } }),
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
