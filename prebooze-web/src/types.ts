export type EventStatus = 'approved' | 'pending' | 'rejected' | 'draft';

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
  includes: string[];
  description?: string;
}

export interface LineupItem {
  name: string;
  role: 'Opening DJ' | 'Headline artist' | 'Sponsor' | 'Promoter' | string;
}

export interface PartyRule {
  title: string;
  body: string;
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
  date: string; // ISO
  durationHrs: number;
  venueId: string;
  organizerId: string;
  status: EventStatus;
  rejectionReason?: string;
  conditions: string[];
  rules: PartyRule[];
  lineup: LineupItem[];
  tiers: TicketTier[];
  posterHue: number;
  seo?: { title: string; description: string; slug: string; keywords: string[] };
  promoterConfig?: PromoterConfig;
  // postUrl/storyUrl are the real, persisted upload URLs (admin's real
  // event editor); post/postDataUrl/story/storyDataUrl are the older
  // organizer-console mock's local-only base64 fields — kept alongside
  // rather than replaced, since that flow isn't wired to the real API yet.
  socialBanners?: { post?: boolean; postDataUrl?: string; story?: boolean; storyDataUrl?: string; postUrl?: string; storyUrl?: string }; // 1:1 + 9:16 banners
  bannerDataUrl?: string; // mock-only portrait 3:4 banner (organizer console draft, not real)
  galleryDataUrls?: string[]; // mock-only gallery photos (organizer console draft, not real)
  // Real, persisted media (admin's real event editor — see BACKEND.md):
  posterUrl?: string | null; // real poster image, shown on guest cards & the event page
  galleryUrls?: string[]; // real gallery photos, up to 6
  teaserVideoUrl?: string | null; // real short vertical teaser reel
  // The real catalog API (GET /events, GET /events/:slug) embeds the full
  // venue/organizer objects directly on the event — only present when the
  // event came from a real fetch, not the local mock store.
  venue?: Venue;
  organizer?: Organizer;
  minPrice?: number;
  // Admin-negotiated per-event platform take-rate — set exclusively by an
  // admin (see PATCH /organizer/:id/commission), read-only everywhere else
  // including here. null/undefined = not set yet.
  commission?: number | null;
}

export interface PromoterConfig {
  enabled: boolean;
  cap: number;            // total free-entry passes across all promoters
  cutoff: string;         // free entry valid before this time, e.g. "01:00"
  allowedPromoters: string[]; // promoter slugs the organizer allows
  perHeadPayout: boolean;
  perHeadAmount: number;  // ₹ paid to promoter per verified arrival
  allowTeams: boolean;
}

export interface Venue {
  id: string;
  name: string;
  verified: boolean;
  type: string;
  locality: string;
  city: string;
  address: string;
  capacity: number;
  rating: number;
  followers: number;
  amenities: string[];
  about: string;
  timings?: string; // e.g. "Wed–Sun · 8 PM – 2 AM"
  photoHue: number;
}

export interface Organizer {
  id: string;
  brandName: string;
  username: string;
  verified: boolean;
  city: string;
  since: string;
  rating: number;
  reviewCount: number;
  eventsHosted: number;
  followers: number;
  following: number;
  about: string;
  logoHue: number;
}

/** A paid featured placement — surfaces an item first in its own slider/directory. */
export interface Featured {
  id: string;
  type: 'event' | 'organizer' | 'promoter' | 'lineup' | 'venue';
  refId: string; // event id | organizer id | promoter slug | lineup slug | venue id
  city: string;
  status: 'pending' | 'active' | 'rejected' | 'expired';
  billing: 'per_event' | 'monthly';
  amount: number;
  createdAt: string;
  expiresAt: string;
}

/** A followable guest — the social graph behind "Who's going". */
export interface Person {
  id: string;
  name: string;
  username: string; // handle for /u/:username
  city: string;
  avatarHue: number;
  bio?: string;
  verified?: boolean;
  followers: number;    // aggregate follower count
  follows?: string[];   // person ids this person follows (social graph)
}

/** One person's relationship to one event. */
export interface AttendanceRecord {
  personId: string;
  eventId: string;
  status: 'going' | 'interested';
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  eventTitle: string;
  text: string;
}

/** Every role a guest can leave a review on — guests themselves are never reviewable. */
export type ReviewTargetType = 'organizer' | 'promoter' | 'venue' | 'lineup';

export interface BookingGuest {
  name: string;
  checkedIn: boolean;
  gender?: string;
  whatsapp?: string;
}

export interface Booking {
  id: string; // #TKT-xxxxx
  eventId: string;
  tierId: string;
  tierName: string;
  qty: number;
  subtotal: number;
  fee: number;
  discount: number;
  total: number;
  couponCode?: string;
  status: 'confirmed' | 'cancelled' | 'refunded' | 'refund_requested';
  guests: BookingGuest[];
  mainGuest: string;
  whatsapp: string;
  createdAt: string;
  promoterRef?: string; // promoter slug credited with this sale (affiliate commission)
  event?: Event; // embedded event+venue — present on real (live-backend) bookings only
  qrToken?: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percent' | 'flat';
  value: number;
  maxDiscount?: number;
  usageLimit: number;
  used: number;
  perUserLimit: number;
  eventScope: string; // 'all' or event title
  validTill: string;
  firstTimeOnly: boolean;
  status: 'active' | 'paused';
}

export interface Payout {
  date: string;
  event: string;
  amount: number;
  status: 'paid' | 'processing';
}

export interface Attendee {
  bookingId: string;
  name: string;
  phone: string;
  tickets: string;
  qty: number;
  status: 'checked-in' | 'confirmed' | 'refunded';
}

export interface User {
  phone: string;
  name: string;
  username: string;
  email: string;
  city: string;
  dob: string;
  gender: string;
  profession: string;
  languages: string;
  bio: string;
  socials: string;
  interests: string[];
  phoneVerified: boolean;
  idVerified: boolean;
  profilePct: number;
  joined: string;
  isOrganizer: boolean;
  orgBrand?: string;
  orgUsername?: string;
  isLineup?: boolean;
  lineupName?: string;
  lineupCategory?: string;
  lineupUsername?: string;
  isPromoter?: boolean;
  promoterBrand?: string;
  promoterUsername?: string;
  promoterPlan?: string;
  isVenue?: boolean;
  venueName?: string;
  venueId?: string; // links to the Venue record created at onboarding
  // Elevated roles (organizer/promoter/lineup/venue) are always manually
  // reviewed by the team — the isOrganizer/isPromoter/isLineup/isVenue flags
  // above only flip true once approved. Guest ID verification (idVerified)
  // stays automatic and is unaffected by this. See BACKEND.md "Identity & KYC".
  pendingRole?: 'organizer' | 'promoter' | 'lineup' | 'venue';
  roleStatus?: 'pending' | 'approved' | 'rejected';
  roleRejectionReason?: string;
  attendanceVisibility?: 'off' | 'followers' | 'public'; // who can see events I'm attending (default off)
  autoRenew?: boolean; // auto-renew subscriptions / featured placements
}

export interface PayMethod {
  id: string;
  type: 'upi' | 'card';
  label: string; // e.g. "riya@upi" or "Visa •••• 4242"
  holder?: string; // card-holder name
  expiry?: string; // MM/YY — CVV is never stored
  isDefault: boolean;
}

export interface WaitlistEntry {
  phone: string;
  name: string;
  joinedAt: string;
  status: 'waiting' | 'offered';
}

export interface JobApplication {
  id: string;
  jobId: string;
  name: string;
  email: string;
  phone: string;
  note: string;
  cv?: string; // uploaded CV file name
  appliedAt: string;
}

export interface HelpTicket {
  id: string;
  topic: string;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
}
