import type {
  AdminBooking,
  AdminEvent,
  Banner,
  Blog,
  Category,
  Customer,
  KycApplication,
  LocCountry,
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
    date: '24 Jul', time: '8:00 PM', organizer: 'LiveWire Ent.', city: 'Austin', status: 'live',
    sold: 312, cap: 400, revenue: 94000, commission: 10,
    tiers: [
      { name: 'Early bird', price: 290, qty: 100, sold: 100 },
      { name: 'General', price: 450, qty: 250, sold: 212 },
      { name: 'VIP Couch', price: 1200, qty: 50, sold: 0 },
    ],
  },
  {
    id: 'e2', title: "Summer Fest '26", category: 'Festivals', venue: 'Riverside Grounds',
    date: '1 Aug', time: '2:00 PM', organizer: 'FestCrew', city: 'Austin', status: 'live',
    sold: 1105, cap: 2000, revenue: 210000, commission: 8,
    tiers: [
      { name: 'Day pass', price: 650, qty: 1500, sold: 1000 },
      { name: 'VIP', price: 2200, qty: 500, sold: 105 },
    ],
  },
  {
    id: 'e3', title: 'Stand-up Sunday', category: 'Comedy', venue: 'Comedy Cave',
    date: '2 Aug', time: '6:00 PM', organizer: 'NightOwl Co.', city: 'Dallas', status: 'pending',
    sold: 0, cap: 180, revenue: 0, commission: null,
    tiers: [
      { name: 'General', price: 150, qty: 150, sold: 0 },
      { name: 'Front row', price: 600, qty: 30, sold: 0 },
    ],
  },
  {
    id: 'e4', title: 'Acoustic Evenings', category: 'Concerts', venue: 'Arena Hall',
    date: '7 Aug', time: '7:00 PM', organizer: 'LiveWire Ent.', city: 'Austin', status: 'draft',
    sold: 40, cap: 150, revenue: 9000, commission: 12,
    tiers: [{ name: 'General', price: 225, qty: 150, sold: 40 }],
  },
  {
    id: 'e5', title: 'Techno Tuesday', category: 'Festivals', venue: 'The Loft',
    date: '12 Aug', time: '9:00 PM', organizer: 'FestCrew', city: 'Houston', status: 'live',
    sold: 88, cap: 120, revenue: 26400, commission: 9,
    tiers: [{ name: 'General', price: 300, qty: 120, sold: 88 }],
  },
];

export const SEED_BOOKINGS: AdminBooking[] = [
  {
    id: '#9001', guest: 'Sam Rivera', phone: '+91 98000 37210', eventId: 'e1', qty: 3, amount: 1466, status: 'paid', method: 'UPI',
    guests: [
      { name: 'Sam Rivera', phone: '+91 98000 37210', verified: true },
      { name: 'Neha Kapoor', phone: '+91 98212 34567' },
      { name: 'Rohan Bhatt', phone: '+91 99323 45678' },
    ],
  },
  {
    id: '#9002', guest: 'Priya K.', phone: '+91 87000 74330', eventId: 'e2', qty: 2, amount: 1461, status: 'checked_in', method: 'Card',
    guests: [
      { name: 'Priya K.', phone: '+91 87000 74330', verified: true },
      { name: 'Kabir Anand', phone: '+91 97434 56789' },
    ],
  },
  {
    id: '#9003', guest: 'Arjun M.', phone: '+91 99001 11118', eventId: 'e5', qty: 1, amount: 335, status: 'refund_requested', method: 'UPI',
    guests: [{ name: 'Arjun M.', phone: '+91 99001 11118', verified: true }],
  },
  {
    id: '#9004', guest: 'R. Gupta', phone: '+91 90112 23344', eventId: 'e1', qty: 2, amount: 940, status: 'refunded', method: 'UPI',
    guests: [
      { name: 'R. Gupta', phone: '+91 90112 23344' },
      { name: 'Divya Nair', phone: '+91 96545 67890' },
    ],
  },
  {
    id: '#9005', guest: 'Meera Iyer', phone: '+91 95656 78901', eventId: 'e2', qty: 4, amount: 2782, status: 'paid', method: 'Card',
    guests: [
      { name: 'Meera Iyer', phone: '+91 95656 78901', verified: true },
      { name: 'Farhan Sheikh', phone: '+91 94767 89012' },
      { name: 'Ananya Rao', phone: '+91 93878 90123' },
      { name: 'Vikram Sethi', phone: '+91 92989 01234' },
    ],
  },
  {
    id: '#9006', guest: 'Ishita Malhotra', phone: '+91 91090 12345', eventId: 'e5', qty: 2, amount: 661, status: 'checked_in', method: 'UPI',
    guests: [
      { name: 'Ishita Malhotra', phone: '+91 91090 12345', verified: true },
      { name: 'Aditya Kulkarni', phone: '+91 90101 23456' },
    ],
  },
];

export const SEED_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Sam Rivera', verified: true, gender: 'M', city: 'Austin', bookings: 14, spend: 18200, status: 'active', segment: 'guests', phone: '+91 98000 37210' },
  { id: 'c2', name: 'Priya K.', verified: true, gender: 'F', city: 'Austin', bookings: 6, spend: 7400, status: 'active', segment: 'guests', phone: '+91 87000 74330' },
  { id: 'c3', name: 'Arjun M.', verified: false, gender: 'M', city: 'Dallas', bookings: 2, spend: 1100, status: 'unverified', segment: 'guests', phone: '+91 99001 11118' },
  { id: 'c4', name: 'R. Gupta', verified: false, gender: '—', city: 'Austin', bookings: 1, spend: 0, status: 'blocked', segment: 'guests', phone: '+91 90112 23344' },
];

export const SEED_ORGANIZERS: Organizer[] = [
  { id: 'o1', name: 'LiveWire Ent.', contact: 'contact@livewire.co', city: 'Austin', events: 18, kyc: 'verified', status: 'approved', contactPerson: 'Jordan Lee', phone: '+91 98001 85442', eventTypes: 'Concerts, Festivals', about: "Austin's indie-music collective — 18 shows and counting.", links: 'livewire.co / ig / X', gstin: '29ABCDE1234F1Z5', pan: 'ABCDE1234F', bankLast4: '8821' },
  { id: 'o2', name: 'FestCrew', contact: 'hello@festcrew.io', city: 'Austin', events: 11, kyc: 'verified', status: 'approved' },
  { id: 'o3', name: 'NightOwl Co.', contact: 'bookings@nightowl.co', city: 'Dallas', events: 2, kyc: 'pending', status: 'pending' },
  { id: 'o4', name: 'Sunset Sessions', contact: 'team@sunsetsessions.com', city: 'Houston', events: 0, kyc: 'submitted', status: 'pending' },
  { id: 'o5', name: 'Rowdy Promotions', contact: 'info@rowdyprom.com', city: 'Austin', events: 0, kyc: 'flagged', status: 'rejected' },
];

export const SEED_VENUES: Venue[] = [
  { id: 'v1', name: 'Arena Hall', city: 'Austin', capacity: 400, events: 18, license: "valid till Mar '27", verified: true, address: '123 5th St, Austin, TX', type: 'Indoor', contact: 'Ravi N. · +91 98002 22400', rules: 'No outside food, 11 PM curfew', amenities: ['Parking', 'Accessible', 'In-house bar', 'Coat check'] },
  { id: 'v2', name: 'Riverside Grounds', city: 'Austin', capacity: 2000, events: 11, license: "valid till Jan '27", verified: true, address: 'Riverside Park, Austin, TX', amenities: ['Parking', 'Food trucks', 'Open-air'] },
  { id: 'v3', name: 'Comedy Cave', city: 'Dallas', capacity: 180, events: 9, license: 'expires 12 Aug ⚠', verified: false, address: '88 6th St, Dallas, TX', amenities: ['In-house bar', 'Accessible'] },
  { id: 'v4', name: 'The Loft', city: 'Houston', capacity: 120, events: 7, license: "valid till Nov '26", verified: true, address: '5th & Lamar, Houston, TX', amenities: ['Rooftop', 'In-house bar'] },
];

export const SEED_PROMOS: Promo[] = [
  { code: 'FEST10', discountLabel: '10% ≤ ₹100', scope: 'Summer Fest', gender: 'all', usedLabel: '184/500', status: 'active', type: 'percent', value: 10, maxCap: 100 },
  { code: 'LADIESNIGHT', discountLabel: '50% ≤ ₹300', scope: 'Indie Night', gender: 'women', usedLabel: '67/200', status: 'active', type: 'percent', value: 50, maxCap: 300 },
  { code: 'FIRSTGIG', discountLabel: '₹150 flat', scope: 'first booking', gender: 'all', usedLabel: '96/∞', status: 'active', type: 'flat', value: 150 },
  { code: 'DIWALI25', discountLabel: '25% ≤ ₹250', scope: 'all events', gender: 'all', usedLabel: '890/1k', status: 'expired', type: 'percent', value: 25, maxCap: 250 },
];

export const promoLabel = (type: 'percent' | 'flat', value: number, maxCap?: number) =>
  type === 'flat' ? `₹${value} flat` : `${value}%${maxCap ? ` ≤ ₹${maxCap}` : ''}`;

export const SEED_NOTIFICATIONS = [
  { id: 'n1', icon: '⚠', text: '“Stand-up Sunday” submitted for approval by NightOwl Co.', time: '2h ago', read: false, to: '/events?tab=pending' },
  { id: 'n2', icon: '↩', text: 'Refund requested — booking #9003 · ₹335 · “can\'t attend”', time: '3h ago', read: false, to: '/bookings?status=refund_requested' },
  { id: 'n3', icon: '🛡', text: 'Sunset Sessions submitted KYC docs for review', time: '5h ago', read: false, to: '/organizers' },
  { id: 'n4', icon: '📄', text: 'Comedy Cave license expires 12 Aug — docs pending', time: '1d ago', read: true, to: '/venues' },
  { id: 'n5', icon: '💸', text: '2 organizer payouts due Friday · ₹2.9L total', time: '1d ago', read: true, to: '/payments' },
  { id: 'n6', icon: '✍', text: 'Blog “Venue spotlight: Riverside” goes live 12 Jul, 9 AM', time: '2d ago', read: true, to: '/blogs' },
];

export const SEED_BANNERS: Banner[] = [
  { id: 'b1', title: 'Summer Fest hero', statusLabel: 'Live · #1', heading: "Summer Fest '26 is here", description: 'Two stages, twelve artists, fireworks over the river.', ctaLabel: 'Get day passes →', ctaLink: '/events/summer-fest-26', hasImage: true },
  { id: 'b2', title: 'Host with us', statusLabel: 'Live · #2', heading: 'Turn your events into income', description: 'List in minutes, get paid weekly.', ctaLabel: 'Join as organizer', ctaLink: '/host', hasImage: true },
  { id: 'b3', title: 'Diwali promo', statusLabel: 'Scheduled', heading: 'Diwali nights, 25% off', description: 'Use DIWALI25 at checkout.', ctaLabel: 'Browse events', ctaLink: '/browse', hasImage: false },
];

export const SEED_CATEGORIES: Category[] = [
  { icon: '🎵', name: 'Concerts', count: 22 },
  { icon: '😂', name: 'Comedy', count: 9 },
  { icon: '🎪', name: 'Festivals', count: 6 },
  { icon: '🏠', name: 'House parties', count: 0 },
];

export const SEED_BLOGS: Blog[] = [
  { id: 'bl1', title: 'Top 10 gigs this monsoon', meta: 'by Dev P. · 2.1k views', status: 'published', category: 'City guide', hasBanner: true, content: 'The monsoon has a way of thinning the crowds and thickening the atmosphere…' },
  { id: 'bl2', title: 'How to host a sold-out show', meta: 'by Dev P. · targets organizers', status: 'draft', category: 'For organizers', hasBanner: true, content: 'We looked at every sold-out event on Prebooze in the last six months…' },
  { id: 'bl3', title: 'Venue spotlight: Riverside', meta: 'scheduled 12 Jul, 9 AM', status: 'scheduled', category: 'Venues', hasBanner: false, content: 'Some venues host events; Riverside Grounds hosts summers…' },
];

export const SEED_BLOG_CATEGORIES = [
  { id: 'bc1', name: 'City guide', hasBanner: true },
  { id: 'bc2', name: 'For organizers', hasBanner: false },
  { id: 'bc3', name: 'Venues', hasBanner: true },
];

export const SEED_LEDGER = [
  { id: 'l1', kind: 'expense' as const, category: 'Marketing', amount: 18500, note: 'Instagram ads — Summer Fest', date: '2 Jul' },
  { id: 'l2', kind: 'expense' as const, category: 'Staff & salaries', amount: 64000, note: 'Gate crew + support, June', date: '1 Jul' },
  { id: 'l3', kind: 'income' as const, category: 'Sponsorship', amount: 40000, note: 'FizzCo — Indie Night Live', date: '28 Jun' },
  { id: 'l4', kind: 'expense' as const, category: 'Office & tools', amount: 9200, note: 'SaaS + coworking, June', date: '28 Jun' },
];

export const SEED_LEDGER_CATEGORIES = {
  income: ['Ticket commission', 'Booking fees', 'Sponsorship', 'Other income'],
  expense: ['Marketing', 'Staff & salaries', 'Office & tools', 'Refund losses', 'Other expense'],
};

export const SEED_GUEST_LIST = [
  { id: 'g1', eventId: 'e1', name: 'Rhea Kapoor', phone: '+91 98002 59771', plusOnes: 1, companions: [{ name: 'Aditya Kapoor', phone: '+91 98002 96772' }], addedBy: 'Admin', arrived: false },
  { id: 'g2', eventId: 'e1', name: 'DJ Nova (artist)', plusOnes: 2, companions: [{ name: 'Tour manager' }, { name: 'Photographer' }], addedBy: 'Admin', arrived: true },
];

export const SEED_PAGES: SitePage[] = [
  { title: 'About us', slug: '/about' },
  { title: 'Host with us', slug: '/host' },
  { title: 'Refund policy', slug: '/refunds' },
  { title: 'Terms · Privacy · Contact · FAQs', slug: '/terms…' },
  { title: 'Corporate events', slug: '/corporate' },
  { title: 'FAQs', slug: '/faqs', navGroup: 'Support' },
];

export const SEED_STAFF: StaffMember[] = [
  { name: 'You · owner@prebooze', role: 'Owner', lastActive: 'now', city: 'Austin' },
  { name: 'Meera J.', role: 'Finance', lastActive: '2h ago', city: 'Austin' },
  { name: 'Dev P.', role: 'Content', lastActive: '1d ago', city: 'Dallas' },
  { name: 'Gate crew (4)', role: 'Scanner only', lastActive: 'at event', city: 'Austin' },
];

import type { RoleMatrix, Settings } from '../types';

// Expanded from the original 7 broad buckets to one module per admin
// section, so a role can be scoped to exactly what it needs — e.g. a
// "Locations" editor no longer also gets Reviews/Verifications/Abandoned
// carts just because they used to share the "Customers & organizers"
// catch-all. Staff & roles itself is deliberately NOT a module here — it
// stays Owner-only (see AdminStaffController/AdminRolesController), same
// anti-privilege-escalation reasoning as before this expansion.
export const PERM_MODULES = [
  'Dashboard',
  'Events & approvals',
  'Event commission (per event)',
  'Bookings',
  'Refunds',
  'Payments & payouts',
  'Customers',
  'Organizers',
  'Promoters',
  'Lineups',
  'Venues',
  'Verifications (KYC)',
  'Reviews',
  'Locations',
  'Abandoned carts',
  'Featured',
  'Content',
  'Careers',
  'Reels',
  'Promo codes',
  'Gate check-in',
  'Reports',
];

const perms = (view: boolean, edit: boolean, approve: boolean) => ({ view, edit, approve });
const allOn = () => Object.fromEntries(PERM_MODULES.map((m) => [m, perms(true, true, true)]));

export const SEED_ROLES: RoleMatrix = {
  Owner: allOn(),
  Manager: {
    ...allOn(),
    Bookings: perms(true, true, false),
    'Payments & payouts': perms(true, true, false),
    'Promo codes': perms(true, true, false),
    Reports: perms(true, true, false),
  },
  Finance: {
    Dashboard: perms(true, false, false),
    'Events & approvals': perms(true, false, false),
    'Event commission (per event)': perms(true, true, false),
    Bookings: perms(true, true, true),
    Refunds: perms(true, true, true),
    'Payments & payouts': perms(true, true, true),
    Customers: perms(true, false, false),
    Organizers: perms(true, false, false),
    Promoters: perms(true, false, false),
    Lineups: perms(true, false, false),
    Venues: perms(true, false, false),
    'Verifications (KYC)': perms(true, false, false),
    Reviews: perms(true, false, false),
    Locations: perms(true, false, false),
    'Abandoned carts': perms(true, false, false),
    Featured: perms(true, false, false),
    Content: perms(true, false, false),
    Careers: perms(true, false, false),
    Reels: perms(true, false, false),
    'Promo codes': perms(true, true, true),
    'Gate check-in': perms(false, false, false),
    Reports: perms(true, true, true),
  },
  Content: {
    Dashboard: perms(true, false, false),
    'Events & approvals': perms(true, false, false),
    'Event commission (per event)': perms(false, false, false),
    Bookings: perms(false, false, false),
    Refunds: perms(false, false, false),
    'Payments & payouts': perms(false, false, false),
    Customers: perms(true, false, false),
    Organizers: perms(true, false, false),
    Promoters: perms(true, false, false),
    Lineups: perms(true, false, false),
    Venues: perms(true, false, false),
    'Verifications (KYC)': perms(true, false, false),
    Reviews: perms(true, false, false),
    Locations: perms(true, false, false),
    'Abandoned carts': perms(true, false, false),
    Featured: perms(true, true, true),
    Content: perms(true, true, true),
    Careers: perms(true, true, true),
    Reels: perms(true, true, true),
    'Promo codes': perms(false, false, false),
    'Gate check-in': perms(false, false, false),
    Reports: perms(false, false, false),
  },
  Support: {
    Dashboard: perms(true, false, false),
    'Events & approvals': perms(true, false, false),
    'Event commission (per event)': perms(false, false, false),
    Bookings: perms(false, false, false),
    Refunds: perms(true, true, false),
    'Payments & payouts': perms(false, false, false),
    Customers: perms(true, true, false),
    Organizers: perms(true, true, false),
    Promoters: perms(true, true, false),
    Lineups: perms(true, true, false),
    Venues: perms(true, true, false),
    'Verifications (KYC)': perms(true, true, false),
    Reviews: perms(true, true, false),
    Locations: perms(true, true, false),
    'Abandoned carts': perms(true, true, false),
    Featured: perms(true, false, false),
    Content: perms(true, false, false),
    Careers: perms(true, false, false),
    Reels: perms(true, false, false),
    'Promo codes': perms(false, false, false),
    'Gate check-in': perms(true, false, false),
    Reports: perms(false, false, false),
  },
  'Scanner only': {
    Dashboard: perms(true, false, false),
    'Events & approvals': perms(false, false, false),
    'Event commission (per event)': perms(false, false, false),
    Bookings: perms(false, false, false),
    Refunds: perms(false, false, false),
    'Payments & payouts': perms(false, false, false),
    Customers: perms(false, false, false),
    Organizers: perms(false, false, false),
    Promoters: perms(false, false, false),
    Lineups: perms(false, false, false),
    Venues: perms(false, false, false),
    'Verifications (KYC)': perms(false, false, false),
    Reviews: perms(false, false, false),
    Locations: perms(false, false, false),
    'Abandoned carts': perms(false, false, false),
    Featured: perms(false, false, false),
    Content: perms(false, false, false),
    Careers: perms(false, false, false),
    Reels: perms(false, false, false),
    'Promo codes': perms(false, false, false),
    'Gate check-in': perms(true, true, false),
    Reports: perms(false, false, false),
  },
};

export const SEED_SETTINGS: Settings = {
  bookingFee: 30,
  gstPct: 18,
  feeLabel: 'Convenience fee',
  absorbedBy: 'Organizer',
  payoutDay: 'Friday',
  autoPayout: true,
  weeklyEmail: true,
  whatsappAlerts: true,
  require2fa: false,
  maintenanceMode: false,
  salesPaused: false,
  socials: {
    instagram: 'instagram.com/prebooze',
    x: 'x.com/prebooze',
    youtube: 'youtube.com/@prebooze',
    whatsapp: 'wa.me/919876543210',
    facebook: '',
  },
  siteSeo: {
    title: 'Prebooze — Your city\'s events, one tap away',
    description: 'Book tickets to concerts, comedy, festivals and parties from verified organizers. WhatsApp tickets, QR entry.',
    keywords: 'events, tickets, concerts, nightlife, austin',
  },
  contact: {
    email: 'help@prebooze.com',
    phone: '+91 98765 43210',
    address: '4th Floor, Cowork Hub, Koramangala, Bengaluru',
    organizerEmail: 'organizers@prebooze.com',
  },
  footerCopyright: '© 2026 Prebooze Inc. · All rights reserved',
};

export const AMENITY_PRESETS = [
  'Parking', 'Accessible', 'In-house bar', 'Food trucks', 'Rooftop', 'Open-air',
  'Coat check', 'Smoking area', 'VIP lounge', 'ATM', 'Prayer room', 'Valet',
];

export const SEED_TESTIMONIALS = [
  { id: 't1', author: 'Sam Rivera', location: 'Austin', rating: 5, quote: 'Booked in 20 seconds, QR hit my WhatsApp instantly, walked straight in. Never buying paper tickets again.', featured: true },
  { id: 't2', author: 'Priya K.', location: 'Austin', rating: 5, quote: 'Found three gigs I would have missed. The city filter is so good.', featured: true },
  { id: 't3', author: 'Arjun M.', location: 'Dallas', rating: 4, quote: 'Refund landed back in minutes when my plans changed. Rare for a ticketing app.', featured: true },
  { id: 't4', author: 'Nia T.', location: 'Houston', rating: 5, quote: 'Group QR for all four of us meant no bottleneck at the gate. Smart.', featured: false },
];

export const SEED_FAQS = [
  { id: 'f1', question: 'How do I get my ticket?', answer: 'Sent instantly to your WhatsApp — also downloadable as a QR from My Bookings.', audience: 'guests' as const },
  { id: 'f2', question: 'Can I cancel a booking?', answer: 'Yes — free cancellation up to 48 hours before the event. Refunds land back on your payment method instantly.', audience: 'guests' as const },
  { id: 'f3', question: 'Do I need an account to book?', answer: 'You log in with your WhatsApp number and an OTP — no passwords. Your number is your account.', audience: 'guests' as const },
  { id: 'f4', question: 'How do organizers get verified?', answer: 'Every organizer completes identity KYC (Aadhaar + selfie) and bank verification before their events go live.', audience: 'organizers' as const },
  { id: 'f5', question: 'When do organizers get paid?', answer: 'Automatic weekly payouts every Monday, with per-event settlement after the event completes.', audience: 'organizers' as const },
];

const policyDoc = (id: string, title: string, slug: string, sections: string[]) => ({
  id, title, slug, updated: '1 July 2026',
  sections: sections.map((h) => ({ heading: h, body: 'Placeholder copy — final legal language to be drafted and reviewed by counsel before launch. It describes, in plain terms, the rights and responsibilities that apply here.' })),
});

export const SEED_POLICIES = [
  policyDoc('terms', 'Terms & Conditions', '/legal/terms', ['Introduction', 'Account & eligibility', 'Booking & payments', 'Cancellations', 'Conduct at events', 'Liability']),
  policyDoc('privacy', 'Privacy Policy', '/legal/privacy', ['Data we collect', 'How we use it', 'Sharing & WhatsApp', 'Government ID data', 'Your rights']),
  policyDoc('organizer-policy', 'Organizer Policy', '/legal/organizer-policy', ['Verification & KYC', 'Listing standards', 'Payouts & fees', 'Approval & rejection', 'Suspension']),
  policyDoc('guest-policy', 'Guest Policy', '/legal/guest-policy', ['Entry requirements', 'Age & ID checks', 'Ticket transfers', 'Code of conduct', 'Bans & reporting']),
  policyDoc('refund-policy', 'Refund Policy', '/legal/refund-policy', ['Cancellation window', 'Refund timelines', 'Event cancelled by organizer', 'Non-refundable cases']),
  policyDoc('disclaimer', 'Disclaimer', '/legal/disclaimer', ['Third-party events', 'No warranty', 'Assumption of risk']),
];

export const SEED_MENUS = {
  header: [
    { label: 'Events', to: '/browse' },
    { label: 'Venues', to: '/venues' },
    { label: 'Blog', to: '/blog' },
    { label: 'Host with us', to: '/host' },
  ],
  footer: [
    { title: 'Explore', links: [
      { label: 'Events', to: '/browse' },
      { label: 'Venues', to: '/venues' },
      { label: 'Blog', to: '/blog' },
    ]},
    { title: 'Company', links: [
      { label: 'About us', to: '/about' },
      { label: 'Host with us', to: '/host' },
      { label: 'Contact', to: '/contact' },
    ]},
    { title: 'Support', links: [
      { label: 'FAQs', to: '/faqs' },
      { label: 'Refund policy', to: '/legal/refund-policy' },
      { label: 'Terms', to: '/legal/terms' },
      { label: 'Privacy', to: '/legal/privacy' },
    ]},
  ],
};

export const LINEUP_CATEGORIES = ['Artist', 'DJ', 'Band', 'Comedian', 'Sponsor', 'Promoter', 'Host'];

/** Incoming elevated-role applications awaiting manual review — see
 * Verifications.tsx. Approving one creates the live entity in the matching
 * directory (Organizers/Promoters/Line-ups/Venues); rejecting just closes it. */
export const SEED_KYC_APPLICATIONS: KycApplication[] = [
  {
    id: 'kyc1', kind: 'organizer' as const, applicantName: 'Rhea Kapoor', applicantPhone: '+91 90011 22334', city: 'Austin',
    payload: { brand: 'Skyline Sessions', username: 'skylinesessions', gstin: '29AASFS1234R1Z8', pan: 'AASFS1234R', bankLast4: '4821' },
    documents: [{ type: 'Government ID', note: 'Aadhaar front · uploaded' }, { type: 'Selfie match', note: 'captured · pending review' }],
    status: 'pending' as const, submittedAt: '2 hours ago',
  },
  {
    id: 'kyc2', kind: 'promoter' as const, applicantName: 'Arjun Mehta', applicantPhone: '+91 98220 11445', city: 'Austin',
    payload: { brand: 'Loudmouth PR', username: 'loudmouthpr', audience: '15k Instagram · 4k WhatsApp broadcast' },
    documents: [{ type: 'Government ID', note: 'PAN card · uploaded' }, { type: 'Selfie match', note: 'captured · pending review' }],
    status: 'pending' as const, submittedAt: '5 hours ago',
  },
  {
    id: 'kyc3', kind: 'venue' as const, applicantName: 'Devika Rao', applicantPhone: '+91 99001 55223', city: 'Mumbai',
    payload: { name: 'Marine Drive Loft', type: 'Rooftop', capacity: '300', address: 'Marine Drive, Mumbai' },
    documents: [{ type: 'Operating license', note: 'uploaded · unreadable scan' }, { type: 'Address proof', note: 'uploaded' }],
    status: 'pending' as const, submittedAt: '1 day ago',
  },
  {
    id: 'kyc4', kind: 'lineup' as const, applicantName: 'DJ Current', applicantPhone: '+91 97400 88112', city: 'Bengaluru',
    payload: { name: 'DJ Current', category: 'DJ', links: 'ig/djcurrent · soundcloud/djcurrent' },
    documents: [{ type: 'Government ID', note: 'Driving licence · uploaded' }, { type: 'Selfie match', note: 'captured · pending review' }],
    status: 'pending' as const, submittedAt: '1 day ago',
  },
  {
    id: 'kyc5', kind: 'organizer' as const, applicantName: 'Sunil Verma', applicantPhone: '+91 90090 44556', city: 'Delhi',
    payload: { brand: 'Capital Nights', username: 'capitalnights', gstin: '07ABCVX9988R1Z2', pan: 'ABCVX9988R', bankLast4: '2290' },
    documents: [{ type: 'Government ID', note: 'Aadhaar front · uploaded' }, { type: 'Selfie match', note: 'captured · matched' }],
    status: 'rejected' as const, submittedAt: '3 days ago', reviewedBy: 'admin@prebooze.com', reviewNote: 'GSTIN does not match business name on record',
  },
];

export const SEED_LINEUPS = [
  { id: 'lu1', name: 'DJ Nova', category: 'DJ', description: 'Opening sets that fill the floor before 9 PM. House & disco edits.', city: 'Austin', links: 'ig/djnova · soundcloud/djnova', hasImage: true, followers: 4200, verified: true },
  { id: 'lu2', name: 'The Wilds', category: 'Band', description: 'Indie four-piece. New album “Night Maps” out now — headline set plays it front to back.', city: 'Austin', links: 'ig/thewilds · spotify/thewilds', hasImage: true, followers: 12800, verified: true },
  { id: 'lu3', name: 'Maya K.', category: 'Comedian', description: 'Sharp crowd-work, zero mercy for the front row.', city: 'Dallas', links: 'ig/mayak', hasImage: true, followers: 6100, verified: true },
  { id: 'lu4', name: 'KLANG', category: 'DJ', description: 'Berlin-schooled techno. 6 AM finisher.', city: 'Berlin', links: 'ig/klang · ra.co/klang', hasImage: true, followers: 22000, verified: true },
  { id: 'lu5', name: 'FizzCo', category: 'Sponsor', description: 'Craft soda brand sponsoring stages across Texas.', city: 'Austin', links: 'fizzco.com', hasImage: false, followers: 900, verified: false },
  { id: 'lu6', name: 'CityBeat', category: 'Promoter', description: 'Promoting the loudest nights in town since 2019.', city: 'Austin', links: 'ig/citybeat', hasImage: false, followers: 3100, verified: true },
];

export const CATEGORY_OPTIONS = ['Concerts', 'Comedy', 'Festivals', 'Club nights'];

/** Category → sub-category tree (mirrors the guest app). */
export const CATEGORY_SUBS: Record<string, string[]> = {
  Concerts: ['Indie', 'Live band', 'Techno', 'Bollywood', 'EDM', 'Hip-hop'],
  Comedy: ['Stand-up', 'Open mic', 'Improv'],
  Festivals: ['Music festival', 'Sundowner', 'Food & drink', 'Cultural'],
  'Club nights': ['House', 'After-hours', 'Bollywood night', 'Ladies night'],
};

// targetType covers every reviewable role except guests (guests are the
// reviewers, never the subject) — organizer reviews existed already;
// promoter/venue/lineup are new as of the "review option for all roles" slice.
export const SEED_REVIEWS = [
  { id: 'rv1', author: 'Priya S.', rating: 5, eventTitle: 'Jazz in the Park', targetType: 'organizer' as const, targetName: 'LiveWire Ent.', text: 'Smooth entry, great sound, well organized.', date: '14 Jun' },
  { id: 'rv2', author: 'Marco T.', rating: 4, eventTitle: 'NYE Countdown', targetType: 'organizer' as const, targetName: 'LiveWire Ent.', text: 'Fun night — queue at the bar was long.', date: '2 Jan' },
  { id: 'rv3', author: 'Alex K.', rating: 5, eventTitle: 'Indie Night Live', targetType: 'organizer' as const, targetName: 'LiveWire Ent.', text: 'QR entry took seconds. Best gig this year.', date: '2 Jul' },
  { id: 'rv4', author: 'Nikita R.', rating: 2, eventTitle: 'Techno Tuesday', targetType: 'organizer' as const, targetName: 'FestCrew', text: 'Sound was great but entry took 40 minutes.', date: '20 Jun' },
  { id: 'rv5', author: 'Dev M.', rating: 4, eventTitle: 'Stand-up Sunday', targetType: 'organizer' as const, targetName: 'NightOwl Co.', text: 'Maya K. destroyed. Seats a bit cramped.', date: '28 Jun' },
  { id: 'rv6', author: 'anon_user_99', rating: 1, eventTitle: "Summer Fest '26", targetType: 'organizer' as const, targetName: 'FestCrew', text: 'SCAM!!! buy tickets from my site instead www.fake-tickets.example', date: '1 Jul' },
  { id: 'rv7', author: 'Sana K.', rating: 5, eventTitle: 'Indie Night Live', targetType: 'promoter' as const, targetName: 'Nova Nights', text: 'Got us straight in on the guest list, no drama.', date: '3 Jul' },
  { id: 'rv8', author: 'Rohit V.', rating: 3, eventTitle: 'Techno Tuesday', targetType: 'promoter' as const, targetName: 'Crowd Co.', text: 'List had our names but the +1 wasn’t noted.', date: '21 Jun' },
  { id: 'rv9', author: 'Meera J.', rating: 5, eventTitle: 'Jazz in the Park', targetType: 'venue' as const, targetName: 'Arena Hall', text: 'Great sound system, easy to find, clean.', date: '15 Jun' },
  { id: 'rv10', author: 'Kabir S.', rating: 2, eventTitle: 'NYE Countdown', targetType: 'venue' as const, targetName: 'Riverside Grounds', text: 'Parking was a nightmare, venue itself was fine.', date: '3 Jan' },
  { id: 'rv11', author: 'Ishaan P.', rating: 5, eventTitle: 'Stand-up Sunday', targetType: 'lineup' as const, targetName: 'Maya K.', text: 'Funniest set I’ve seen live, worth every rupee.', date: '29 Jun' },
];

export const SEED_PROMOTERS = [
  { id: 'pr1', name: 'Nova Nights', contact: 'hey@novanights.co', city: 'Austin', status: 'approved' as const, kyc: 'verified', plan: 'pro', guestsThisMonth: 312, eventsPromoted: 64, showRate: 78, bio: 'Rooftops, warehouses, after-hours. Free before 1 AM.', guestsBrought: 12400, perHeadEarned: 148800, commissionEarned: 42160, withdrawn: 160000, payouts: [
    { id: 'pp1', date: '6 Jul', amount: 24000, status: 'processing' as const },
    { id: 'pp2', date: '22 Jun', amount: 80000, status: 'paid' as const },
    { id: 'pp3', date: '5 Jun', amount: 80000, status: 'paid' as const },
  ] },
  { id: 'pr2', name: 'Crowd Co.', contact: 'book@crowdco.io', city: 'Dallas', status: 'approved' as const, kyc: 'verified', plan: 'starter', guestsThisMonth: 88, eventsPromoted: 38, showRate: 71, bio: 'We fill floors.', guestsBrought: 6100, perHeadEarned: 61000, commissionEarned: 18240, withdrawn: 60000, payouts: [
    { id: 'pp4', date: '1 Jul', amount: 19240, status: 'processing' as const },
    { id: 'pp5', date: '18 Jun', amount: 60000, status: 'paid' as const },
  ] },
  { id: 'pr3', name: 'The Plug', contact: 'team@theplug.co', city: 'Houston', status: 'pending' as const, kyc: 'submitted', plan: 'free', guestsThisMonth: 0, eventsPromoted: 0, showRate: 0, bio: 'New in town, big lists.', guestsBrought: 1400, perHeadEarned: 0, commissionEarned: 0, withdrawn: 0, payouts: [] },
  { id: 'pr4', name: 'Hype House ATX', contact: 'info@hypehouse.co', city: 'Austin', status: 'pending' as const, kyc: 'submitted', plan: 'free', guestsThisMonth: 0, eventsPromoted: 0, showRate: 0, bio: 'College nights & day parties.', guestsBrought: 0, perHeadEarned: 0, commissionEarned: 0, withdrawn: 0, payouts: [] },
  { id: 'pr5', name: 'Ghost Guestlist', contact: 'x@ghostgl.co', city: 'Dallas', status: 'rejected' as const, kyc: 'flagged', plan: 'free', guestsThisMonth: 0, eventsPromoted: 0, showRate: 0, bio: 'Flagged for fake guest activity.', guestsBrought: 0, perHeadEarned: 0, commissionEarned: 0, withdrawn: 0, payouts: [] },
];

// Abandoned carts — guests who reached checkout but didn't pay before the hold
// lapsed. Platform-wide dataset for admin analytics + recovery nudges.
export const SEED_ABANDONED_CARTS = [
  { id: 'ac1', guest: 'Riya Sharma', phone: '+91 98033 31120', eventId: 'e1', qty: 2, amount: 162, tiers: '2× VIP', leftAt: '9m', reminded: false, status: 'abandoned' as const },
  { id: 'ac2', guest: 'Arjun Mehta', phone: '+91 99037 04432', eventId: 'e1', qty: 2, amount: 60, tiers: '2× General', leftAt: '24m', reminded: false, status: 'abandoned' as const },
  { id: 'ac3', guest: 'Neha Gupta', phone: '+91 97040 78890', eventId: 'e1', qty: 1, amount: 81, tiers: '1× VIP', leftAt: '1h', reminded: true, status: 'recovered' as const },
  { id: 'ac4', guest: 'Vikram Rao', phone: '+91 90044 42201', eventId: 'e2', qty: 4, amount: 480, tiers: '4× Day pass', leftAt: '18m', reminded: false, status: 'abandoned' as const },
  { id: 'ac5', guest: 'Priya Nair', phone: '+91 98048 15567', eventId: 'e2', qty: 2, amount: 240, tiers: '2× Day pass', leftAt: '2h', reminded: true, status: 'abandoned' as const },
  { id: 'ac6', guest: 'Sana Kapoor', phone: '+91 96051 83312', eventId: 'e2', qty: 1, amount: 320, tiers: '1× Weekend', leftAt: '3h', reminded: true, status: 'recovered' as const },
  { id: 'ac7', guest: 'Dev Patel', phone: '+91 99055 57788', eventId: 'e3', qty: 3, amount: 135, tiers: '3× Entry', leftAt: '40m', reminded: false, status: 'abandoned' as const },
  { id: 'ac8', guest: 'Ananya Iyer', phone: '+91 97059 21145', eventId: 'e3', qty: 2, amount: 90, tiers: '2× Entry', leftAt: '5h', reminded: false, status: 'abandoned' as const },
  { id: 'ac9', guest: 'Rohit Sinha', phone: '+91 90062 99923', eventId: 'e5', qty: 2, amount: 300, tiers: '2× GA', leftAt: '1d', reminded: false, status: 'abandoned' as const },
  { id: 'ac10', guest: 'Meera Joshi', phone: '+91 98066 66654', eventId: 'e5', qty: 1, amount: 150, tiers: '1× GA', leftAt: '1d', reminded: true, status: 'recovered' as const },
];

// Editable subscription tiers (admin-configurable; mirrored to the promoter app).
export const SEED_SUB_TIERS = [
  { id: 'free', name: 'Free', price: 0, guests: 25 },
  { id: 'starter', name: 'Starter', price: 999, guests: 150 },
  { id: 'pro', name: 'Pro', price: 2499, guests: 500 },
  { id: 'elite', name: 'Elite', price: 4999, guests: -1 },
];

// Featured placements — admin approval queue + editable rates.
export const SEED_FEATURED_RATES = { perEvent: 2000, organizerMonthly: 4999, promoterMonthly: 2999, lineupMonthly: 1999, venueMonthly: 3999 };
export const SEED_FEATURED_REQUESTS = [
  { id: 'fr1', type: 'organizer' as const, name: 'FestCrew', refId: 'festcrew', city: 'Austin', billing: 'monthly' as const, amount: 4999, status: 'pending' as const, requestedAt: '17 Jul', expiresAt: '—' },
  { id: 'fr2', type: 'event' as const, name: 'Neon Warehouse Party', refId: 'e6', city: 'Austin', billing: 'per_event' as const, amount: 2000, status: 'pending' as const, requestedAt: '16 Jul', expiresAt: '22 Aug' },
  { id: 'fr3', type: 'lineup' as const, name: 'DJ Nova', refId: 'dj-nova', city: 'Austin', billing: 'monthly' as const, amount: 1999, status: 'pending' as const, requestedAt: '15 Jul', expiresAt: '—' },
  { id: 'fr4', type: 'promoter' as const, name: 'Nova Nights', refId: 'nova-nights', city: 'Austin', billing: 'monthly' as const, amount: 2999, status: 'active' as const, requestedAt: '1 Jul', expiresAt: '31 Jul' },
  { id: 'fr5', type: 'lineup' as const, name: 'FizzCo', refId: 'fizzco', city: 'Austin', billing: 'monthly' as const, amount: 1999, status: 'active' as const, requestedAt: '1 Jul', expiresAt: '31 Jul' },
  { id: 'fr6', type: 'event' as const, name: 'Stand-up Sunday', refId: 'e3', city: 'Austin', billing: 'per_event' as const, amount: 2000, status: 'active' as const, requestedAt: '2 Jul', expiresAt: '3 Aug' },
];

// Refer & earn — admin-editable rates + platform-wide referral analytics.
export const SEED_REFERRAL_RATES = { referrer: 100, referee: 100 };
export const SEED_REFERRALS = [
  { id: 'rf1', referrer: 'Riya Sharma', referrerPhone: '+91 98033 31120', referee: 'Aman T.', refereePhone: '+91 99070 38811', status: 'qualified' as const, joinedAt: '12 Jul' },
  { id: 'rf2', referrer: 'Riya Sharma', referrerPhone: '+91 98033 31120', referee: 'Kavya D.', refereePhone: '+91 97074 04420', status: 'qualified' as const, joinedAt: '10 Jul' },
  { id: 'rf3', referrer: 'Riya Sharma', referrerPhone: '+91 98033 31120', referee: 'Ishaan P.', refereePhone: '+91 96077 77702', status: 'joined' as const, joinedAt: '16 Jul' },
  { id: 'rf4', referrer: 'Arjun Mehta', referrerPhone: '+91 99037 04432', referee: 'Tara V.', refereePhone: '+91 90081 43391', status: 'qualified' as const, joinedAt: '9 Jul' },
  { id: 'rf5', referrer: 'Arjun Mehta', referrerPhone: '+91 99037 04432', referee: 'Zoya F.', refereePhone: '+91 98085 15540', status: 'joined' as const, joinedAt: '15 Jul' },
  { id: 'rf6', referrer: 'Neha Gupta', referrerPhone: '+91 97040 78890', referee: 'Om S.', refereePhone: '+91 91088 82288', status: 'qualified' as const, joinedAt: '6 Jul' },
  { id: 'rf7', referrer: 'Neha Gupta', referrerPhone: '+91 97040 78890', referee: 'Lena M.', refereePhone: '+91 92092 56614', status: 'joined' as const, joinedAt: '17 Jul' },
  { id: 'rf8', referrer: 'Dev Patel', referrerPhone: '+91 99055 57788', referee: 'Ria K.', refereePhone: '+91 93096 29925', status: 'joined' as const, joinedAt: '14 Jul' },
];

// Careers — jobs + applicants (admin-managed; mirrors the guest careers page).
export const SEED_JOBS = [
  { id: 'job1', title: 'Senior React Engineer', team: 'Engineering', loc: 'Mumbai · Hybrid', type: 'Full-time', status: 'open' as const },
  { id: 'job2', title: 'City Growth Manager', team: 'Growth', loc: 'Bengaluru', type: 'Full-time', status: 'open' as const },
  { id: 'job3', title: 'Community & Promoter Ops', team: 'Operations', loc: 'Delhi', type: 'Full-time', status: 'open' as const },
  { id: 'job4', title: 'Design Intern', team: 'Design', loc: 'Remote', type: 'Internship', status: 'open' as const },
];
export const SEED_APPLICANTS = [
  { id: 'ap1', jobId: 'job1', name: 'Rahul Iyer', email: 'rahul@dev.io', phone: '+91 98099 92210', note: 'github.com/rahuldev — 6y React', appliedAt: '16 Jul' },
  { id: 'ap2', jobId: 'job1', name: 'Sneha Patil', email: 'sneha@ui.dev', phone: '+91 97103 68841', note: 'Ex-Zomato web platform', appliedAt: '15 Jul' },
  { id: 'ap3', jobId: 'job2', name: 'Aditya Rao', email: 'adi@growth.co', phone: '+91 96107 33324', note: 'Scaled 3 cities at Blinkit', appliedAt: '14 Jul' },
  { id: 'ap4', jobId: 'job4', name: 'Mira Shah', email: 'mira@design.me', phone: '+91 90111 06672', note: 'behance.net/mirashah', appliedAt: '17 Jul' },
];

// Reels — videos for the guest "Things happening at events" slider.
export const SEED_REELS = [
  { id: 'rl1', title: 'Warehouse drop — crowd goes off', hue: 300, active: true },
  { id: 'rl2', title: 'Sundowner golden hour', hue: 25, active: true },
  { id: 'rl3', title: 'Front-row comedy crackup', hue: 40, active: true },
  { id: 'rl4', title: 'Confetti finale', hue: 210, active: true },
];

export const ADMIN_CITIES = ['Austin', 'Dallas', 'Houston'];

/** Every enabled city across the admin-managed Locations tree, alphabetized
 * — the real source city filter dropdowns should read from (replacing the
 * old per-page pattern of deriving a city list from whatever happens to
 * appear in that page's own data, or the tiny hardcoded ADMIN_CITIES). The
 * cascade in toggleLocation already keeps a city's own `enabled` flag in
 * sync with its parent state/country, so checking just city.enabled here is
 * sufficient — no need to re-check the whole ancestor chain. */
export function enabledCityNames(locations: LocCountry[]): string[] {
  const names = new Set<string>();
  for (const country of locations) for (const state of country.states) for (const c of state.cities) if (c.enabled) names.add(c.name);
  return [...names].sort();
}

/** Plain-text preview of a WysiwygEditor field (description/about/bio) for
 * compact contexts — list rows, one-line summaries — where rendering the
 * real HTML would show literal tags instead of formatted text. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** AdminEvent.date is a year-less "24 Jul" string (mock data has no real
 * year field) — assumes the current year, which is good enough for a
 * dev-seed dataset that's always "this year" relative to itself. Used by
 * Reports' date-range filter/charts, the one place this app needs to treat
 * event dates as real Dates instead of just display strings. */
export function parseEventDate(dateStr: string): Date {
  const d = new Date(`${dateStr} ${new Date().getFullYear()}`);
  return isNaN(d.getTime()) ? new Date() : d;
}

/** No real uploaded files exist in this mock (there's no backend behind
 * this app) — a real KYC document previewer still needs something real to
 * render rather than nothing, so this generates an actual image (not a
 * fake boolean) representing the document, labeled with its type/note. */
export function placeholderDocImage(label: string, sub: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="100%" height="100%" fill="#20221a"/><rect x="8" y="8" width="464" height="304" fill="none" stroke="#3a3d2e" stroke-width="2" stroke-dasharray="6 6"/><text x="50%" y="46%" text-anchor="middle" fill="#8bc34a" font-size="22" font-family="sans-serif" font-weight="700">${esc(label)}</text><text x="50%" y="58%" text-anchor="middle" fill="#9a9d8c" font-size="13" font-family="sans-serif">${esc(sub)}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Onboarding locations — admin-managed country → state → city with enable toggles.
const city = (name: string, enabled = true) => ({ name, enabled });
const st = (name: string, cities: string[], enabled = true) => ({ name, enabled, cities: cities.map((c) => city(c)) });
export const SEED_LOCATIONS = [
  {
    name: 'India', enabled: true, states: [
      st('Maharashtra', ['Mumbai', 'Pune', 'Nagpur', 'Nashik']),
      st('Karnataka', ['Bengaluru', 'Mysuru', 'Mangaluru']),
      st('Delhi', ['New Delhi', 'Dwarka', 'Rohini']),
      st('Tamil Nadu', ['Chennai', 'Coimbatore', 'Madurai']),
      st('Telangana', ['Hyderabad', 'Warangal']),
      st('Goa', ['Panaji', 'Margao']),
    ],
  },
  {
    name: 'United States', enabled: true, states: [
      st('Texas', ['Austin', 'Dallas', 'Houston', 'San Antonio']),
      st('California', ['Los Angeles', 'San Francisco', 'San Diego']),
      st('New York', ['New York City', 'Buffalo']),
    ],
  },
  {
    name: 'United Arab Emirates', enabled: true, states: [
      st('Dubai', ['Dubai']),
      st('Abu Dhabi', ['Abu Dhabi', 'Al Ain']),
    ],
  },
];

export const GUEST_SITE_URL = 'http://localhost:5173';

export const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
