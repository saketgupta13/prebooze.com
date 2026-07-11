import type {
  AdminBooking,
  AdminEvent,
  Banner,
  Blog,
  Category,
  Customer,
  Organizer,
  Promo,
  SitePage,
  StaffMember,
  Venue,
} from '../types';

// Seed data mirrors design/admin/Prebooze Prototype.dc.html — the Phase 1 source of truth.

export const SEED_EVENTS: AdminEvent[] = [
  {
    id: 'e1', title: 'Indie Night Live', category: 'Concerts', venue: 'Arena Hall',
    date: '24 Jul', time: '8:00 PM', organizer: 'LiveWire Ent.', status: 'live',
    sold: 312, cap: 400, revenue: 94000, commission: 10,
    tiers: [
      { name: 'Early bird', price: 290, qty: 100, sold: 100 },
      { name: 'General', price: 450, qty: 250, sold: 212 },
      { name: 'VIP Couch', price: 1200, qty: 50, sold: 0 },
    ],
  },
  {
    id: 'e2', title: "Summer Fest '26", category: 'Festivals', venue: 'Riverside Grounds',
    date: '1 Aug', time: '2:00 PM', organizer: 'FestCrew', status: 'live',
    sold: 1105, cap: 2000, revenue: 210000, commission: 8,
    tiers: [
      { name: 'Day pass', price: 650, qty: 1500, sold: 1000 },
      { name: 'VIP', price: 2200, qty: 500, sold: 105 },
    ],
  },
  {
    id: 'e3', title: 'Stand-up Sunday', category: 'Comedy', venue: 'Comedy Cave',
    date: '2 Aug', time: '6:00 PM', organizer: 'NightOwl Co.', status: 'pending',
    sold: 0, cap: 180, revenue: 0, commission: null,
    tiers: [
      { name: 'General', price: 150, qty: 150, sold: 0 },
      { name: 'Front row', price: 600, qty: 30, sold: 0 },
    ],
  },
  {
    id: 'e4', title: 'Acoustic Evenings', category: 'Concerts', venue: 'Arena Hall',
    date: '7 Aug', time: '7:00 PM', organizer: 'LiveWire Ent.', status: 'draft',
    sold: 40, cap: 150, revenue: 9000, commission: 12,
    tiers: [{ name: 'General', price: 225, qty: 150, sold: 40 }],
  },
  {
    id: 'e5', title: 'Techno Tuesday', category: 'Festivals', venue: 'The Loft',
    date: '12 Aug', time: '9:00 PM', organizer: 'FestCrew', status: 'live',
    sold: 88, cap: 120, revenue: 26400, commission: 9,
    tiers: [{ name: 'General', price: 300, qty: 120, sold: 88 }],
  },
];

export const SEED_BOOKINGS: AdminBooking[] = [
  { id: '#8412', guest: 'Sam Rivera', phone: '+91 98••• ••210', eventId: 'e1', qty: 2, amount: 1450, status: 'refund_requested', method: 'UPI' },
  { id: '#8420', guest: 'Priya K.', phone: '+91 87••• ••330', eventId: 'e2', qty: 4, amount: 2900, status: 'paid', method: 'Card' },
  { id: '#8419', guest: 'Arjun M.', phone: '+91 99••• ••118', eventId: 'e1', qty: 1, amount: 580, status: 'checked_in', method: 'UPI' },
  { id: '#8415', guest: 'Nia T.', phone: '+91 76••• ••902', eventId: 'e2', qty: 2, amount: 1160, status: 'refunded', method: 'UPI' },
];

export const SEED_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Sam Rivera', verified: true, gender: 'M', city: 'Austin', bookings: 14, spend: 18200, status: 'active', segment: 'guests' },
  { id: 'c2', name: 'Priya K.', verified: true, gender: 'F', city: 'Austin', bookings: 6, spend: 7400, status: 'active', segment: 'guests' },
  { id: 'c3', name: 'Arjun M.', verified: false, gender: 'M', city: 'Dallas', bookings: 2, spend: 1100, status: 'unverified', segment: 'guests' },
  { id: 'c4', name: 'R. Gupta', verified: false, gender: '—', city: 'Austin', bookings: 1, spend: 0, status: 'blocked', segment: 'guests' },
  { id: 'c5', name: 'LiveWire Ent.', verified: true, gender: '—', city: 'Austin', bookings: 18, spend: 0, status: 'active', segment: 'organizers' },
];

export const SEED_ORGANIZERS: Organizer[] = [
  { id: 'o1', name: 'LiveWire Ent.', contact: 'contact@livewire.co', city: 'Austin', events: 18, kyc: 'verified', status: 'approved' },
  { id: 'o2', name: 'FestCrew', contact: 'hello@festcrew.io', city: 'Austin', events: 11, kyc: 'verified', status: 'approved' },
  { id: 'o3', name: 'NightOwl Co.', contact: 'bookings@nightowl.co', city: 'Dallas', events: 2, kyc: 'pending', status: 'pending' },
  { id: 'o4', name: 'Sunset Sessions', contact: 'team@sunsetsessions.com', city: 'Houston', events: 0, kyc: 'submitted', status: 'pending' },
  { id: 'o5', name: 'Rowdy Promotions', contact: 'info@rowdyprom.com', city: 'Austin', events: 0, kyc: 'flagged', status: 'rejected' },
];

export const SEED_VENUES: Venue[] = [
  { id: 'v1', name: 'Arena Hall', capacity: 400, events: 18, license: "valid till Mar '27", verified: true, address: '123 5th St, Austin, TX' },
  { id: 'v2', name: 'Riverside Grounds', capacity: 2000, events: 11, license: "valid till Jan '27", verified: true, address: 'Riverside Park, Austin, TX' },
  { id: 'v3', name: 'Comedy Cave', capacity: 180, events: 9, license: 'expires 12 Aug ⚠', verified: false, address: '88 6th St, Austin, TX' },
  { id: 'v4', name: 'The Loft', capacity: 120, events: 7, license: "valid till Nov '26", verified: true, address: '5th & Lamar, Austin, TX' },
];

export const SEED_PROMOS: Promo[] = [
  { code: 'FEST10', discountLabel: '10% ≤ ₹100', scope: 'Summer Fest', gender: 'all', usedLabel: '184/500', status: 'active' },
  { code: 'LADIESNIGHT', discountLabel: '50% ≤ ₹300', scope: 'Indie Night', gender: 'women', usedLabel: '67/200', status: 'active' },
  { code: 'FIRSTGIG', discountLabel: '₹150 flat', scope: 'first booking', gender: 'all', usedLabel: '96/∞', status: 'active' },
  { code: 'DIWALI25', discountLabel: '25% ≤ ₹250', scope: 'all events', gender: 'all', usedLabel: '890/1k', status: 'expired' },
];

export const SEED_BANNERS: Banner[] = [
  { title: 'Summer Fest hero', statusLabel: 'Live · #1' },
  { title: 'Host with us', statusLabel: 'Live · #2' },
  { title: 'Diwali promo', statusLabel: 'Scheduled' },
];

export const SEED_CATEGORIES: Category[] = [
  { icon: '🎵', name: 'Concerts', count: 22 },
  { icon: '😂', name: 'Comedy', count: 9 },
  { icon: '🎪', name: 'Festivals', count: 6 },
  { icon: '🏠', name: 'House parties', count: 0 },
];

export const SEED_BLOGS: Blog[] = [
  { title: 'Top 10 gigs this monsoon', meta: 'by Dev P. · 2.1k views', status: 'published' },
  { title: 'How to host a sold-out show', meta: 'by Dev P. · targets organizers', status: 'draft' },
  { title: 'Venue spotlight: Riverside', meta: 'scheduled 12 Jul, 9 AM', status: 'scheduled' },
];

export const SEED_PAGES: SitePage[] = [
  { title: 'About us', slug: '/about' },
  { title: 'Host with us', slug: '/host' },
  { title: 'Refund policy', slug: '/refunds' },
  { title: 'Terms · Privacy · Contact · FAQs', slug: '/terms…' },
  { title: 'Corporate events', slug: '/corporate' },
];

export const SEED_STAFF: StaffMember[] = [
  { name: 'You · owner@prebooze', role: 'Owner', lastActive: 'now' },
  { name: 'Meera J.', role: 'Finance', lastActive: '2h ago' },
  { name: 'Dev P.', role: 'Content', lastActive: '1d ago' },
  { name: 'Gate crew (4)', role: 'Scanner only', lastActive: 'at event' },
];

export const GUEST_SITE_URL = 'http://localhost:5173';

export const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
