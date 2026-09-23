/** Types ported from prebooze-web/src/types.ts — trimmed to what the
 * organizer app touches. Keep field names/shapes identical to the web app;
 * this is a faithful port, not a redesign. */

// Real Prisma KycSubmission shape (kyc.service.ts) — organizer verification
// only ever cares about `kind==='organizer'` rows and their `status`.
export interface KycSubmission {
  id: string;
  userId: string;
  kind: 'guest' | 'organizer' | 'promoter' | 'lineup' | 'venue';
  status: 'pending' | 'approved' | 'rejected';
  // Real shape for kind==='organizer' rows — see
  // KycService.submitOrganizerVerification's own `payload` write. Other
  // kinds have a differently-shaped payload; only read this when
  // kind==='organizer'.
  payload: {
    entityType?: 'individual' | 'firm';
    contactName?: string; contactPhone?: string; contactEmail?: string;
    contactRole?: 'Owner' | 'Manager' | 'Accountant' | 'Other'; contactRoleOther?: string;
  };
  documents: { type: string; path: string }[];
  autoScore: number | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  // Which specific uploaded document(s) (matching `documents[].type`) caused
  // a rejection, e.g. ["selfie"] — only meaningful when status is
  // 'rejected'. Empty means the whole submission was rejected for a reason
  // unrelated to any one document (see reviewNote alone).
  rejectedDocTypes: string[];
  createdAt: string;
}

// Real Prisma OrgNotification shape (src/notifications/org-notifications.ts)
// — an organizer-scoped in-app inbox row, same fields as admin's shared
// AdminNotification, raised on real triggers (event approved/rejected so far).
export interface OrgNotification {
  id: string;
  icon: string;
  text: string;
  to: string | null;
  read: boolean;
  createdAt: string;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  other?: string[];
}

export interface User {
  phone: string;
  name: string;
  username: string;
  email: string;
  city: string;
  state?: string;
  country?: string;
  pincode?: string;
  avatarUrl?: string;
  dob: string;
  age?: number;
  gender: string;
  profession: string;
  languages: string;
  bio: string;
  socials: string;
  socialLinks: SocialLinks;
  interests: string[];
  phoneVerified: boolean;
  idVerified: boolean;
  profilePct: number;
  joined: string;
  isOrganizer: boolean;
  orgBrand?: string;
  orgUsername?: string;
  orgLogoUrl?: string;
  isLineup?: boolean;
  isPromoter?: boolean;
  isVenue?: boolean;
  pendingRole?: 'organizer' | 'promoter' | 'lineup' | 'venue';
  roleStatus?: 'pending' | 'approved' | 'rejected';
  roleRejectionReason?: string;
  attendanceVisibility?: 'off' | 'followers' | 'public';
  discoverable?: boolean;
  marketingConsent?: boolean;
  autoRenew?: boolean;
  profileRewardClaimedAt?: string;
  profileRewardCode?: string;
}

export type EventStatus = 'approved' | 'pending' | 'rejected' | 'draft';

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
  includes: string[];
  description?: string;
  coverCharge?: number;
  coverChargeNote?: string;
  freeCutoff?: string; // "HH:MM"
  lateFeePrice?: number;
}

export interface LineupItem {
  name: string;
  role: 'Opening DJ' | 'Headline artist' | 'Sponsor' | 'Promoter' | string;
}

export interface PartyRule {
  title: string;
  body: string;
}

export interface PromoterConfig {
  enabled: boolean;
  cap: number;
  cutoff: string;
  allowedPromoters: string[];
  guestListPromoters?: string[];
  perHeadPayout: boolean;
  perHeadAmount: number;
  allowTeams: boolean;
  revenueShare?: Record<string, number>;
}

export interface Venue {
  id: string;
  name: string;
  verified: boolean;
  type: string;
  locality: string;
  city: string;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  address: string;
  capacity: number;
  galleryUrls?: string[];
}

export interface PromoterProfile {
  id: string;
  slug: string;
  name: string;
  verified: boolean;
  city: string;
}

export interface LineupProfile {
  id: string;
  slug: string;
  name: string;
  category: string;
  verified: boolean;
  city: string;
}

export interface Organizer {
  id: string;
  brandName: string;
  username: string;
  verified: boolean;
  city: string;
  since: string;
  createdAt?: string;
  rating: number;
  reviewCount: number;
  eventsHosted: number;
  followers: number;
  following: number;
  about: string;
  logoHue: number;
  logoUrl?: string | null;
  country?: string;
  state?: string;
  pincode?: string;
  socialLinks?: SocialLinks;
  contact?: string;
  contactPerson?: string;
  phone?: string;
  eventTypes?: string;
}

export interface Event {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  subCategory?: string;
  ageLimit: string;
  tags: string[];
  date: string;
  // Multi-day series (a festival/workshop spanning several days) — when
  // set, the event's live window extends through the end of this date
  // instead of ending after just the first day's date+durationHrs. See
  // isEventOver in lib/events.ts, which is the only place that should ever
  // read this.
  seriesEndDate?: string | null;
  durationHrs: number;
  venueId?: string | null;
  privateCity?: string | null;
  privateLocality?: string | null;
  organizerId?: string | null;
  hostedByVenue?: boolean;
  status: EventStatus;
  rejectionReason?: string;
  conditions: string[];
  rules: PartyRule[];
  lineup: LineupItem[];
  tiers: TicketTier[];
  posterHue: number;
  seo?: { title: string; description: string; slug: string; keywords: string };
  promoterConfig?: PromoterConfig;
  socialBanners?: { postUrl?: string; storyUrl?: string };
  posterUrl?: string | null;
  galleryUrls?: string[];
  teaserVideoUrl?: string | null;
  venue?: Venue;
  organizer?: Organizer;
  minPrice?: number;
  commission?: number | null;
  recentActivity?: { count: number; window: 'today' | 'week' } | null;
  // Real registered co-organizers tagged on this event — Organizer.id
  // strings only (see saveEvent's validation against the real Organizer
  // table); always an array on read, never undefined (Prisma default []).
  collaboratorOrganizerIds: string[];
}

// Real shape from organizer.service.ts's collaboratorOptions() — every
// other registered Organizer this one can tag as a co-organizer (not
// gated on `verified` — web's identically-shaped venue-side option list
// is stricter, but this feature's bar is deliberately just "registered").
export interface CollaboratorOption {
  id: string;
  brandName: string;
  username: string;
  city: string;
}

// Real shape from prisma/schema.prisma's Coupon model — the previous
// version of this type had been guessed (`usedCount`/`genderAudience`
// don't exist; the real columns are `used` and `gender`) and never caught
// since Coupons wasn't built yet. `eventScope` is matched by *event title
// string*, not id (see the model's own comment).
export interface Coupon {
  id: string;
  code: string;
  type: 'percent' | 'flat';
  value: number;
  maxDiscount?: number;
  usageLimit: number;
  used: number;
  perUserLimit: number;
  eventScope: 'all' | string; // 'all' or an exact event title
  validTill: string;
  firstTimeOnly: boolean;
  status: 'active' | 'paused';
  gender: 'all' | 'women' | 'men' | 'other';
  description?: string | null;
  organizerId?: string | null;
  userId?: string | null;
}

export interface PaymentProfile {
  id: string;
  organizerId: string;
  isDefault: boolean;
  legalName: string;
  businessAddress: string;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  pincode?: string | null;
  bankAccountNumber: string;
  accountHolderName: string;
  ifsc: string;
  branch?: string | null;
  pan: string;
  gstin?: string | null;
  noGst?: boolean;
}

// Real shape from prebooze-web/src/api/index.ts's OrgAttendee — one row per
// guest (a Couple/Group ticket has multiple rows sharing the same
// bookingId), used by both Scanner (manual search/check-in) and Dashboard
// (unique-customer count via `whatsapp`).
export interface OrgAttendee {
  bookingId: string;
  bookingStatus: string;
  tierName: string;
  name: string;
  isMainGuest: boolean;
  username?: string;
  avatarUrl?: string;
  gender?: string;
  whatsapp: string;
  checkedIn: boolean;
  coverCharge: number;
  total: number;
  subtotal: number;
  promoterName?: string;
  paymentMethod: string;
}

// Real shape from prebooze-web/src/api/index.ts's OrgBooking — one row per
// booking (not per guest), used by the organizer Bookings list/summary.
export interface OrgBooking {
  id: string;
  mainGuest: string;
  whatsapp: string;
  tierName: string;
  qty: number;
  total: number;
  status: 'confirmed' | 'cancelled' | 'refunded' | 'refund_requested';
  checkedIn: boolean;
  createdAt: string;
  event: { id: string; title: string; date: string; durationHrs: number };
}

// Real shape from prebooze-web/src/api/index.ts's OrgLedgerTx.
export interface OrgLedgerTx {
  id: string;
  type: 'sale' | 'refund' | 'withdrawal' | 'withdrawal_reversal';
  amount: number;
  eventId?: string;
  eventTitle?: string;
  note?: string;
  createdAt: string;
  // Real request→received→initiated→processed→complete pipeline (or
  // rejected), 2026-09-18 — only meaningful for type:'withdrawal' rows.
  withdrawalStatus?: 'requested' | 'received' | 'initiated' | 'processed' | 'complete' | 'rejected';
  withdrawalRejectedReason?: string;
  withdrawalPaidUtr?: string;
}

// Real shape from prebooze-web/src/types.ts — full booking record, returned
// by bookings.checkIn() (POST /bookings/check-in) for the camera-scan result.
export interface BookingGuest {
  name: string;
  checkedIn: boolean;
  gender?: string;
  whatsapp?: string;
}

export interface Booking {
  id: string;
  eventId: string;
  tierId: string;
  tierName: string;
  qty: number;
  subtotal: number;
  fee: number;
  discount: number;
  total: number;
  coverCharge?: number;
  paymentId?: string;
  paymentMethod?: string;
  couponCode?: string;
  status: 'confirmed' | 'cancelled' | 'refunded' | 'refund_requested';
  guests: BookingGuest[];
  mainGuest: string;
  whatsapp: string;
  createdAt: string;
  promoterRef?: string;
  promoterName?: string;
  event?: Event;
  qrToken?: string;
}

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
  promoterName?: string;
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

export interface OrgStaffMember {
  id: string;
  name: string;
  phone: string | null;
  roleName: string;
  scan: boolean;
  createdAt: string;
}

export type OrgPermKey = 'view' | 'edit';
export type OrgModulePerms = Record<string, Record<OrgPermKey, boolean>>;

export interface OrgTeamAccess {
  organizerId: string;
  organizerBrand: string;
  organizerLogoUrl: string | null;
  roleName: string;
  permissions: OrgModulePerms;
  scan: boolean;
}

// Real shape from prebooze-api's organizer.service.ts `carts()` — the
// previous version of this type had been guessed (guestName/guestPhone/
// amount/reminderSentAt don't exist on the real response) and never
// caught since Abandoned carts wasn't built yet.
export interface CartRecord {
  id: string;
  userPhone: string;
  userName: string;
  eventId: string;
  eventTitle: string;
  qty: number;
  qtyMap: Record<string, number>;
  tierSummary: string;
  subtotal: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  status: 'abandoned';
  remindedAt?: string;
}

// Real shape from prebooze-api's social.service.ts `reviews()` — `date` is
// already pre-formatted server-side ("15 Sep"), don't reformat it.
export interface GuestReview {
  id: string;
  author: string;
  rating: number;
  text: string;
  organizerId: string;
  eventTitle?: string;
  date: string;
}

// Real shape from prebooze-api's organizer.service.ts `promoters()`.
export interface OrgPromoterRosterEntry {
  promoterId: string;
  promoterSlug: string;
  promoterName: string;
  city: string;
  bio: string;
  contact: string | null;
  verified: boolean;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankLast4: string | null;
  accountHolderName: string | null;
  ifsc: string | null;
  eventCount: number;
  totalOwed: number;
  pendingEvents: number;
}

// Real shape from prebooze-api's organizer.service.ts `promoterPayouts()`.
export interface OrgPromoterPayoutRow {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  promoterId: string;
  promoterName: string;
  perHead: number;
  commission: number;
  total: number;
  status: 'pending' | 'reminder_sent' | 'received';
}

/** The 7 real permission modules from OrgTeamRoles.tsx — exact strings,
 * used as OrgModulePerms keys. */
export const ORG_PERMISSION_MODULES = [
  'Events & wizard',
  'Attendees & check-in',
  'Guest list',
  'Coupons',
  'Payouts & withdrawals',
  'Reviews',
  'Settings & team',
] as const;
export type OrgPermissionModule = (typeof ORG_PERMISSION_MODULES)[number];

// Personal-account features (shared across every role, not organizer-
// specific) — real shape from prebooze-web/src/types.ts.
export interface PayMethod {
  id: string;
  type: 'upi' | 'card';
  label: string;
  holder?: string;
  expiry?: string;
  isDefault: boolean;
  usedCount?: number;
}

export interface HelpTicket {
  id: string;
  topic: string;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
  replies?: HelpTicketReply[];
}

export interface HelpTicketReply {
  id: string;
  message: string;
  createdAt: string;
  fromStaffId?: string | null;
  fromUserId?: string | null;
  fromStaff?: { name: string } | null;
}
