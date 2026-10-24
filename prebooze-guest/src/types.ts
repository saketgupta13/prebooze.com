/** Shared API contract, ported from prebooze-web/src/types.ts — same shapes
 * the real backend returns, trimmed to what the guest app's screens use.
 * Keep in sync with web's types.ts if the backend contract changes. */

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
  socialLinks: SocialLinks;
  interests: string[];
  phoneVerified: boolean;
  idVerified: boolean;
  profilePct: number;
  joined: string;
  attendanceVisibility?: 'off' | 'followers' | 'public';
  discoverable?: boolean;
  marketingConsent?: boolean;
  profileRewardClaimedAt?: string;
  profileRewardCode?: string;
  // The single elevated role this phone number already holds, if any — a
  // guest app login can still belong to an organizer/promoter/lineup/venue
  // phone number, and that account can't book tickets as a guest (same
  // block web's existingRole() enforces).
  isOrganizer?: boolean;
  isPromoter?: boolean;
  isLineup?: boolean;
  isVenue?: boolean;
}

export interface SocialLinks {
  instagram?: string;
  x?: string;
  facebook?: string;
  youtube?: string;
  linkedin?: string;
  snapchat?: string;
  tiktok?: string;
  other?: string[];
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
  freeCutoff?: string;
  lateFeePrice?: number;
}

export interface LineupItem {
  name: string;
  role: string;
  instagramUrl?: string;
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
  durationHrs: number;
  seriesEndDate?: string | null;
  venueId?: string | null;
  privateCity?: string | null;
  privateLocality?: string | null;
  organizerId?: string | null;
  collaborators?: Organizer[];
  // Display-only co-host credits — a typed name not on Prebooze, no
  // access/revenue implications. See Event.freeTextCollaborators's own
  // schema comment (prebooze-api organizer.service.ts).
  freeTextCollaborators?: { name: string; instagramUrl?: string }[];
  hostedByVenue?: boolean;
  // Third venue mode — a real, publicly-named venue that isn't a Prebooze
  // partner yet. See Event.unlistedVenueName's own schema comment.
  unlistedVenueName?: string | null;
  unlistedVenueCity?: string | null;
  unlistedVenueAddress?: string | null;
  unlistedVenueInstagramUrl?: string | null;
  status: EventStatus;
  exactAddress?: string | null;
  mapLink?: string | null;
  conditions: string[];
  lineup: LineupItem[];
  tiers: TicketTier[];
  posterHue: number;
  posterUrl?: string | null;
  galleryUrls?: string[];
  teaserVideoUrl?: string | null;
  venue?: Venue;
  organizer?: Organizer;
  minPrice?: number;
  recentActivity?: { count: number; window: 'today' | 'week' } | null;
  promoterConfig?: PromoterConfig;
  socialBanners?: { post?: boolean; postUrl?: string; story?: boolean; storyUrl?: string };
}

export interface WaitlistEntry {
  phone: string;
  name: string;
  joinedAt: string;
  status: 'waiting' | 'offered';
}

export interface PromoterConfig {
  enabled: boolean;
  cap: number;
  cutoff: string; // "HH:MM", IST
  allowedPromoters: string[];
  guestListPromoters?: string[];
  perHeadPayout: boolean;
  perHeadAmount: number;
  allowTeams: boolean;
  revenueShare?: Record<string, number>;
}

export type VenueDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type VenueDayTiming = { open: string; close: string; closed: boolean };
export type VenueTimingsByDay = Partial<Record<VenueDayKey, VenueDayTiming>>;

export interface Venue {
  id: string;
  name: string;
  verified: boolean;
  type: string;
  locality: string;
  city: string;
  state?: string;
  country?: string;
  address: string;
  capacity: number;
  rating: number;
  reviewCount?: number;
  followers: number;
  // Real approved-event count (catalog.service.ts's realVenueEventCounts) —
  // same "X events hosted" concept as Organizer.eventsHosted.
  eventsHosted: number;
  amenities: string[];
  about: string;
  timings?: string;
  timingsByDay?: VenueTimingsByDay | null;
  photoHue: number;
  galleryUrls?: string[];
  logoUrl?: string | null;
  socialLinks?: { instagram?: string; facebook?: string; other?: string[] };
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
  eventTypes?: string;
  socialLinks?: { instagram?: string; facebook?: string; other?: string[] };
}

export interface PromoterProfile {
  id: string;
  slug: string;
  name: string;
  verified: boolean;
  city: string;
  bio: string;
  links: string[];
  followers: number;
  eventsPromoted: number;
  guestsBrought: number;
  showRate: number;
  hue: number;
  logoUrl?: string | null;
}

export interface LineupProfile {
  id: string;
  slug: string;
  name: string;
  category: string;
  verified: boolean;
  city: string;
  bio: string;
  logoUrl?: string | null;
  links: string[];
  followers: number;
  eventsPlayed: number;
  hue: number;
  emoji: string;
}

export interface GuestReview {
  id: string;
  author: string;
  rating: number;
  eventTitle?: string;
  text: string;
  date: string;
}

/** A follower/following list entry — the People directory and the
 * followers/following lists on a Person/own-profile page. */
export interface Person {
  id: string;
  username: string;
  name: string;
  city: string;
  verified: boolean;
  avatarUrl?: string | null;
  avatarHue: number;
  bio?: string;
  followers: number;
  going: { id: string; slug: string; title: string }[];
}

/** Full public /u/:username profile — distinct from the logged-in guest's
 * own `User`. Mirrors web's PersonDetail (types.ts) exactly. */
export interface PersonDetail {
  id: string;
  name: string;
  username: string;
  city: string;
  bio?: string;
  avatarUrl?: string;
  avatarHue: number;
  verified: boolean;
  followers: Person[];
  following: Person[];
  going: Event[];
  past: Event[];
  interested: Event[];
}

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
  offlinePaymentMode?: 'self_collected' | 'payment_link';
}

export interface WalletTx {
  id: string;
  type: 'referral_welcome' | 'referral_reward' | 'refund' | 'spend';
  amount: number;
  note: string;
  date: string;
}

export interface PayMethod {
  id: string;
  type: 'upi' | 'card';
  label: string;
  holder?: string;
  expiry?: string;
  isDefault: boolean;
  usedCount?: number;
}

export interface Referral {
  code: string;
  referrerPhone: string;
  refereePhone: string;
  refereeName?: string;
  status: 'joined' | 'qualified';
  createdAt: string;
}

/** A guest's free-entry guest-list signup — POST /p/:eventSlug/:promoterSlug. */
export interface PromoterGuest {
  id: string;
  eventId: string;
  promoterSlug: string;
  name: string;
  phone: string;
  age: string;
  gender: string;
  createdAt: string;
  arrived?: boolean;
  companions?: { name: string }[];
}

/** The resulting rotating free-entry pass — GET /p/pass/:id, public (no
 * auth needed, the guest reaches it via the id in their link). */
export interface PromoterPass extends PromoterGuest {
  event: Event;
}

export interface HelpTicketReply {
  id: string;
  message: string;
  createdAt: string;
  fromStaffId?: string | null;
  fromUserId?: string | null;
  fromStaff?: { name: string } | null;
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

export interface CmsFaq {
  id: string;
  question: string;
  answer: string;
  audience: 'guests' | 'organizers';
  sort: number;
}

export interface CmsTestimonial {
  id: string;
  author: string;
  location: string;
  rating: number;
  quote: string;
  featured: boolean;
  createdAt: string;
}

export interface CmsBlogSummary {
  id: string;
  title: string;
  meta: string;
  category: string | null;
  bannerUrl: string | null;
  updatedAt: string;
}
