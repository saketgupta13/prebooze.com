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
  { id: '#8412', guest: 'Sam Rivera', phone: '+91 98••• ••210', eventId: 'e1', qty: 2, amount: 1450, status: 'refund_requested', method: 'UPI', guests: ['Sam Rivera ✓ (main)', 'Alex Kim'] },
  { id: '#8420', guest: 'Priya K.', phone: '+91 87••• ••330', eventId: 'e2', qty: 4, amount: 2900, status: 'paid', method: 'Card', guests: ['Priya K. ✓ (main)', 'Meera S.', 'Tara J.', 'Ishaan V.'] },
  { id: '#8419', guest: 'Arjun M.', phone: '+91 99••• ••118', eventId: 'e1', qty: 1, amount: 580, status: 'checked_in', method: 'UPI', guests: ['Arjun M. (main)'] },
  { id: '#8415', guest: 'Nia T.', phone: '+91 76••• ••902', eventId: 'e2', qty: 2, amount: 1160, status: 'refunded', method: 'UPI', guests: ['Nia T. ✓ (main)', 'Zoya R.'] },
];

export const SEED_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Sam Rivera', verified: true, gender: 'M', city: 'Austin', bookings: 14, spend: 18200, status: 'active', segment: 'guests' },
  { id: 'c2', name: 'Priya K.', verified: true, gender: 'F', city: 'Austin', bookings: 6, spend: 7400, status: 'active', segment: 'guests' },
  { id: 'c3', name: 'Arjun M.', verified: false, gender: 'M', city: 'Dallas', bookings: 2, spend: 1100, status: 'unverified', segment: 'guests' },
  { id: 'c4', name: 'R. Gupta', verified: false, gender: '—', city: 'Austin', bookings: 1, spend: 0, status: 'blocked', segment: 'guests' },
  { id: 'c5', name: 'LiveWire Ent.', verified: true, gender: '—', city: 'Austin', bookings: 18, spend: 0, status: 'active', segment: 'organizers' },
];

export const SEED_ORGANIZERS: Organizer[] = [
  { id: 'o1', name: 'LiveWire Ent.', contact: 'contact@livewire.co', city: 'Austin', events: 18, kyc: 'verified', status: 'approved', contactPerson: 'Jordan Lee', phone: '+91 98••• ••442', eventTypes: 'Concerts, Festivals', about: "Austin's indie-music collective — 18 shows and counting.", links: 'livewire.co / ig / X', gstin: '29ABCDE1234F1Z5', pan: 'ABCDE1234F', bankLast4: '8821' },
  { id: 'o2', name: 'FestCrew', contact: 'hello@festcrew.io', city: 'Austin', events: 11, kyc: 'verified', status: 'approved' },
  { id: 'o3', name: 'NightOwl Co.', contact: 'bookings@nightowl.co', city: 'Dallas', events: 2, kyc: 'pending', status: 'pending' },
  { id: 'o4', name: 'Sunset Sessions', contact: 'team@sunsetsessions.com', city: 'Houston', events: 0, kyc: 'submitted', status: 'pending' },
  { id: 'o5', name: 'Rowdy Promotions', contact: 'info@rowdyprom.com', city: 'Austin', events: 0, kyc: 'flagged', status: 'rejected' },
];

export const SEED_VENUES: Venue[] = [
  { id: 'v1', name: 'Arena Hall', capacity: 400, events: 18, license: "valid till Mar '27", verified: true, address: '123 5th St, Austin, TX', type: 'Indoor', contact: 'Ravi N. · +91 98••• ••400', rules: 'No outside food, 11 PM curfew' },
  { id: 'v2', name: 'Riverside Grounds', capacity: 2000, events: 11, license: "valid till Jan '27", verified: true, address: 'Riverside Park, Austin, TX' },
  { id: 'v3', name: 'Comedy Cave', capacity: 180, events: 9, license: 'expires 12 Aug ⚠', verified: false, address: '88 6th St, Austin, TX' },
  { id: 'v4', name: 'The Loft', capacity: 120, events: 7, license: "valid till Nov '26", verified: true, address: '5th & Lamar, Austin, TX' },
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
  { id: 'n2', icon: '↩', text: 'Refund requested — booking #8412 · ₹1,450 · “can\'t attend”', time: '3h ago', read: false, to: '/bookings?status=refund_requested' },
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
  { id: 'g1', eventId: 'e1', name: 'Rhea Kapoor', phone: '+91 98••• ••771', plusOnes: 1, addedBy: 'Admin', arrived: false },
  { id: 'g2', eventId: 'e1', name: 'DJ Nova (artist)', plusOnes: 2, addedBy: 'Admin', arrived: true },
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

import type { RoleMatrix, Settings } from '../types';

export const PERM_MODULES = [
  'Payments & payouts',
  'Refunds',
  'Event commission (per event)',
  'Events & approvals',
  'Content (banners / blogs / pages)',
  'Customers & organizers',
  'Gate check-in',
];

const perms = (view: boolean, edit: boolean, approve: boolean) => ({ view, edit, approve });
const allOn = () => Object.fromEntries(PERM_MODULES.map((m) => [m, perms(true, true, true)]));

export const SEED_ROLES: RoleMatrix = {
  Owner: allOn(),
  Manager: {
    ...allOn(),
    'Payments & payouts': perms(true, true, false),
  },
  Finance: {
    'Payments & payouts': perms(true, true, true),
    Refunds: perms(true, true, true),
    'Event commission (per event)': perms(true, true, false),
    'Events & approvals': perms(true, false, false),
    'Content (banners / blogs / pages)': perms(true, false, false),
    'Customers & organizers': perms(true, false, false),
    'Gate check-in': perms(false, false, false),
  },
  Content: {
    'Payments & payouts': perms(false, false, false),
    Refunds: perms(false, false, false),
    'Event commission (per event)': perms(false, false, false),
    'Events & approvals': perms(true, false, false),
    'Content (banners / blogs / pages)': perms(true, true, true),
    'Customers & organizers': perms(true, false, false),
    'Gate check-in': perms(false, false, false),
  },
  Support: {
    'Payments & payouts': perms(false, false, false),
    Refunds: perms(true, true, false),
    'Event commission (per event)': perms(false, false, false),
    'Events & approvals': perms(true, false, false),
    'Content (banners / blogs / pages)': perms(true, false, false),
    'Customers & organizers': perms(true, true, false),
    'Gate check-in': perms(true, false, false),
  },
  'Scanner only': {
    'Payments & payouts': perms(false, false, false),
    Refunds: perms(false, false, false),
    'Event commission (per event)': perms(false, false, false),
    'Events & approvals': perms(false, false, false),
    'Content (banners / blogs / pages)': perms(false, false, false),
    'Customers & organizers': perms(false, false, false),
    'Gate check-in': perms(true, true, false),
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
};

export const CATEGORY_OPTIONS = ['Concerts', 'Comedy', 'Festivals', 'House parties'];

export const GUEST_SITE_URL = 'http://localhost:5173';

export const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
