/** Same contract as prebooze-web/src/api/index.ts's `organizer`/`orgTeam`/
 * `orgRoles`/`vip` exports — talks to the real /v1/organizer/* endpoints
 * already serving the web console. Field names match exactly. */
import { apiFetch, apiUpload } from './client';
import type {
  CartRecord, CollaboratorOption, Coupon, Event, Invoice, MarketingAnalytics, OrgAttendee, OrgBooking, OrgBookingDetail, OrgGuestListEntry, OrgLedgerTx, OrgLiveMonitor, OrgModulePerms,
  OrgPermKey, OrgPromoterGuest, OrgPromoterPayoutRow, OrgPromoterRosterEntry, OrgStaffMember, OrgTeamAccess, Organizer, PaymentProfile,
} from '../types';

export const organizer = {
  me: () => apiFetch<Organizer>('/organizer/me'),
  updateMe: (patch: {
    brandName?: string; username?: string; city?: string; country?: string; state?: string; pincode?: string;
    logoUrl?: string; about?: string; socialLinks?: { instagram?: string; facebook?: string; other?: string[] };
    contact?: string; contactPerson?: string; phone?: string; eventTypes?: string;
  }) => apiFetch<Organizer>('/organizer/me', { method: 'PATCH', body: patch }),
  registerPushToken: (token: string, platform: 'ios' | 'android') =>
    apiFetch<void>('/organizer/push-token', { method: 'POST', body: { token, platform } }),
  unregisterPushToken: (token: string) =>
    apiFetch<void>('/organizer/push-token', { method: 'DELETE', body: { token } }),
  upload: async (uri: string, name: string, mimeType: string) => {
    // Expo SDK 53+ installs its own global `fetch` (see
    // node_modules/expo/src/winter/fetch), which only accepts a real
    // Blob/File in FormData — RN's classic `{uri, name, type}` file-part
    // convention throws "Unsupported FormDataPart implementation" under it
    // (found live 2026-09-15 testing the poster upload against a real
    // event). Read the local asset into a real Blob first.
    const blob = await fetch(uri).then((r) => r.blob());
    const form = new FormData();
    form.append('file', blob, name);
    return apiUpload<{ url: string }>('/organizer/upload', form);
  },
  events: () => apiFetch<Event[]>('/organizer/events'),
  upsertEvent: (e: {
    id?: string; title: string; description?: string; category?: string; subCategory?: string; ageLimit?: string;
    tags?: string[]; date?: string; durationHrs?: number; venueId?: string; privateCity?: string; privateLocality?: string;
    exactAddress?: string | null; mapLink?: string | null; status?: 'draft' | 'pending';
    conditions?: string[]; rules?: unknown; lineup?: unknown; seo?: unknown; promoterConfig?: unknown;
    posterUrl?: string | null; galleryUrls?: string[]; teaserVideoUrl?: string | null; socialBanners?: { postUrl?: string; storyUrl?: string };
    // Matches prebooze-api's real TierInput (organizer.service.ts) exactly
    // — coverCharge/coverChargeNote/freeCutoff/lateFeePrice were missing
    // here before (a guessed/trimmed type), silently dropping them from
    // every save.
    tiers?: { id?: string; name: string; price: number; quantity: number; includes?: string[]; description?: string; coverCharge?: number; coverChargeNote?: string; freeCutoff?: string; lateFeePrice?: number }[];
    // Real registered co-organizers — omitting this on an edit preserves
    // the existing list server-side (saveEvent checks `!== undefined`);
    // the wizard always sends it explicitly (even []) so removing every
    // collaborator is possible, matching how it already treats rules/
    // promoterConfig/etc.
    collaboratorOrganizerIds?: string[];
  }) => apiFetch<Event>('/organizer/events', { body: e }),
  // Blocked server-side the instant a single real Booking exists — see
  // OrganizerService.deleteEvent. Only ever offered in the UI once
  // sold === 0, matching that rule.
  deleteEvent: (id: string) => apiFetch<{ ok: true }>(`/organizer/events/${id}`, { method: 'DELETE' }),
  // Manual resend of the private-address WhatsApp (exact address + map
  // link) — the automatic send (3h before start) already covers every
  // confirmed guest at that point; this is for a guest who missed it or
  // booked after the event started.
  resendEventLocation: (eventId: string) => apiFetch<{ ok: true }>(`/organizer/events/${eventId}/resend-location`, { method: 'POST' }),
  // Read-only funnel/traffic performance for one event — the rest of
  // Marketing (campaign purchase) is deliberately out of scope for this
  // app (App Store IAP policy), but this has no purchase action, so it's
  // not excluded. Unlocks only once the event has a real active/completed
  // MarketingOrder or falls inside an active subscription period —
  // enforced server-side (403 otherwise), same as web.
  marketingAnalytics: (eventId: string) => apiFetch<MarketingAnalytics>('/organizer/marketing/analytics', { query: { eventId } }),
  invoices: () => apiFetch<Invoice[]>('/organizer/invoices'),
  collaboratorOptions: () => apiFetch<CollaboratorOption[]>('/organizer/collaborator-options'),
  attendees: (eventId: string) => apiFetch<OrgAttendee[]>(`/organizer/events/${eventId}/attendees`),
  bookings: () => apiFetch<OrgBooking[]>('/organizer/bookings'),
  bookingDetail: (id: string) => apiFetch<OrgBookingDetail>(`/organizer/bookings/${encodeURIComponent(id)}`),
  // Walk-up/phone/gate-inquiry bookings created directly from the console —
  // see prebooze-api's BookingsService.createOfflineBookingSelfCollected/
  // PaymentLink. 'self_collected' returns the real created Booking
  // immediately; 'payment_link' returns a redirect URL to text the guest
  // (the booking itself is only created once they actually pay, via the
  // same webhook every online checkout already uses).
  createOfflineBooking: (body: {
    eventId: string; tierId: string; qty: number; guestName: string; whatsapp: string; gender?: string;
    others?: { name: string; gender?: string; whatsapp?: string }[];
    paymentMode: 'self_collected' | 'payment_link';
  }) => apiFetch<OrgBooking | { holdId: string; redirectUrl: string; subtotal: number; fee: number; gstPct: number; gst: number; total: number; phone: string }>('/organizer/offline-bookings', { method: 'POST', body }),
  offlineCharges: () => apiFetch<{ id: string; bookingId: string | null; eventTitle: string | null; guestName: string | null; guestPaid: number | null; commissionCharged: number; createdAt: string }[]>('/organizer/offline-charges'),
  // Organizer's own "undo" for a self-collected offline booking — reverses
  // inventory + the commission/fee/GST ledger debit. Payment-link bookings
  // aren't voidable here (real gateway money — use the normal refund path).
  voidOfflineBooking: (id: string) => apiFetch<OrgBooking>(`/organizer/offline-bookings/${encodeURIComponent(id)}/void`, { method: 'POST' }),
  resendOfflineBooking: (id: string) => apiFetch<{ ok: true }>(`/organizer/offline-bookings/${encodeURIComponent(id)}/resend`, { method: 'POST' }),
  // Organizer's own sign-off on a pending refund request — does not move
  // any money, just tells admin the organizer already agrees. Real
  // approve/decline stays admin-only.
  orgApproveRefund: (id: string) => apiFetch<OrgBookingDetail>(`/organizer/bookings/${encodeURIComponent(id)}/refund/org-approve`, { method: 'POST' }),
  // Deliberately its own endpoint rather than events() above — gated on
  // 'Attendees & check-in' view (same as the create call), not 'Events &
  // wizard', so staff who can only take bookings can still use this modal.
  offlineBookingEvents: () => apiFetch<Event[]>('/organizer/offline-bookings/events'),
  coupons: () => apiFetch<Coupon[]>('/organizer/coupons'),
  upsertCoupon: (c: Partial<Coupon>) => apiFetch<Coupon>('/organizer/coupons', { body: c }),
  deleteCoupon: (id: string) => apiFetch<{ ok: true }>(`/organizer/coupons/${id}`, { method: 'DELETE' }),
  payouts: () => apiFetch<{ balance: number; ledger: OrgLedgerTx[] }>('/organizer/payouts'),
  promoterPayouts: () => apiFetch<OrgPromoterPayoutRow[]>('/organizer/promoter-payouts'),
  promoters: () => apiFetch<OrgPromoterRosterEntry[]>('/organizer/promoters'),
  withdraw: (amount: number) => apiFetch<void>('/organizer/withdraw', { body: { amount } }),
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
  guestList: (eventId: string) => apiFetch<{ entries: OrgGuestListEntry[]; namesCount: number; totalHeads: number; arrived: number }>(`/organizer/events/${eventId}/guest-list`),
  addGuestListEntry: (eventId: string, body: { name: string; phone: string; plusOnes?: number; companions?: { name: string; phone: string }[] }) =>
    apiFetch<OrgGuestListEntry>(`/organizer/events/${eventId}/guest-list`, { body }),
  toggleGuestArrived: (id: string) => apiFetch<OrgGuestListEntry>(`/organizer/guest-list/${id}/toggle-arrived`, { method: 'POST' }),
  removeGuestListEntry: (id: string) => apiFetch<{ ok: true }>(`/organizer/guest-list/${id}`, { method: 'DELETE' }),
  promoterGuests: (eventId: string) => apiFetch<OrgPromoterGuest[]>(`/organizer/events/${eventId}/promoter-guests`),
  live: (eventId: string) => apiFetch<OrgLiveMonitor>(`/organizer/events/${eventId}/live`),
  manualCheckIn: (eventId: string, name: string, count?: number) => apiFetch<unknown>(`/organizer/events/${eventId}/check-in`, { body: { name, count } }),
  revertCheckIn: (eventId: string, bookingId: string) => apiFetch<unknown>(`/organizer/events/${eventId}/check-in/${bookingId}/revert`, { method: 'POST' }),
  setSalesPaused: (eventId: string, paused: boolean) => apiFetch<Event>(`/organizer/events/${eventId}/pause-sales`, { method: 'PATCH', body: { paused } }),
};

export interface VipPass extends OrgGuestListEntry {
  event: Event;
}
export const vip = {
  pass: (id: string) => apiFetch<VipPass>(`/vip/pass/${id}`),
};

export const orgTeam = {
  mine: () => apiFetch<OrgTeamAccess | null>('/organizer/team/mine'),
  listStaff: () => apiFetch<OrgStaffMember[]>('/organizer/team'),
  addStaff: (body: { name: string; phone: string; email?: string; roleName?: string; scan?: boolean }) => apiFetch<OrgStaffMember>('/organizer/team', { body }),
  updateStaffRole: (id: string, roleName: string) => apiFetch<OrgStaffMember>(`/organizer/team/${id}/role`, { body: { roleName } }),
  removeStaff: (id: string) => apiFetch<{ ok: true }>(`/organizer/team/${id}`, { method: 'DELETE' }),
};
export const orgRoles = {
  list: () => apiFetch<Record<string, OrgModulePerms>>('/organizer/roles'),
  add: (name: string) => apiFetch<unknown>('/organizer/roles', { body: { name } }),
  setPerm: (name: string, module: string, key: OrgPermKey, value: boolean) =>
    apiFetch<unknown>(`/organizer/roles/${encodeURIComponent(name)}/perm`, { body: { module, key, value } }),
  remove: (name: string) => apiFetch<{ ok: true }>(`/organizer/roles/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};
