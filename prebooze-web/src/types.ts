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

export interface Review {
  id: string;
  author: string;
  rating: number;
  eventTitle: string;
  text: string;
}

export interface BookingGuest {
  name: string;
  checkedIn: boolean;
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
  status: 'confirmed' | 'cancelled' | 'refunded';
  guests: BookingGuest[];
  mainGuest: string;
  whatsapp: string;
  createdAt: string;
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
  isPromoter?: boolean;
  promoterBrand?: string;
  promoterUsername?: string;
  promoterPlan?: string;
}
