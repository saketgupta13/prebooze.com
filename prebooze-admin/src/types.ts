export type EventStatus = 'live' | 'pending' | 'draft';
export type BookingStatus = 'refund_requested' | 'paid' | 'checked_in' | 'refunded';
export type CustomerStatus = 'active' | 'unverified' | 'blocked';
export type OrganizerStatus = 'approved' | 'pending' | 'rejected';
export type Gender = 'all' | 'women' | 'men' | 'other';
export type Role = 'admin' | 'staff';

// Elevated-role signups (organizer/promoter/lineup/venue) are always manual —
// a human on the team reviews every application here before it becomes a
// live entity in Organizers/Promoters/Line-ups/Venues. Guest ID verification
// is the one automatic path and doesn't go through this queue.
export type KycKind = 'organizer' | 'promoter' | 'lineup' | 'venue';
export interface KycApplication {
  id: string;
  kind: KycKind;
  applicantName: string;
  applicantPhone: string;
  city: string;
  payload: Record<string, string>; // brand/username/gstin/bio/etc — role-specific
  documents: { type: string; note: string }[]; // e.g. "Government ID", "Selfie", "Operating license"
  status: OrganizerStatus; // approved / pending / rejected
  submittedAt: string;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface Tier {
  name: string;
  price: number;
  qty: number;
  sold: number;
  description?: string; // what's included — shown under the tier on the guest page
}

export interface AdminEvent {
  id: string;
  title: string;
  category: string;
  subCategory?: string;
  socialPost?: boolean;
  socialPostDataUrl?: string;
  socialStory?: boolean;
  socialStoryDataUrl?: string;
  venue: string;
  date: string;
  time: string;
  organizer: string;
  city: string;
  status: EventStatus;
  sold: number;
  cap: number;
  revenue: number;
  commission: number | null; // per-event rate — no global setting
  durationHrs?: number; // total hours
  tiers: Tier[];
  description?: string;
  rules?: string;
  lineup?: string;
  hasBanner?: boolean;
  posterDataUrl?: string;
  galleryDataUrls?: string[];
  teaserDataUrl?: string;
  paidOut?: boolean;
  payoutUtr?: string;
  seo?: Seo;
}

export interface AdminBooking {
  id: string;
  guest: string;
  phone: string;
  eventId: string;
  qty: number;
  amount: number;
  status: BookingStatus;
  method: string;
  guests: string[]; // every attendee on the group QR (main guest first)
}

export interface Customer {
  id: string;
  name: string;
  verified: boolean;
  gender: string;
  city: string;
  bookings: number;
  spend: number;
  status: CustomerStatus;
  segment: 'guests' | 'organizers';
  phone?: string;
  email?: string;
  notes?: string;
}

export interface Organizer {
  id: string;
  name: string;
  contact: string;
  city: string;
  events: number;
  kyc: string;
  status: OrganizerStatus;
  contactPerson?: string;
  phone?: string;
  eventTypes?: string;
  about?: string;
  links?: string;
  gstin?: string;
  pan?: string;
  bankLast4?: string;
  seo?: Seo;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  capacity: number | string;
  events: number;
  license: string;
  verified: boolean;
  address?: string;
  type?: string;
  contact?: string;
  rules?: string;
  about?: string;
  timings?: string;
  amenities?: string[];
  seo?: Seo;
}

export interface Promo {
  code: string;
  discountLabel: string;
  description?: string;
  scope: string;
  gender: Gender;
  usedLabel: string;
  status: 'active' | 'expired' | 'paused';
  type?: 'percent' | 'flat';
  value?: number;
  maxCap?: number;
}

export interface Seo {
  title: string;
  description: string;
  keywords: string;
}

export interface BlogCategory {
  id: string;
  name: string;
  hasBanner?: boolean;
  bannerDataUrl?: string;
  seo?: Seo;
}

export interface LedgerEntry {
  id: string;
  kind: 'income' | 'expense';
  category: string;
  amount: number;
  note?: string;
  date: string;
  auto?: boolean; // auto-posted (e.g. ticket commission) — not editable
}

export interface GuestEntry {
  id: string;
  eventId: string;
  name: string;
  phone?: string;
  plusOnes: number;
  companions?: { name: string; phone?: string }[]; // name + phone for every plus-one
  addedBy: string;
  arrived?: boolean;
}

export interface PromoterPayout {
  id: string;
  date: string;
  amount: number;
  status: 'processing' | 'paid';
}

export interface Promoter {
  id: string;
  name: string;
  contact: string;
  city: string;
  status: OrganizerStatus; // approved / pending / rejected
  kyc: string;
  plan: string;
  guestsThisMonth: number;
  eventsPromoted: number;
  showRate: number;
  bio?: string;
  // earnings & payouts (admin visibility)
  guestsBrought?: number;    // lifetime guests brought
  perHeadEarned?: number;    // ₹ from per-head payouts on verified arrivals
  commissionEarned?: number; // ₹ from affiliate ticket commission
  withdrawn?: number;        // ₹ already paid out
  payouts?: PromoterPayout[];
}

export interface FeaturedRequest {
  id: string;
  type: 'event' | 'organizer' | 'promoter' | 'lineup' | 'venue';
  name: string;
  refId: string;
  city: string;
  billing: 'per_event' | 'monthly';
  amount: number;
  status: 'pending' | 'active' | 'rejected';
  requestedAt: string;
  expiresAt: string;
}

export interface FeaturedRates {
  perEvent: number;
  organizerMonthly: number;
  promoterMonthly: number;
  lineupMonthly: number;
  venueMonthly: number;
}

export interface ReferralRates {
  referrer: number; // ₹ credit when the friend makes their first paid booking
  referee: number;  // ₹ welcome credit on signup
}

export interface AdminReferral {
  id: string;
  referrer: string;
  referrerPhone: string;
  referee: string;
  refereePhone: string;
  status: 'joined' | 'qualified';
  joinedAt: string;
}

export interface LocCity { name: string; enabled: boolean; top?: boolean; icon?: string; iconUploaded?: boolean }
export interface LocState { name: string; enabled: boolean; cities: LocCity[] }
export interface LocCountry { name: string; enabled: boolean; states: LocState[] }
export interface LocPath { country: string; state?: string; city?: string }

export interface AdminJob {
  id: string;
  title: string;
  team: string;
  loc: string;
  type: string;
  status: 'open' | 'closed';
  about?: string;
}

export interface JobApplicant {
  id: string;
  jobId: string;
  name: string;
  email: string;
  phone: string;
  note: string;
  appliedAt: string;
}

export interface Reel {
  id: string;
  title: string;
  hue: number;
  active: boolean;
  videoDataUrl?: string;
}

export interface AbandonedCart {
  id: string;
  guest: string;
  phone: string;
  eventId: string;
  qty: number;
  amount: number;   // recoverable ₹ (what the guest would have paid)
  tiers: string;    // e.g. "2× VIP"
  leftAt: string;   // human label, e.g. "12m", "2h", "1d"
  reminded: boolean;
  status: 'abandoned' | 'recovered';
}

export type ReviewTargetType = 'organizer' | 'promoter' | 'venue' | 'lineup';

export interface AdminReview {
  id: string;
  author: string;
  rating: number;
  eventTitle: string;
  targetType: ReviewTargetType;
  targetName: string;
  text: string;
  date: string;
}

export interface Notification {
  id: string;
  icon: string;
  text: string;
  time: string;
  read: boolean;
  to?: string; // route to open on click
}

export interface Banner {
  id: string;
  title: string;
  statusLabel: string;
  heading?: string;
  description?: string;
  ctaLabel?: string;
  ctaLink?: string;
  hasImage?: boolean;
  imageDataUrl?: string;
}

export interface Category {
  icon: string;
  name: string;
  count: number;
  hasImage?: boolean;
  imageDataUrl?: string;
  seo?: Seo;
}

export interface Blog {
  id: string;
  title: string;
  meta: string;
  status: 'published' | 'draft' | 'scheduled';
  category?: string;
  content?: string;
  hasBanner?: boolean;
  bannerDataUrl?: string;
  seo?: Seo;
}

export interface SitePage {
  title: string;
  slug: string;
  content?: string;
  navGroup?: string;
  seo?: Seo;
}

export interface StaffMember {
  name: string;
  role: string;
  lastActive: string;
  city?: string;
}

export interface PermSet {
  view: boolean;
  edit: boolean;
  approve: boolean;
}

/** role name -> module name -> permissions */
export type RoleMatrix = Record<string, Record<string, PermSet>>;

export interface Settings {
  bookingFee: number;
  gstPct: number;
  feeLabel: string;
  absorbedBy: 'Organizer' | 'Guest' | 'Split';
  payoutDay: string;
  autoPayout: boolean;
  weeklyEmail: boolean;
  whatsappAlerts: boolean;
  require2fa: boolean;
  maintenanceMode: boolean;
  socials: { instagram: string; x: string; youtube: string; whatsapp: string; facebook: string };
  siteSeo: Seo;
  contact: { email: string; phone: string; address: string; organizerEmail: string };
  footerCopyright: string;
}

export interface Testimonial {
  id: string;
  author: string;
  location: string;
  rating: number;
  quote: string;
  featured: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  audience: 'guests' | 'organizers';
}

export interface Policy {
  id: string;
  title: string;
  slug: string;
  updated: string;
  sections: { heading: string; body: string }[];
  seo?: Seo;
}

export interface MenuLink {
  label: string;
  to: string;
}

export interface FooterGroup {
  title: string;
  links: MenuLink[];
}

export interface MenuConfig {
  header: MenuLink[];
  footer: FooterGroup[];
}

export interface Lineup {
  id: string;
  name: string;
  category: string; // Artist / DJ / Band / Sponsor / Promoter / Host …
  description: string;
  city?: string;
  links?: string;
  hasImage?: boolean;
  imageDataUrl?: string;
  followers: number;
  verified: boolean;
}
