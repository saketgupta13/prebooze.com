import type {
  AttendanceRecord,
  Attendee,
  Coupon,
  Event,
  Featured,
  Organizer,
  Payout,
  Person,
  Review,
  Venue,
} from '../types';

export const CITIES = ['Austin', 'Mumbai', 'Delhi', 'Bengaluru', 'Goa'];

export const CATEGORIES = ['All', 'Concerts', 'Comedy', 'Festivals', 'This weekend'];

export const INTEREST_TAGS = [
  'Concerts',
  'Techno',
  'Comedy',
  'Festivals',
  'House parties',
  'Theatre',
  'Sports',
];

const year = new Date().getFullYear();
const iso = (m: number, d: number, h = 20) =>
  new Date(year, m - 1, d, h, 0, 0).toISOString();

export const VENUES: Venue[] = [
  {
    id: 'arena-hall',
    name: 'Arena Hall',
    verified: true,
    type: 'Concert hall',
    locality: 'Downtown',
    city: 'Austin',
    address: '214 Congress Ave, Downtown, Austin, TX 78701',
    capacity: 2500,
    rating: 4.7,
    followers: 840,
    amenities: ['🅿 Parking', '♿ Accessible', '🍸 In-house bar'],
    about:
      'A landmark downtown concert hall with a 2,500 capacity main floor, mezzanine bar and one of the best sound systems in the city. Home to indie gigs, club nights and album launches since 2014.',
    photoHue: 152,
  },
  {
    id: 'riverside',
    name: 'Riverside Grounds',
    verified: true,
    type: 'Open-air',
    locality: 'Riverside',
    city: 'Austin',
    address: 'Riverside Park, Festival Ln, Austin, TX',
    capacity: 8000,
    rating: 4.5,
    followers: 620,
    amenities: ['🅿 Parking', '🍔 Food trucks', '⛺ Open-air'],
    about:
      'Sprawling open-air festival grounds by the river — the go-to spot for summer festivals, food carnivals and sundowner sets.',
    photoHue: 205,
  },
  {
    id: 'comedy-cave',
    name: 'Comedy Cave',
    verified: true,
    type: 'Club',
    locality: 'Downtown',
    city: 'Austin',
    address: '88 6th St, Downtown, Austin, TX',
    capacity: 350,
    rating: 4.6,
    followers: 410,
    amenities: ['🍸 In-house bar', '♿ Accessible'],
    about:
      "Austin's tightest comedy room. Low ceilings, loud laughs — open mics on weekdays, headline specials on weekends.",
    photoHue: 28,
  },
  {
    id: 'the-loft',
    name: 'The Loft',
    verified: false,
    type: 'Rooftop bar',
    locality: 'Downtown',
    city: 'Austin',
    address: '5th & Lamar, Downtown, Austin, TX',
    capacity: 220,
    rating: 4.3,
    followers: 260,
    amenities: ['🍸 In-house bar', '🌇 Rooftop'],
    about:
      'Rooftop bar with skyline views, acoustic sessions and slow sunsets. Intimate capacity — shows sell out fast.',
    photoHue: 265,
  },
  {
    id: 'warehouse-9',
    name: 'Warehouse 9',
    verified: false,
    type: 'Warehouse',
    locality: 'East Side',
    city: 'Austin',
    address: 'Bay 9, Industrial Blvd, East Austin, TX',
    capacity: 1200,
    rating: 4.4,
    followers: 380,
    amenities: ['🔊 30k-watt rig', '🅿 Parking'],
    about:
      'Raw industrial warehouse turned late-night techno institution. Concrete, strobes, and sound you feel in your chest.',
    photoHue: 330,
  },
  {
    id: 'the-basement',
    name: 'The Basement',
    verified: false,
    type: 'Club',
    locality: 'South Congress',
    city: 'Austin',
    address: 'S Congress Ave, Austin, TX',
    capacity: 300,
    rating: 4.2,
    followers: 190,
    amenities: ['🍸 In-house bar'],
    about: 'Underground club for house heads and after-hours sets on South Congress.',
    photoHue: 90,
  },
];

export const ORGANIZERS: Organizer[] = [
  {
    id: 'livewire',
    brandName: 'LiveWire Ent.',
    username: 'livewire',
    verified: true,
    city: 'Austin',
    since: '2023',
    rating: 4.6,
    reviewCount: 182,
    eventsHosted: 24,
    followers: 1200,
    following: 86,
    about:
      "Austin's indie-music collective. 24 shows and counting — concerts, rooftop gigs & festivals.",
    logoHue: 95,
  },
  {
    id: 'nightowl',
    brandName: 'NightOwl Co.',
    username: 'nightowl',
    verified: true,
    city: 'Austin',
    since: '2024',
    rating: 4.4,
    reviewCount: 97,
    eventsHosted: 17,
    followers: 780,
    following: 41,
    about: 'Late-night club series & warehouse takeovers. If it ends before 4 AM, it isn’t ours.',
    logoHue: 260,
  },
  {
    id: 'festcrew',
    brandName: 'FestCrew',
    username: 'festcrew',
    verified: true,
    city: 'Austin',
    since: '2024',
    rating: 4.5,
    reviewCount: 64,
    eventsHosted: 12,
    followers: 540,
    following: 28,
    about: 'Open-air festivals, food carnivals and day parties across Texas.',
    logoHue: 25,
  },
];

const defaultConditions = [
  'Entry only with valid QR ticket + photo ID',
  '18+ event — age verified at gate',
  'No re-entry once checked in',
  'Gates close at 9:30 PM sharp',
  'Tickets non-transferable',
];

const defaultRules = [
  { title: 'Dress code', body: 'Smart casual — no flip-flops or sleeveless shirts.' },
  {
    title: 'Food & drinks',
    body: 'Food trucks and a full bar inside. Outside food & drinks are not permitted.',
  },
  {
    title: 'Prohibited items',
    body: 'No weapons, illegal substances, professional cameras or laser pointers.',
  },
  {
    title: 'Photography & recording',
    body: 'Phone photography is fine. Professional recording requires organizer approval.',
  },
];

export const EVENTS: Event[] = [
  {
    id: 'ev-1',
    slug: 'indie-night-live',
    title: 'Indie Night Live',
    description:
      "An unforgettable night of live indie music featuring the city's hottest acts. Doors open at 7 PM with a warm-up DJ set, followed by three headline performances on the main stage. Expect great sound, food trucks and a crowd that sings every word. The Wilds close the night with their new album played front-to-back, plus a few surprises we're not allowed to announce yet.",
    category: 'Concerts',
    ageLimit: '18+',
    tags: ['Concert', '18+', 'Indoor'],
    date: iso(7, 24, 20),
    durationHrs: 3,
    venueId: 'arena-hall',
    organizerId: 'livewire',
    status: 'approved',
    conditions: defaultConditions,
    rules: defaultRules,
    lineup: [
      { name: 'DJ Nova', role: 'Opening DJ' },
      { name: 'The Wilds', role: 'Headline artist' },
      { name: 'FizzCo', role: 'Sponsor' },
      { name: 'CityBeat', role: 'Promoter' },
    ],
    tiers: [
      { id: 't1', name: 'General', price: 29, quantity: 500, sold: 412, includes: ['Entry', '1 welcome drink'] },
      { id: 't2', name: 'VIP', price: 79, quantity: 50, sold: 12, includes: ['Entry', 'Lounge access', '2 drinks', 'Meet & greet'] },
      { id: 't3', name: 'Early bird', price: 19, quantity: 100, sold: 100, includes: ['Entry'] },
    ],
    posterHue: 95,
    seo: {
      title: 'Indie Night Live | Austin tickets',
      description:
        'An unforgettable night of live indie music at Arena Hall, Austin. Book on Prebooze.',
      slug: 'indie-night-live-austin',
      keywords: ['indie concert', 'austin', 'live music'],
    },
    promoterConfig: {
      enabled: true,
      cap: 200,
      cutoff: '01:00',
      allowedPromoters: ['nova-nights', 'crowd-co'],
      perHeadPayout: true,
      perHeadAmount: 120,
      allowTeams: true,
    },
  },
  {
    id: 'ev-2',
    slug: 'summer-fest-26',
    title: "Summer Fest '26",
    description:
      'Two stages, twelve artists, one riverside sunset. The biggest open-air festival of the summer returns with food trucks, art installations and a headline set under fireworks.',
    category: 'Festivals',
    ageLimit: 'All ages',
    tags: ['Festival', 'Open-air'],
    date: iso(8, 1, 16),
    durationHrs: 8,
    venueId: 'riverside',
    organizerId: 'livewire',
    status: 'approved',
    conditions: [
      'Entry only with valid QR ticket + photo ID',
      'All ages — under 16 must be with an adult',
      'Re-entry allowed with wristband',
      'Last entry 8 PM',
    ],
    rules: defaultRules,
    lineup: [
      { name: 'DJ Nova', role: 'Opening DJ' },
      { name: 'The Wilds', role: 'Headline artist' },
      { name: 'FizzCo', role: 'Sponsor' },
    ],
    tiers: [
      { id: 't1', name: 'General', price: 45, quantity: 2000, sold: 1032, includes: ['Entry'] },
      { id: 't2', name: 'VIP Lawn', price: 120, quantity: 200, sold: 84, includes: ['Entry', 'VIP lawn', '2 drinks'] },
    ],
    posterHue: 205,
  },
  {
    id: 'ev-3',
    slug: 'stand-up-sunday',
    title: 'Stand-up Sunday',
    description:
      'Five comics, one intimate basement room, zero chill. Doors at 7, first act at 8 — come early, the front row fills fast (if you dare).',
    category: 'Comedy',
    ageLimit: '18+',
    tags: ['Comedy', '18+', 'Indoor'],
    date: iso(8, 2, 19),
    durationHrs: 2,
    venueId: 'comedy-cave',
    organizerId: 'nightowl',
    status: 'approved',
    conditions: defaultConditions.slice(0, 3),
    rules: defaultRules.slice(0, 3),
    lineup: [
      { name: 'Maya K.', role: 'Headline artist' },
      { name: 'Open Mic Five', role: 'Opening acts' },
    ],
    tiers: [
      { id: 't1', name: 'Standard', price: 15, quantity: 300, sold: 122, includes: ['Entry'] },
      { id: 't2', name: 'Front row + drink', price: 35, quantity: 30, sold: 21, includes: ['Entry', 'Front row', '1 drink'] },
    ],
    posterHue: 28,
  },
  {
    id: 'ev-4',
    slug: 'acoustic-evenings',
    title: 'Acoustic Evenings',
    description:
      'Unplugged sessions on the rooftop — three singer-songwriters, string lights and slow sunsets over the skyline. Limited to 200 guests.',
    category: 'Concerts',
    ageLimit: '18+',
    tags: ['Concert', 'Rooftop'],
    date: iso(8, 7, 19),
    durationHrs: 3,
    venueId: 'the-loft',
    organizerId: 'festcrew',
    status: 'approved',
    conditions: defaultConditions.slice(0, 4),
    rules: defaultRules,
    lineup: [{ name: 'June & Co', role: 'Headline artist' }],
    tiers: [
      { id: 't1', name: 'General', price: 22, quantity: 200, sold: 96, includes: ['Entry', '1 welcome drink'] },
    ],
    posterHue: 265,
  },
  {
    id: 'ev-5',
    slug: 'techno-bunker',
    title: 'Techno Bunker',
    description:
      'Raw warehouse energy. International headliner, 30k-watt sound system, lights out at 6 AM. Location shared with ticket holders 24h before doors.',
    category: 'Concerts',
    ageLimit: '21+',
    tags: ['Techno', '21+', 'Warehouse'],
    date: iso(8, 8, 22),
    durationHrs: 8,
    venueId: 'warehouse-9',
    organizerId: 'nightowl',
    status: 'approved',
    conditions: defaultConditions,
    rules: defaultRules,
    lineup: [
      { name: 'KLANG', role: 'Headline artist' },
      { name: 'DJ Nova', role: 'Opening DJ' },
    ],
    tiers: [
      { id: 't1', name: 'Phase 1', price: 35, quantity: 400, sold: 400, includes: ['Entry'] },
      { id: 't2', name: 'Phase 2', price: 49, quantity: 400, sold: 187, includes: ['Entry'] },
      { id: 't3', name: 'Backstage', price: 110, quantity: 40, sold: 9, includes: ['Entry', 'Backstage', '2 drinks'] },
    ],
    posterHue: 330,
  },
  {
    id: 'ev-6',
    slug: 'rooftop-sundowner',
    title: 'Rooftop Sundowner',
    description:
      'Golden-hour house sets, craft cocktails and skyline views. The season closer of our rooftop series.',
    category: 'This weekend',
    ageLimit: '21+',
    tags: ['House', 'Rooftop', '21+'],
    date: iso(8, 15, 17),
    durationHrs: 5,
    venueId: 'the-loft',
    organizerId: 'livewire',
    status: 'pending',
    conditions: defaultConditions.slice(0, 3),
    rules: defaultRules,
    lineup: [{ name: 'DJ Nova', role: 'Headline artist' }],
    tiers: [
      { id: 't1', name: 'General', price: 49, quantity: 180, sold: 0, includes: ['Entry', '1 cocktail'] },
    ],
    posterHue: 45,
  },
  {
    id: 'ev-7',
    slug: 'neon-warehouse-party',
    title: 'Neon Warehouse Party',
    description: 'UV paint, neon installations and bass till late.',
    category: 'Concerts',
    ageLimit: '18+',
    tags: ['Party', '18+'],
    date: iso(8, 22, 21),
    durationHrs: 6,
    venueId: 'warehouse-9',
    organizerId: 'livewire',
    status: 'rejected',
    rejectionReason: 'banner violates guidelines',
    conditions: defaultConditions,
    rules: defaultRules,
    lineup: [],
    tiers: [{ id: 't1', name: 'General', price: 39, quantity: 600, sold: 0, includes: ['Entry'] }],
    posterHue: 310,
  },
  {
    id: 'ev-8',
    slug: 'summer-fest-27',
    title: "Summer Fest '27",
    description: 'Next year, bigger. Draft in progress.',
    category: 'Festivals',
    ageLimit: 'All ages',
    tags: ['Festival'],
    date: iso(12, 31, 16),
    durationHrs: 8,
    venueId: 'riverside',
    organizerId: 'livewire',
    status: 'draft',
    conditions: [],
    rules: [],
    lineup: [],
    tiers: [{ id: 't1', name: 'General', price: 45, quantity: 2000, sold: 0, includes: ['Entry'] }],
    posterHue: 190,
  },
];

// Past events shown on profiles
export const PAST_EVENTS = [
  { title: 'Jazz in the Park', date: '12 Jun', rating: 4, orgRating: 4.8, hue: 140 },
  { title: 'Comedy Open Mic', date: '3 May', rating: 0, orgRating: 4.2, hue: 30 },
  { title: 'NYE Countdown', date: '31 Dec', rating: 5, orgRating: 4.5, hue: 280 },
  { title: 'Techno Bunker', date: '14 Nov', rating: 4, orgRating: 4.7, hue: 330 },
  { title: 'Rooftop Sessions', date: '2 Oct', rating: 4, orgRating: 4.4, hue: 60 },
  { title: 'Indie Unplugged', date: '18 Sep', rating: 5, orgRating: 4.6, hue: 200 },
];

export const REVIEWS: Review[] = [
  {
    id: 'r1',
    author: 'Priya S.',
    rating: 5,
    eventTitle: 'Jazz in the Park',
    text: 'Smooth entry, great sound, well organized.',
  },
  {
    id: 'r2',
    author: 'Marco T.',
    rating: 4,
    eventTitle: 'NYE Countdown',
    text: 'Fun night — queue at the bar was long.',
  },
  {
    id: 'r3',
    author: 'Alex K.',
    rating: 5,
    eventTitle: 'Indie Night Live',
    text: 'QR entry took seconds. Best gig this year.',
  },
];

export const FAQS = [
  {
    q: 'How do I get my ticket?',
    a: 'Sent instantly to your WhatsApp — also downloadable as QR from My Bookings.',
  },
  {
    q: 'Can I cancel a booking?',
    a: 'Yes — free cancellation up to 48 hours before the event. Refunds land back on your payment method instantly.',
  },
  {
    q: 'Do I need an account to book?',
    a: 'You log in with your WhatsApp number and an OTP — no passwords, no forms. Your number is your account.',
  },
  {
    q: 'How do organizers get verified?',
    a: 'Every organizer completes identity KYC (Aadhaar + selfie) and bank verification before their events go live.',
  },
  {
    q: 'When do organizers get paid?',
    a: 'Automatic weekly payouts every Monday, with per-event settlement after the event completes.',
  },
];

export const TRUST_POINTS = [
  'Verified organizers only',
  'WhatsApp OTP — no passwords',
  'Secure QR entry, no fakes',
  'Free cancellation up to 48h',
  'Instant refunds to source',
];

export const COUPONS: Coupon[] = [
  {
    id: 'c1',
    code: 'FIRST50',
    type: 'percent',
    value: 50,
    maxDiscount: 100,
    usageLimit: 500,
    used: 182,
    perUserLimit: 1,
    eventScope: 'all',
    validTill: '31 Aug',
    firstTimeOnly: true,
    status: 'active',
  },
  {
    id: 'c2',
    code: 'VIPLOVE',
    type: 'flat',
    value: 200,
    usageLimit: 100,
    used: 34,
    perUserLimit: 1,
    eventScope: 'Indie Night Live',
    validTill: '24 Jul',
    firstTimeOnly: false,
    status: 'paused',
  },
];

export const PAYOUTS: Payout[] = [
  { date: '6 Jul', event: 'Indie Night Live', amount: 42180, status: 'paid' },
  { date: '29 Jun', event: 'Jazz in the Park', amount: 28400, status: 'paid' },
  { date: '22 Jun', event: 'Comedy Open Mic', amount: 9120, status: 'processing' },
];

export const ATTENDEES: Attendee[] = [
  { bookingId: '#88412', name: 'Sam Rivera', phone: '+1 555•••210', tickets: '2× Gen', qty: 2, status: 'checked-in' },
  { bookingId: '#88393', name: 'J. Okafor', phone: '+1 555•••884', tickets: '1× VIP', qty: 1, status: 'confirmed' },
  { bookingId: '#88371', name: 'M. Chen', phone: '+1 555•••102', tickets: '4× Gen', qty: 4, status: 'refunded' },
  { bookingId: '#88356', name: 'R. Gupta', phone: '+1 555•••339', tickets: '2× Gen', qty: 2, status: 'confirmed' },
  { bookingId: '#88344', name: 'L. Torres', phone: '+1 555•••771', tickets: '3× Gen', qty: 3, status: 'checked-in' },
];

export const venueById = (id: string) => VENUES.find((v) => v.id === id)!;
export const organizerById = (id: string) => ORGANIZERS.find((o) => o.id === id)!;
export const eventBySlug = (slug: string) => EVENTS.find((e) => e.slug === slug);
export const eventById = (id: string) => EVENTS.find((e) => e.id === id);

export const minPrice = (e: Event) =>
  Math.min(...e.tiers.filter((t) => t.sold < t.quantity).map((t) => t.price), ...e.tiers.map((t) => t.price));

export const fmtDate = (isoStr: string) =>
  new Date(isoStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export const fmtTime = (isoStr: string) =>
  new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: undefined, hour12: true }).replace(' ', ' ');

export const fmtMoney = (n: number) => '₹' + n.toLocaleString('en-IN');

// ---- Blog (guest-facing side of the admin Blogs CMS) ----
export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readMins: number;
  views: string;
  tag: string;
  hue: number;
  body: string[];
  linkedEventSlugs: string[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'top-10-gigs-this-monsoon',
    title: 'Top 10 gigs this monsoon',
    excerpt:
      "Rain check? Never heard of it. From rooftop acoustics to warehouse techno, here's where the city is dancing this season.",
    author: 'Dev P.',
    date: '4 Jul 2026',
    readMins: 6,
    views: '2.1k',
    tag: 'City guide',
    hue: 150,
    body: [
      'The monsoon has a way of thinning the crowds and thickening the atmosphere — which is exactly why some of the best gigs of the year happen while it pours. We pulled booking data from the last three seasons and one pattern is clear: indoor shows in July and August sell out faster than any other window.',
      'Leading the pack is Indie Night Live at Arena Hall — three headline acts, a warm-up DJ set, and a sound system that makes the rain outside irrelevant. General tickets are moving fast, and if history repeats, the VIP couches will be gone a week before doors.',
      "If festivals are more your thing, Summer Fest '26 at Riverside Grounds is betting on clear skies with two stages and twelve artists. Pro tip: the day pass is the best value per hour of music anywhere in the city right now.",
      'Comedy fans, don\'t sleep on Stand-up Sunday at Comedy Cave — 180 seats, five comics, zero chill. It\'s the kind of room where the back row heckles and the front row regrets everything.',
      'Whatever you pick, book early, carry a poncho, and remember: every ticket on Prebooze comes with a QR that gets you through the gate in seconds — wet or dry.',
    ],
    linkedEventSlugs: ['indie-night-live', 'summer-fest-26', 'stand-up-sunday'],
  },
  {
    slug: 'how-to-host-a-sold-out-show',
    title: 'How to host a sold-out show',
    excerpt:
      'Organizers who sell out share three habits: early-bird urgency, a tight guest list cap, and posters that pass the three-second test.',
    author: 'Dev P.',
    date: '28 Jun 2026',
    readMins: 8,
    views: '1.4k',
    tag: 'For organizers',
    hue: 95,
    body: [
      "We looked at every sold-out event on Prebooze in the last six months and interviewed the organizers behind them. The good news: none of them relied on luck, and none of them had a huge marketing budget. They had a system.",
      'First, early-bird tiers work — but only when they are genuinely scarce. The sweet spot in our data is 20–25% of total capacity. Sell those in the first week and the psychological clock starts ticking for everyone else.',
      'Second, the poster matters more than the copy. Guests decide in about three seconds whether they can imagine themselves at your event. High contrast, one focal image, date and venue readable at thumbnail size.',
      'Third, the guest-list cap per booking is your friend. Groups of four convert better than singles, but groups of ten stall the queue at the gate. Cap bookings at 6 and your check-in stays smooth.',
      'Ready to try it? Listing an event takes about ten minutes, approval usually lands within a day, and payouts hit your account every week.',
    ],
    linkedEventSlugs: ['rooftop-sundowner'],
  },
  {
    slug: 'venue-spotlight-riverside',
    title: 'Venue spotlight: Riverside Grounds',
    excerpt:
      "8,000 capacity, a river breeze, and the best sunset in Austin. Why every festival wants a date at Riverside — and how it handles the crowds.",
    author: 'Team Prebooze',
    date: '12 Jul 2026',
    readMins: 5,
    views: '890',
    tag: 'Venues',
    hue: 205,
    body: [
      'Some venues host events; Riverside Grounds hosts summers. The sprawling open-air site by the river has become the default answer to the question "where should we do something big?"',
      'The numbers tell the story: 8,000 capacity, eleven upcoming events, and a 4.5 rating across thousands of reviews. But the thing organizers mention first is the load-in — drive-up access for trucks, power on tap, and a site crew that has seen everything.',
      "For guests, the magic is simpler: food trucks along the east fence, a sunset that lands directly behind the main stage, and phone signal that actually works — which matters when your ticket is a QR code.",
      "Riverside's next big one is Summer Fest '26 — two stages, twelve artists, and fireworks over the water. If you only make it to one open-air show this year, make it that one.",
    ],
    linkedEventSlugs: ['summer-fest-26'],
  },
];

export const blogBySlug = (slug: string) => BLOG_POSTS.find((p) => p.slug === slug);


// ---- Line-ups (artists, DJs, sponsors, promoters — followable profiles) ----
export interface LineupProfileData {
  id: string;
  slug: string;
  name: string;
  category: string;
  verified: boolean;
  city: string;
  bio: string;
  links: string[];
  followers: number;
  eventsPlayed: number;
  hue: number;
  emoji: string;
}

export const LINEUPS: LineupProfileData[] = [
  { id: 'lu1', slug: 'dj-nova', name: 'DJ Nova', category: 'DJ', verified: true, city: 'Austin', bio: 'Opening sets that fill the floor before 9 PM. House & disco edits, zero filler. Resident at Arena Hall and the rooftop series.', links: ['ig/djnova', 'soundcloud/djnova'], followers: 4200, eventsPlayed: 38, hue: 200, emoji: '🎧' },
  { id: 'lu2', slug: 'the-wilds', name: 'The Wilds', category: 'Band', verified: true, city: 'Austin', bio: 'Indie four-piece. New album “Night Maps” out now — the headline set plays it front to back with a string section for the closer.', links: ['ig/thewilds', 'spotify/thewilds'], followers: 12800, eventsPlayed: 52, hue: 95, emoji: '🎸' },
  { id: 'lu3', slug: 'maya-k', name: 'Maya K.', category: 'Comedian', verified: true, city: 'Dallas', bio: 'Sharp crowd-work, zero mercy for the front row. As seen at Comedy Cave every other Sunday.', links: ['ig/mayak'], followers: 6100, eventsPlayed: 74, hue: 28, emoji: '🎤' },
  { id: 'lu4', slug: 'klang', name: 'KLANG', category: 'DJ', verified: true, city: 'Berlin', bio: 'Berlin-schooled techno. 6 AM finisher. If the warehouse is still standing, the set isn\'t over.', links: ['ig/klang', 'ra.co/klang'], followers: 22000, eventsPlayed: 120, hue: 330, emoji: '🎛' },
  { id: 'lu5', slug: 'june-and-co', name: 'June & Co', category: 'Artist', verified: false, city: 'Austin', bio: 'Unplugged trio for golden-hour rooftops. Harmonies first, everything else second.', links: ['ig/juneandco'], followers: 2900, eventsPlayed: 21, hue: 265, emoji: '🪕' },
  { id: 'lu6', slug: 'fizzco', name: 'FizzCo', category: 'Sponsor', verified: false, city: 'Austin', bio: 'Craft soda brand sponsoring stages across Texas. Find the FizzCo bar at every partner event.', links: ['fizzco.com'], followers: 900, eventsPlayed: 16, hue: 150, emoji: '🥤' },
  { id: 'lu7', slug: 'citybeat', name: 'CityBeat', category: 'Promoter', verified: true, city: 'Austin', bio: 'Promoting the loudest nights in town since 2019.', links: ['ig/citybeat'], followers: 3100, eventsPlayed: 44, hue: 60, emoji: '📣' },
];

export const lineupBySlug = (slug: string) => LINEUPS.find((l) => l.slug === slug);
export const lineupByName = (name: string) => LINEUPS.find((l) => l.name.toLowerCase() === name.toLowerCase());


// Social links — defaults mirror the admin panel's Settings → Social accounts;
// once the backend lands, the admin values drive these directly.
export const SOCIAL_LINKS = [
  { label: 'Instagram', url: 'https://instagram.com/prebooze' },
  { label: 'X', url: 'https://x.com/prebooze' },
  { label: 'YouTube', url: 'https://youtube.com/@prebooze' },
  { label: 'WhatsApp', url: 'https://wa.me/919876543210' },
];


// ---- Organizer reviews (moderated by admin; organizers view-only) ----
export interface OrgReview {
  id: string;
  author: string;
  rating: number;
  eventTitle: string;
  organizerId: string;
  text: string;
  date: string;
}

export const ORG_REVIEWS: OrgReview[] = [
  { id: 'rv1', author: 'Priya S.', rating: 5, eventTitle: 'Jazz in the Park', organizerId: 'livewire', text: 'Smooth entry, great sound, well organized.', date: '14 Jun' },
  { id: 'rv2', author: 'Marco T.', rating: 4, eventTitle: 'NYE Countdown', organizerId: 'livewire', text: 'Fun night — queue at the bar was long.', date: '2 Jan' },
  { id: 'rv3', author: 'Alex K.', rating: 5, eventTitle: 'Indie Night Live', organizerId: 'livewire', text: 'QR entry took seconds. Best gig this year.', date: '2 Jul' },
  { id: 'rv4', author: 'Nikita R.', rating: 2, eventTitle: 'Techno Bunker', organizerId: 'nightowl', text: 'Sound was great but entry took 40 minutes.', date: '20 Jun' },
  { id: 'rv5', author: 'Dev M.', rating: 4, eventTitle: 'Stand-up Sunday', organizerId: 'nightowl', text: 'Maya K. destroyed. Seats a bit cramped.', date: '28 Jun' },
];

/** Register a runtime-created venue so venueById() keeps working everywhere. */
export const registerVenue = (v: Venue) => {
  if (!VENUES.some((x) => x.id === v.id)) VENUES.push(v);
};


// Home-page testimonials — curated in the admin panel (Content → Testimonials).
export interface Testimonial {
  id: string;
  author: string;
  location: string;
  rating: number;
  quote: string;
}

export const TESTIMONIALS: Testimonial[] = [
  { id: 't1', author: 'Sam Rivera', location: 'Austin', rating: 5, quote: 'Booked in 20 seconds, QR hit my WhatsApp instantly, walked straight in. Never buying paper tickets again.' },
  { id: 't2', author: 'Priya K.', location: 'Austin', rating: 5, quote: 'Found three gigs I would have missed. The city filter is so good.' },
  { id: 't3', author: 'Arjun M.', location: 'Dallas', rating: 4, quote: 'Refund landed back in minutes when my plans changed. Rare for a ticketing app.' },
  { id: 't4', author: 'Neha G.', location: 'Houston', rating: 5, quote: 'Seeing which of my friends were going sealed it — grabbed tickets before they sold out.' },
  { id: 't5', author: 'Dev P.', location: 'Austin', rating: 5, quote: 'The guest-list feature got me in free before the cutoff. Genuinely the best nightlife app here.' },
  { id: 't6', author: 'Sana K.', location: 'Dallas', rating: 5, quote: 'Zero fake listings. Every event I booked was exactly as described. Trustworthy.' },
  { id: 't7', author: 'Vikram R.', location: 'Austin', rating: 4, quote: 'Gate scan took two seconds even with a queue behind me. Smooth operation.' },
  { id: 't8', author: 'Meera J.', location: 'Bengaluru', rating: 5, quote: 'New in town and found my scene in a week. Following people made discovery effortless.' },
  { id: 't9', author: 'Rohit V.', location: 'Austin', rating: 5, quote: 'Cart hold timer saved me from losing my VIP spot while I finished paying. Nice touch.' },
  { id: 't10', author: 'Karan S.', location: 'Houston', rating: 4, quote: 'Clean app, fair fees, instant tickets. Exactly what an events app should be.' },
];


// ---- Promoters / PR (followable public profiles; promote events & run free-entry lists) ----
export interface PromoterProfileData {
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
  showRate: number; // % of guests who actually arrived
  hue: number;
}

export const PROMOTERS: PromoterProfileData[] = [
  { id: 'pr1', slug: 'nova-nights', name: 'Nova Nights', verified: true, city: 'Austin', bio: 'The guest list you actually want to be on. Rooftops, warehouses, after-hours. Free before 1 AM, always.', links: ['ig/novanights', 'wa/novanights'], followers: 8600, eventsPromoted: 64, guestsBrought: 12400, showRate: 78, hue: 285 },
  { id: 'pr2', slug: 'crowd-co', name: 'Crowd Co.', verified: true, city: 'Dallas', bio: 'We fill floors. Techno, house and everything loud — get on the list before the cutoff.', links: ['ig/crowdco'], followers: 4200, eventsPromoted: 38, guestsBrought: 6100, showRate: 71, hue: 150 },
  { id: 'pr3', slug: 'the-plug', name: 'The Plug', verified: false, city: 'Houston', bio: 'New in town, big lists. Comedy nights and indie gigs mostly.', links: ['ig/theplug'], followers: 1900, eventsPromoted: 12, guestsBrought: 1400, showRate: 64, hue: 40 },
];

export const promoterBySlug = (slug: string) => PROMOTERS.find((p) => p.slug === slug);

// Subscription tiers — mirrored from admin config; guests = list adds per month.
export interface SubTier {
  id: string;
  name: string;
  price: number; // ₹ per month
  guests: number; // -1 = unlimited
  perks: string[];
}

export const SUB_TIERS: SubTier[] = [
  { id: 'free', name: 'Free', price: 0, guests: 25, perks: ['25 guests / month', 'Affiliate links', 'Real-time monitoring'] },
  { id: 'starter', name: 'Starter', price: 999, guests: 150, perks: ['150 guests / month', 'Everything in Free', 'Priority support'] },
  { id: 'pro', name: 'Pro', price: 2499, guests: 500, perks: ['500 guests / month', 'Everything in Starter', 'Advanced analytics'] },
  { id: 'elite', name: 'Elite', price: 4999, guests: -1, perks: ['Unlimited guests', 'Everything in Pro', 'Promoter teams', 'Dedicated manager'] },
];


export const GENDER_OPTIONS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];

// ---- People / social graph (followable guests behind "Who's going") ----
export const PEOPLE: Person[] = [
  { id: 'p1', name: 'Aisha Khan', username: 'aisha', city: 'Austin', avatarHue: 285, bio: 'Lives for warehouse sets & rooftop sundowners. DM me your guest lists.', verified: true, followers: 640, follows: ['p2', 'p3', 'p7', 'p5'] },
  { id: 'p2', name: 'Rohit Verma', username: 'rohitv', city: 'Austin', avatarHue: 200, bio: 'Techno, tacos, and 2 AM decisions.', followers: 410, follows: ['p1', 'p4', 'p8', 'p6'] },
  { id: 'p3', name: 'Sana Kapoor', username: 'sanak', city: 'Dallas', avatarHue: 30, bio: 'Comedy nights and indie gigs. Front row or nothing.', verified: true, followers: 980, follows: ['p1', 'p5', 'p7'] },
  { id: 'p4', name: 'Dev Patel', username: 'devp', city: 'Austin', avatarHue: 150, bio: 'Festival regular. Sunscreen influencer.', followers: 230, follows: ['p1', 'p2', 'p6', 'p10'] },
  { id: 'p5', name: 'Neha Gupta', username: 'nehag', city: 'Houston', avatarHue: 330, bio: 'House heads unite.', followers: 520, follows: ['p3', 'p6', 'p9', 'p1'] },
  { id: 'p6', name: 'Arjun Mehta', username: 'arjunm', city: 'Austin', avatarHue: 95, bio: 'Will show up for a good bassline.', followers: 175, follows: ['p4', 'p5', 'p10', 'p2'] },
  { id: 'p7', name: 'Priya Nair', username: 'priyan', city: 'Dallas', avatarHue: 265, bio: 'Day parties > night parties. Fight me.', verified: true, followers: 1240, follows: ['p1', 'p3', 'p2'] },
  { id: 'p8', name: 'Vikram Rao', username: 'vikramr', city: 'Austin', avatarHue: 45, bio: 'Warehouse till sunrise.', followers: 300, follows: ['p2', 'p9', 'p10', 'p6'] },
  { id: 'p9', name: 'Meera Joshi', username: 'meeraj', city: 'Bengaluru', avatarHue: 12, bio: 'New in town, big on plans.', followers: 88, follows: ['p5', 'p8', 'p1'] },
  { id: 'p10', name: 'Karan Shah', username: 'karans', city: 'Austin', avatarHue: 240, bio: 'If there’s a lineup, I’m interested.', followers: 156, follows: ['p6', 'p8', 'p3'] },
];

// Seeded attendance across events — the crowd behind the FOMO. Seeded people are
// visibility-public so friends light up even while your own default is Off.
export const ATTENDANCE: AttendanceRecord[] = [
  { personId: 'p1', eventId: 'ev-1', status: 'going' },
  { personId: 'p2', eventId: 'ev-1', status: 'going' },
  { personId: 'p3', eventId: 'ev-1', status: 'interested' },
  { personId: 'p4', eventId: 'ev-1', status: 'going' },
  { personId: 'p5', eventId: 'ev-1', status: 'interested' },
  { personId: 'p6', eventId: 'ev-1', status: 'going' },
  { personId: 'p1', eventId: 'ev-2', status: 'interested' },
  { personId: 'p2', eventId: 'ev-2', status: 'going' },
  { personId: 'p4', eventId: 'ev-2', status: 'going' },
  { personId: 'p7', eventId: 'ev-2', status: 'going' },
  { personId: 'p3', eventId: 'ev-5', status: 'going' },
  { personId: 'p8', eventId: 'ev-5', status: 'going' },
  { personId: 'p9', eventId: 'ev-5', status: 'interested' },
  { personId: 'p10', eventId: 'ev-5', status: 'going' },
  { personId: 'p5', eventId: 'ev-3', status: 'going' },
  { personId: 'p6', eventId: 'ev-3', status: 'going' },
  { personId: 'p1', eventId: 'ev-7', status: 'going' },
  { personId: 'p9', eventId: 'ev-7', status: 'going' },
  { personId: 'p10', eventId: 'ev-7', status: 'interested' },
];

// Seeded featured placements (admin-approved) — surface first in their sliders.
export const SEED_FEATURED: Featured[] = [
  { id: 'f1', type: 'event', refId: 'ev-3', city: 'Austin', status: 'active', billing: 'per_event', amount: 2000, createdAt: '2026-07-01', expiresAt: '2027-01-01' },
  { id: 'f2', type: 'organizer', refId: 'festcrew', city: 'Austin', status: 'active', billing: 'monthly', amount: 4999, createdAt: '2026-07-01', expiresAt: '2027-01-01' },
  { id: 'f3', type: 'promoter', refId: 'nova-nights', city: 'Austin', status: 'active', billing: 'monthly', amount: 2999, createdAt: '2026-07-01', expiresAt: '2027-01-01' },
  { id: 'f4', type: 'lineup', refId: 'fizzco', city: 'Austin', status: 'active', billing: 'monthly', amount: 1999, createdAt: '2026-07-01', expiresAt: '2027-01-01' },
];

export const personById = (id: string) => PEOPLE.find((p) => p.id === id);
export const personByUsername = (u: string) => PEOPLE.find((p) => p.username === u);
export const attendanceForEvent = (eventId: string) => ATTENDANCE.filter((a) => a.eventId === eventId);
export const eventsForPerson = (personId: string) => ATTENDANCE.filter((a) => a.personId === personId);
