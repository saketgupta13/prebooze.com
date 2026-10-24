/** Hold → quote → PhonePe redirect → confirm, same contract as
 * prebooze-web/src/api/index.ts's `bookings` export — real checkout flow,
 * no mock. */
import { apiFetch } from './client';
import type { Booking, WaitlistEntry } from '../types';

export interface BookingQuote {
  subtotal: number;
  fee: number;
  // GST on the booking fee only — both 0 whenever GST isn't enabled.
  // igstAmount>0 means an inter-state supply (single IGST line); 0 means
  // intra-state, split into cgstAmount+sgstAmount instead.
  gstPct?: number;
  gst?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  discount: number;
  walletCreditUsed: number;
  total: number;
  // Present only when this hold is attributed to a promoter with a nonzero
  // revenue-share % set for this event.
  promoterMarkupApplies?: boolean;
  promoterShare?: number;
  platformShare?: number;
  // PhonePe redirects the whole browser (here: an in-app browser tab) to
  // this hosted checkout page — no embedded SDK, no client key needed.
  // phonepeMerchantOrderId is the same value as the holdId the quote was
  // made for.
  phonepeRedirectUrl?: string;
  phonepeMerchantOrderId?: string;
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
  mainGuestGender?: string;
  age?: number;
  whatsapp: string;
  guests?: { name: string; gender?: string; whatsapp?: string }[];
  couponCode?: string;
  walletCredit?: number;
  promoterRef?: string;
  promoterVia?: string;
  payMethodId?: string;
  // No client-reported signature for PhonePe — the backend independently
  // confirms real payment itself via getOrderStatus, this is just which
  // order to check.
  phonepe?: { merchantOrderId: string };
}

export const bookingsApi = {
  hold: (eventId: string, qty: Record<string, number>) => apiFetch<{ holdId: string; expiresAt: string }>('/bookings/hold', { body: { eventId, qty } }),
  availableCoupons: (eventId: string) => apiFetch<AvailableCoupon[]>('/bookings/coupons', { query: { eventId } }),
  quote: (holdId: string, couponCode?: string, walletCredit?: number, promoterRef?: string, returnUrl?: string) =>
    apiFetch<BookingQuote>('/bookings/quote', { body: { holdId, couponCode, walletCredit, promoterRef, returnUrl } }),
  // Fire-and-forget snapshot sent right before the in-app browser opens
  // PhonePe's hosted page — lets a webhook finish the booking server-side
  // if the browser tab never comes back (app killed mid-payment). Never
  // blocks or fails the real checkout.
  prepare: (input: Omit<CreateBookingInput, 'razorpay' | 'phonepe'>) => apiFetch<{ ok: true }>('/bookings/prepare', { body: input }),
  create: (input: CreateBookingInput) => apiFetch<Booking>('/bookings', { body: input }),
  list: () => apiFetch<Booking[]>('/bookings'),
  cancel: (id: string, refundTo: 'wallet' | 'source') => apiFetch<Booking>(`/bookings/${encodeURIComponent(id)}/cancel`, { body: { refundTo } }),
  resend: (id: string) => apiFetch<{ ok: true }>(`/bookings/${encodeURIComponent(id)}/resend`, { method: 'POST' }),
  payStatus: (holdId: string) => apiFetch<{ status: 'paid' | 'pending' | 'failed' | 'unknown' }>(`/pay/status/${encodeURIComponent(holdId)}`),
  waitlist: (eventId: string) => apiFetch<WaitlistEntry[]>(`/events/${eventId}/waitlist`),
  waitlistJoin: (eventId: string) => apiFetch<WaitlistEntry>(`/events/${eventId}/waitlist`, { method: 'POST' }),
};
