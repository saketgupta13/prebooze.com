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
  // Optional — a private-address event (organizer keeps the exact venue
  // off the platform, tells booked guests themselves) has no venueId at
  // all; privateCity/privateLocality are set instead and that's all guests
  // ever see. Exactly one of the two modes is set, never both.
  venueId?: string | null;
  privateCity?: string | null;
  privateLocality?: string | null;
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
  // Real recency signal from GET /events/:slug only (not the list endpoint)
  // — "3 booked today", falling back to "this week" when today is empty,
  // null/undefined when there's been no real activity in either window.
  recentActivity?: { count: number; window: 'today' | 'week' } | null;
}

export interface PromoterConfig {
  enabled: boolean;
  cap: number;            // total free-entry passes across all promoters
  cutoff: string;         // free entry valid before this time, e.g. "01:00"
  allowedPromoters: string[]; // promoter slugs the organizer allows on this event at all
  // Subset of allowedPromoters with Guest list (free-entry) mode on.
  // Missing (events saved before this field existed) defaults to every
  // allowedPromoters entry — see CreateEvent.tsx / BookingsService.
  guestListPromoters?: string[];
  perHeadPayout: boolean;
  perHeadAmount: number;  // ₹ paid to promoter per verified arrival — only for guestListPromoters
  allowTeams: boolean;
  // Individually negotiated with each promoter — not one flat rate for the
  // whole event. slug -> % (0-100) of the base ticket price, added on top
  // as a guest-funded markup for any paid booking attributed to that
  // promoter's ref (see BookingsService.priceHold). A promoter can be in
  // guestListPromoters (free-list only) without an entry here, or have
  // both — the two modes are independent, picked per promoter.
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
  /** Set when the owner has requested a city change still awaiting admin
   * approval (VenueService.updateListing gates city edits) — city itself
   * stays unchanged until an admin approves it. */
  pendingCity?: string | null;
  address: string;
  capacity: number;
  rating: number;
  reviewCount?: number; // real, aggregated from VenueReview — absent on offline-mode mock seed data
  followers: number;
  amenities: string[];
  about: string;
  timings?: string; // e.g. "Wed–Sun · 8 PM – 2 AM"
  photoHue: number;
  galleryUrls?: string[]; // real, uploaded via POST /venue/upload
  logoUrl?: string | null; // real, uploaded via POST /venue/upload — same role as Organizer.logoUrl
  socialLinks?: { instagram?: string; facebook?: string; other?: string[] }; // public — same shape as Organizer.socialLinks
  contactPerson?: string; // admin/venue-owner only — never in the public catalog select
  contactPersonPhone?: string;
}

export interface Organizer {
  id: string;
  brandName: string;
  username: string;
  verified: boolean;
  city: string;
  since: string;
  createdAt?: string; // real signup timestamp — since is year-only, this is what gives "Joined" a real month
  rating: number;
  reviewCount: number;
  eventsHosted: number;
  followers: number;
  following: number;
  about: string;
  logoHue: number;
  logoUrl?: string | null; // real, uploaded logo — public, same as the public catalog's photoHue/galleryUrls pattern
  country?: string;
  state?: string;
  pincode?: string;
  socialLinks?: { instagram?: string; facebook?: string; other?: string[] }; // public — real handles, shown on the profile
  // Business/compliance fields — only present on the real GET /organizer/me
  // self-serve response, never on the public catalog (GET /organizers).
  contact?: string;
  contactPerson?: string;
  phone?: string;
  eventTypes?: string;
  gstin?: string;
  pan?: string;
  bankLast4?: string;
  bankAccountNumber?: string;
  bankName?: string;
  accountHolderName?: string;
  ifsc?: string;
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
}

export interface LineupProfile {
  id: string;
  slug: string;
  name: string;
  category: string;
  verified: boolean;
  city: string;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  bio: string;
  logoUrl?: string | null;
  links: string[];
  followers: number;
  eventsPlayed: number;
  hue: number;
  emoji: string;
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
  paid?: boolean;
}

/** A followable guest — the social graph behind "Who's going". */
export interface Person {
  id: string;
  name: string;
  username: string; // handle for /u/:username
  city: string;
  avatarHue: number;
  avatarUrl?: string;
  bio?: string;
  verified?: boolean;
  followers: number;    // aggregate follower count
  follows?: string[];   // person ids this person follows (social graph)
}

/** Real GET /people/:username response — a genuine User row (not the
 * seeded Person directory table Home.tsx's slider still reads). followers/
 * following are the real, full Person-shaped lists (not just a count) so
 * PersonProfile.tsx can compute mutuals/social-proof client-side by
 * intersecting with the viewer's own `following` from AppContext. */
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
  interested: Event[];
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
  gender?: 'all' | 'women' | 'men' | 'other';
  description?: string;
}

export interface Invoice {
  id: string;
  number: string;
  type: 'booking' | 'featured';
  refId: string;
  role: 'guest' | 'organizer' | 'promoter' | 'venue' | 'lineup';
  payerName: string;
  payerEmail?: string | null;
  payerPhone?: string | null;
  city?: string | null;
  description: string;
  subtotal: number;
  gstPct: number;
  gstAmount: number;
  total: number;
  status: 'issued' | 'void';
  issuedAt: string;
  lastSentAt?: string | null;
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

/** Per-platform profile links — a guest can fill in as many as they like. */
export interface SocialLinks {
  instagram?: string;
  x?: string;
  facebook?: string;
  youtube?: string;
  linkedin?: string;
  snapchat?: string;
  tiktok?: string;
}
export const SOCIAL_PLATFORMS: { key: keyof SocialLinks; label: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', placeholder: 'instagram.com/username' },
  { key: 'x', label: 'X (Twitter)', placeholder: 'x.com/username' },
  { key: 'facebook', label: 'Facebook', placeholder: 'facebook.com/username' },
  { key: 'youtube', label: 'YouTube', placeholder: 'youtube.com/@username' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/username' },
  { key: 'snapchat', label: 'Snapchat', placeholder: 'snapchat.com/add/username' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'tiktok.com/@username' },
];

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
  gender: string;
  profession: string;
  languages: string;
  bio: string;
  socials: string; // legacy free-text field, superseded by socialLinks
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
  lineupName?: string;
  lineupCategory?: string;
  lineupUsername?: string;
  lineupLogoUrl?: string; // real, uploaded logo — same role as orgLogoUrl
  isPromoter?: boolean;
  promoterBrand?: string;
  promoterUsername?: string;
  promoterPlan?: string;
  isVenue?: boolean;
  venueName?: string;
  venueId?: string; // links to the Venue record created at onboarding
  venueLogoUrl?: string; // real, uploaded logo — same role as orgLogoUrl
  // Elevated roles (organizer/promoter/lineup/venue) are always manually
  // reviewed by the team — the isOrganizer/isPromoter/isLineup/isVenue flags
  // above only flip true once approved. Guest ID verification (idVerified)
  // stays automatic and is unaffected by this. See BACKEND.md "Identity & KYC".
  pendingRole?: 'organizer' | 'promoter' | 'lineup' | 'venue';
  roleStatus?: 'pending' | 'approved' | 'rejected';
  roleRejectionReason?: string;
  attendanceVisibility?: 'off' | 'followers' | 'public'; // who can see events I'm attending (default off)
  autoRenew?: boolean; // auto-renew subscriptions / featured placements
  // Set once the soft-required "finish your profile" step is completed —
  // see FinishProfile.tsx / POST /me/complete-profile-reward. Presence of
  // profileRewardClaimedAt is what hides the post-booking nudge going forward.
  profileRewardClaimedAt?: string;
  profileRewardCode?: string;
}

export interface PayMethod {
  id: string;
  type: 'upi' | 'card';
  label: string; // e.g. "riya@upi" or "Visa •••• 4242"
  holder?: string; // card-holder name
  expiry?: string; // MM/YY — CVV is never stored
  isDefault: boolean;
  usedCount?: number; // only set on auto-saved methods (see WalletService.saveUsedMethod) — a repeat checkout with the same method increments this instead of creating a duplicate row
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
  cv?: string; // uploaded CV file URL
  appliedAt: string;
}

export interface CareerJob {
  id: string;
  title: string;
  team: string;
  loc: string;
  type: string;
  status: 'open' | 'closed';
  about: string;
  responsibilities: string[];
  requirements: string[];
}

export interface HelpTicket {
  id: string;
  topic: string;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

/** Real CMS content — GET /testimonials, /faqs, /blogs, /policies, /banners
 * (admin's Content section). prebooze-web previously never called any of
 * these; every guest-facing "content" page (Testimonials.tsx, static/Faqs,
 * static/Blog(Post), static/Legal, Home.tsx's testimonial slider) read a
 * hardcoded data/mock.ts array instead. */
export interface CmsTestimonial {
  id: string;
  author: string;
  location: string;
  rating: number;
  quote: string;
  featured: boolean;
  createdAt: string;
}

export interface CmsFaq {
  id: string;
  question: string;
  answer: string;
  audience: 'guests' | 'organizers';
  sort: number;
}

export interface CmsBlogSummary {
  id: string;
  title: string;
  meta: string;
  category: string | null;
  bannerUrl: string | null;
  updatedAt: string;
}

export interface CmsBlog extends CmsBlogSummary {
  content: string | null;
  createdAt: string;
}

export interface CmsPolicySummary {
  id: string;
  title: string;
  slug: string;
  updatedAt: string;
}

export interface CmsPolicy extends CmsPolicySummary {
  sections: { heading: string; body: string }[];
}
