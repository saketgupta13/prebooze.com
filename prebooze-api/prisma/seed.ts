/** Ports prebooze-web/src/data/mock.ts into Postgres — same ids/slugs, so the
 * frontend's existing links (e.g. /events/indie-night-live) resolve unchanged
 * once VITE_API_URL is set. Re-run anytime: everything upserts. */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/admin/password.util';

const db = new PrismaClient();

const year = new Date().getFullYear();
const iso = (m: number, d: number, h = 20) => new Date(year, m - 1, d, h, 0, 0);

const defaultConditions = [
  'Entry only with valid QR ticket + photo ID',
  '18+ event — age verified at gate',
  'No re-entry once checked in',
  'Gates close at 9:30 PM sharp',
  'Tickets non-transferable',
];
const defaultRules = [
  { title: 'Dress code', body: 'Smart casual — no flip-flops or sleeveless shirts.' },
  { title: 'Food & drinks', body: 'Food trucks and a full bar inside. Outside food & drinks are not permitted.' },
  { title: 'Prohibited items', body: 'No weapons, illegal substances, professional cameras or laser pointers.' },
  { title: 'Photography & recording', body: 'Phone photography is fine. Professional recording requires organizer approval.' },
];

const VENUES = [
  { id: 'arena-hall', name: 'Arena Hall', verified: true, type: 'Concert hall', locality: 'Downtown', city: 'Austin', address: '214 Congress Ave, Downtown, Austin, TX 78701', capacity: 2500, rating: 4.7, followers: 840, amenities: ['🅿 Parking', '♿ Accessible', '🍸 In-house bar'], about: 'A landmark downtown concert hall with a 2,500 capacity main floor, mezzanine bar and one of the best sound systems in the city. Home to indie gigs, club nights and album launches since 2014.', timings: 'Thu–Sun · 7 PM – 2 AM', photoHue: 152 },
  { id: 'riverside', name: 'Riverside Grounds', verified: true, type: 'Open-air', locality: 'Riverside', city: 'Austin', address: 'Riverside Park, Festival Ln, Austin, TX', capacity: 8000, rating: 4.5, followers: 620, amenities: ['🅿 Parking', '🍔 Food trucks', '⛺ Open-air'], about: 'Sprawling open-air festival grounds by the river — the go-to spot for summer festivals, food carnivals and sundowner sets.', timings: 'Fri–Sun · 4 PM – 11 PM', photoHue: 205 },
  { id: 'comedy-cave', name: 'Comedy Cave', verified: true, type: 'Club', locality: 'Downtown', city: 'Austin', address: '88 6th St, Downtown, Austin, TX', capacity: 350, rating: 4.6, followers: 410, amenities: ['🍸 In-house bar', '♿ Accessible'], about: "Austin's tightest comedy room. Low ceilings, loud laughs — open mics on weekdays, headline specials on weekends.", timings: 'Wed–Sun · 6 PM – 1 AM', photoHue: 28 },
  { id: 'the-loft', name: 'The Loft', verified: false, type: 'Rooftop bar', locality: 'Downtown', city: 'Austin', address: '5th & Lamar, Downtown, Austin, TX', capacity: 220, rating: 4.3, followers: 260, amenities: ['🍸 In-house bar', '🌇 Rooftop'], about: 'Rooftop bar with skyline views, acoustic sessions and slow sunsets. Intimate capacity — shows sell out fast.', timings: 'Thu–Sat · 8 PM – 3 AM', photoHue: 265 },
  { id: 'warehouse-9', name: 'Warehouse 9', verified: false, type: 'Warehouse', locality: 'East Side', city: 'Austin', address: 'Bay 9, Industrial Blvd, East Austin, TX', capacity: 1200, rating: 4.4, followers: 380, amenities: ['🔊 30k-watt rig', '🅿 Parking'], about: 'Raw industrial warehouse turned late-night techno institution. Concrete, strobes, and sound you feel in your chest.', timings: 'Fri–Sat · 10 PM – 6 AM', photoHue: 330 },
  { id: 'the-basement', name: 'The Basement', verified: false, type: 'Club', locality: 'South Congress', city: 'Austin', address: 'S Congress Ave, Austin, TX', capacity: 300, rating: 4.2, followers: 190, amenities: ['🍸 In-house bar'], about: 'Underground club for house heads and after-hours sets on South Congress.', timings: 'Tue–Sun · 7 PM – 2 AM', photoHue: 90 },
  { id: 'gateway-arena', name: 'Gateway Arena', verified: true, type: 'Concert hall', locality: 'Colaba', city: 'Mumbai', address: 'Apollo Bunder Rd, Colaba, Mumbai 400001', capacity: 3200, rating: 4.6, followers: 2100, amenities: ['🅿 Parking', '♿ Accessible', '🍸 In-house bar'], about: 'Sea-facing concert hall by the Gateway — Bollywood nights, indie gigs and big-room shows.', photoHue: 210 },
  { id: 'bandra-warehouse', name: 'Bandra Warehouse', verified: true, type: 'Warehouse', locality: 'Bandra West', city: 'Mumbai', address: 'Off Hill Rd, Bandra West, Mumbai 400050', capacity: 900, rating: 4.5, followers: 1500, amenities: ['🔊 Pro sound', '🍸 In-house bar'], about: 'Raw warehouse space for techno and after-hours — the city’s loudest floor.', photoHue: 300 },
  { id: 'cp-club', name: 'CP Underground', verified: true, type: 'Club', locality: 'Connaught Place', city: 'Delhi', address: 'Inner Circle, Connaught Place, New Delhi 110001', capacity: 450, rating: 4.4, followers: 980, amenities: ['🍸 In-house bar', '♿ Accessible'], about: 'A basement club in the heart of CP — comedy early, house music late.', photoHue: 40 },
  { id: 'indiranagar-social', name: 'Indiranagar Social Hall', verified: true, type: 'Club', locality: 'Indiranagar', city: 'Bengaluru', address: '100 Feet Rd, Indiranagar, Bengaluru 560038', capacity: 600, rating: 4.7, followers: 1750, amenities: ['🅿 Parking', '🍸 In-house bar'], about: 'Bengaluru’s indie living room — gigs, open mics and craft-beer nights.', photoHue: 130 },
  { id: 'charminar-hall', name: 'Charminar Vault', verified: true, type: 'Warehouse', locality: 'Old City', city: 'Hyderabad', address: 'Near Charminar, Hyderabad 500002', capacity: 800, rating: 4.3, followers: 720, amenities: ['🔊 Pro sound'], about: 'A converted vault by the old city — techno and bass nights till late.', photoHue: 265 },
  { id: 'orange-city-grounds', name: 'Orange City Grounds', verified: false, type: 'Open-air', locality: 'Civil Lines', city: 'Nagpur', address: 'Civil Lines, Nagpur 440001', capacity: 2500, rating: 4.2, followers: 430, amenities: ['🅿 Parking', '🍔 Food trucks'], about: 'Open-air grounds for sundowners and festival-style evenings.', photoHue: 25 },
];

const ORGANIZERS = [
  { id: 'livewire', brandName: 'LiveWire Ent.', username: 'livewire', verified: true, city: 'Austin', since: '2023', rating: 4.6, reviewCount: 182, eventsHosted: 24, followers: 1200, following: 86, about: "Austin's indie-music collective. 24 shows and counting — concerts, rooftop gigs & festivals.", logoHue: 95 },
  { id: 'nightowl', brandName: 'NightOwl Co.', username: 'nightowl', verified: true, city: 'Austin', since: '2024', rating: 4.4, reviewCount: 97, eventsHosted: 17, followers: 780, following: 41, about: 'Late-night club series & warehouse takeovers. If it ends before 4 AM, it isn’t ours.', logoHue: 260 },
  { id: 'festcrew', brandName: 'FestCrew', username: 'festcrew', verified: true, city: 'Austin', since: '2024', rating: 4.5, reviewCount: 64, eventsHosted: 12, followers: 540, following: 28, about: 'Open-air festivals, food carnivals and day parties across Texas.', logoHue: 25 },
  { id: 'bombaybeats', brandName: 'Bombay Beats', username: 'bombaybeats', verified: true, city: 'Mumbai', since: '2022', rating: 4.7, reviewCount: 240, eventsHosted: 31, followers: 4200, following: 120, about: 'Mumbai’s warehouse-and-rooftop collective — techno, Bollywood mashups and sea-breeze sundowners.', logoHue: 210 },
  { id: 'delhinights', brandName: 'Delhi Nights Co.', username: 'delhinights', verified: true, city: 'Delhi', since: '2023', rating: 4.5, reviewCount: 130, eventsHosted: 18, followers: 2600, following: 85, about: 'CP basements to Hauz Khas rooftops — comedy, hip-hop and house.', logoHue: 40 },
  { id: 'blrcollective', brandName: 'BLR Collective', username: 'blrcollective', verified: true, city: 'Bengaluru', since: '2021', rating: 4.8, reviewCount: 310, eventsHosted: 42, followers: 5100, following: 140, about: 'Bengaluru’s indie-gig machine — live bands, craft nights and open mics.', logoHue: 130 },
  { id: 'deccanlive', brandName: 'Deccan Live', username: 'deccanlive', verified: false, city: 'Hyderabad', since: '2024', rating: 4.3, reviewCount: 48, eventsHosted: 9, followers: 900, following: 40, about: 'Hyderabad + Vidarbha circuit — bass nights and open-air sundowners.', logoHue: 265 },
];

const PROMOTERS = [
  { id: 'pr1', slug: 'nova-nights', name: 'Nova Nights', verified: true, city: 'Austin', bio: 'The guest list you actually want to be on. Rooftops, warehouses, after-hours. Free before 1 AM, always.', links: ['ig/novanights', 'wa/novanights'], followers: 8600, eventsPromoted: 64, guestsBrought: 12400, showRate: 78 },
  { id: 'pr2', slug: 'crowd-co', name: 'Crowd Co.', verified: true, city: 'Dallas', bio: 'We fill floors. Techno, house and everything loud — get on the list before the cutoff.', links: ['ig/crowdco'], followers: 4200, eventsPromoted: 38, guestsBrought: 6100, showRate: 71 },
  { id: 'pr3', slug: 'the-plug', name: 'The Plug', verified: false, city: 'Houston', bio: 'New in town, big lists. Comedy nights and indie gigs mostly.', links: ['ig/theplug'], followers: 1900, eventsPromoted: 12, guestsBrought: 1400, showRate: 64 },
  { id: 'pr4', slug: 'bombay-guestlist', name: 'Bombay Guestlist', verified: true, city: 'Mumbai', bio: 'Bandra to Lower Parel — if there’s a list worth being on, we run it. Free before midnight.', links: ['ig/bombayguestlist'], followers: 11200, eventsPromoted: 58, guestsBrought: 15800, showRate: 81 },
  { id: 'pr5', slug: 'dilli-doors', name: 'Dilli Doors', verified: true, city: 'Delhi', bio: 'CP, HKV and GK — comedy lists early, club lists late.', links: ['ig/dillidoors'], followers: 6800, eventsPromoted: 34, guestsBrought: 7200, showRate: 74 },
  { id: 'pr6', slug: 'blr-lists', name: 'BLR Lists', verified: false, city: 'Bengaluru', bio: 'Indiranagar & Koramangala gig lists. Bring your crew.', links: ['ig/blrlists'], followers: 3100, eventsPromoted: 19, guestsBrought: 2900, showRate: 69 },
];

const LINEUPS = [
  { id: 'lu1', slug: 'dj-nova', name: 'DJ Nova', category: 'DJ', verified: true, city: 'Austin', bio: 'Opening sets that fill the floor before 9 PM. House & disco edits, zero filler. Resident at Arena Hall and the rooftop series.', links: ['ig/djnova', 'soundcloud/djnova'], followers: 4200, eventsPlayed: 38, hue: 200, emoji: '🎧' },
  { id: 'lu2', slug: 'the-wilds', name: 'The Wilds', category: 'Band', verified: true, city: 'Austin', bio: 'Indie four-piece. New album “Night Maps” out now — the headline set plays it front to back with a string section for the closer.', links: ['ig/thewilds', 'spotify/thewilds'], followers: 12800, eventsPlayed: 52, hue: 95, emoji: '🎸' },
  { id: 'lu3', slug: 'maya-k', name: 'Maya K.', category: 'Comedian', verified: true, city: 'Dallas', bio: 'Sharp crowd-work, zero mercy for the front row. As seen at Comedy Cave every other Sunday.', links: ['ig/mayak'], followers: 6100, eventsPlayed: 74, hue: 28, emoji: '🎤' },
  { id: 'lu4', slug: 'klang', name: 'KLANG', category: 'DJ', verified: true, city: 'Berlin', bio: 'Berlin-schooled techno. 6 AM finisher. If the warehouse is still standing, the set isn\'t over.', links: ['ig/klang', 'ra.co/klang'], followers: 22000, eventsPlayed: 120, hue: 330, emoji: '🎛' },
  { id: 'lu5', slug: 'june-and-co', name: 'June & Co', category: 'Artist', verified: false, city: 'Austin', bio: 'Unplugged trio for golden-hour rooftops. Harmonies first, everything else second.', links: ['ig/juneandco'], followers: 2900, eventsPlayed: 21, hue: 265, emoji: '🪕' },
  { id: 'lu6', slug: 'fizzco', name: 'FizzCo', category: 'Sponsor', verified: false, city: 'Austin', bio: 'Craft soda brand sponsoring stages across Texas. Find the FizzCo bar at every partner event.', links: ['fizzco.com'], followers: 900, eventsPlayed: 16, hue: 150, emoji: '🥤' },
  { id: 'lu7', slug: 'citybeat', name: 'CityBeat', category: 'Promoter', verified: true, city: 'Austin', bio: 'Promoting the loudest nights in town since 2019.', links: ['ig/citybeat'], followers: 3100, eventsPlayed: 44, hue: 60, emoji: '📣' },
  { id: 'lu8', slug: 'dj-arjuna', name: 'DJ Arjuna', category: 'DJ', verified: true, city: 'Mumbai', bio: 'Bollywood-techno crossovers that keep both crowds on the floor. Resident at Bandra Warehouse.', links: ['ig/djarjuna'], followers: 18400, eventsPlayed: 96, hue: 210, emoji: '🎧' },
  { id: 'lu9', slug: 'the-mirchi-band', name: 'The Mirchi Band', category: 'Band', verified: true, city: 'Delhi', bio: 'Delhi’s spice-rock four-piece — Hindi originals with brass. Loud, warm, unmissable.', links: ['ig/mirchiband'], followers: 9200, eventsPlayed: 61, hue: 10, emoji: '🎸' },
  { id: 'lu10', slug: 'blr-strings', name: 'BLR Strings', category: 'Artist', verified: false, city: 'Bengaluru', bio: 'Acoustic trio for terrace sets and craft-brewery evenings.', links: ['ig/blrstrings'], followers: 4100, eventsPlayed: 38, hue: 130, emoji: '🪕' },
  { id: 'lu11', slug: 'hyd-flow', name: 'HYD Flow', category: 'DJ', verified: false, city: 'Hyderabad', bio: 'Bass, breaks and Deccan drums — the vault’s favourite selector.', links: ['ig/hydflow'], followers: 2700, eventsPlayed: 22, hue: 265, emoji: '🎛' },
];

const PEOPLE = [
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
  { id: 'p11', name: 'Ananya Rao', username: 'ananyar', city: 'Mumbai', avatarHue: 210, bio: 'Bandra warehouse regular. Sunrise chai after every set.', verified: true, followers: 820, follows: ['p1', 'p12'] },
  { id: 'p12', name: 'Kabir Malhotra', username: 'kabirm', city: 'Delhi', avatarHue: 40, bio: 'Comedy basements > everything.', followers: 340, follows: ['p11'] },
  { id: 'p13', name: 'Diya Kulkarni', username: 'diyak', city: 'Nagpur', avatarHue: 25, bio: 'Orange city, golden hours.', followers: 150, follows: ['p11', 'p9'] },
];

const CATEGORIES = [
  { name: 'Concerts', icon: '🎸', subs: ['Indie', 'Live band', 'Techno', 'Bollywood', 'EDM', 'Hip-hop'], sort: 0 },
  { name: 'Comedy', icon: '🎤', subs: ['Stand-up', 'Open mic', 'Improv'], sort: 1 },
  { name: 'Festivals', icon: '🎪', subs: ['Music festival', 'Sundowner', 'Food & drink', 'Cultural'], sort: 2 },
  { name: 'Club nights', icon: '🪩', subs: ['House', 'After-hours', 'Bollywood night', 'Ladies night'], sort: 3 },
];

const TOP_CITIES = [
  { name: 'Mumbai', icon: '🌉' }, { name: 'Delhi', icon: '🏛️' }, { name: 'Bengaluru', icon: '🌳' },
  { name: 'Hyderabad', icon: '🕌' }, { name: 'Chennai', icon: '🎬' }, { name: 'Pune', icon: '🎓' },
  { name: 'Kolkata', icon: '🌁' }, { name: 'Goa', icon: '🏝️' }, { name: 'Nagpur', icon: '🍊' },
  { name: 'Austin', icon: '🎸' }, { name: 'Jaipur', icon: '🏰' }, { name: 'Ahmedabad', icon: '🪁' },
];
const OTHER_CITIES = ['Dallas', 'Houston']; // referenced by events/promoters/people but not in the Top-12 picker

// Admin API locations slice — Country/State hierarchy layered on top of the
// same City rows seeded above (linked by name after both exist below).
const SEED_LOCATIONS = [
  {
    country: 'India',
    states: {
      Maharashtra: ['Mumbai', 'Pune', 'Nagpur'],
      Delhi: ['Delhi'],
      Karnataka: ['Bengaluru'],
      Telangana: ['Hyderabad'],
      'Tamil Nadu': ['Chennai'],
      'West Bengal': ['Kolkata'],
      Goa: ['Goa'],
      Rajasthan: ['Jaipur'],
      Gujarat: ['Ahmedabad'],
    },
  },
  { country: 'United States', states: { Texas: ['Austin', 'Dallas', 'Houston'] } },
];

const TRENDING_SEARCHES = ['Techno', 'Bandra Warehouse Rave', 'Comedy night', 'DJ Arjuna', 'Sundowner', 'Bollywood'];

type SeedTier = { id: string; name: string; price: number; quantity: number; sold: number; includes: string[] };
type SeedEvent = {
  id: string; slug: string; title: string; description: string; category: string; subCategory?: string;
  ageLimit: string; tags: string[]; date: Date; durationHrs: number; venueId: string; organizerId: string;
  status: 'approved' | 'pending' | 'rejected' | 'draft'; rejectionReason?: string; conditions: string[];
  rules: { title: string; body: string }[]; lineup: { name: string; role: string }[]; tiers: SeedTier[];
  posterHue: number; seo?: object; promoterConfig?: object;
};

const EVENTS: SeedEvent[] = [
  { id: 'ev-1', slug: 'indie-night-live', title: 'Indie Night Live', description: "An unforgettable night of live indie music featuring the city's hottest acts. Doors open at 7 PM with a warm-up DJ set, followed by three headline performances on the main stage. Expect great sound, food trucks and a crowd that sings every word. The Wilds close the night with their new album played front-to-back, plus a few surprises we're not allowed to announce yet.", category: 'Concerts', subCategory: 'Indie', ageLimit: '18+', tags: ['Concert', '18+', 'Indoor'], date: iso(7, 24, 20), durationHrs: 3, venueId: 'arena-hall', organizerId: 'livewire', status: 'approved', conditions: defaultConditions, rules: defaultRules, lineup: [{ name: 'DJ Nova', role: 'Opening DJ' }, { name: 'The Wilds', role: 'Headline artist' }, { name: 'FizzCo', role: 'Sponsor' }, { name: 'CityBeat', role: 'Promoter' }], tiers: [{ id: 't1', name: 'General', price: 29, quantity: 500, sold: 412, includes: ['Entry', '1 welcome drink'] }, { id: 't2', name: 'VIP', price: 79, quantity: 50, sold: 12, includes: ['Entry', 'Lounge access', '2 drinks', 'Meet & greet'] }, { id: 't3', name: 'Early bird', price: 19, quantity: 100, sold: 100, includes: ['Entry'] }], posterHue: 95, seo: { title: 'Indie Night Live | Austin tickets', description: 'An unforgettable night of live indie music at Arena Hall, Austin. Book on Prebooze.', slug: 'indie-night-live-austin', keywords: ['indie concert', 'austin', 'live music'] }, promoterConfig: { enabled: true, cap: 200, cutoff: '01:00', allowedPromoters: ['nova-nights', 'crowd-co'], perHeadPayout: true, perHeadAmount: 120, allowTeams: true } },
  { id: 'ev-2', slug: 'summer-fest-26', title: "Summer Fest '26", description: 'Two stages, twelve artists, one riverside sunset. The biggest open-air festival of the summer returns with food trucks, art installations and a headline set under fireworks.', category: 'Festivals', subCategory: 'Music festival', ageLimit: 'All ages', tags: ['Festival', 'Open-air'], date: iso(8, 1, 16), durationHrs: 8, venueId: 'riverside', organizerId: 'livewire', status: 'approved', conditions: ['Entry only with valid QR ticket + photo ID', 'All ages — under 16 must be with an adult', 'Re-entry allowed with wristband', 'Last entry 8 PM'], rules: defaultRules, lineup: [{ name: 'DJ Nova', role: 'Opening DJ' }, { name: 'The Wilds', role: 'Headline artist' }, { name: 'FizzCo', role: 'Sponsor' }], tiers: [{ id: 't1', name: 'General', price: 45, quantity: 2000, sold: 1032, includes: ['Entry'] }, { id: 't2', name: 'VIP Lawn', price: 120, quantity: 200, sold: 84, includes: ['Entry', 'VIP lawn', '2 drinks'] }], posterHue: 205 },
  { id: 'ev-3', slug: 'stand-up-sunday', title: 'Stand-up Sunday', description: 'Five comics, one intimate basement room, zero chill. Doors at 7, first act at 8 — come early, the front row fills fast (if you dare).', category: 'Comedy', subCategory: 'Stand-up', ageLimit: '18+', tags: ['Comedy', '18+', 'Indoor'], date: iso(8, 2, 19), durationHrs: 2, venueId: 'comedy-cave', organizerId: 'nightowl', status: 'approved', conditions: defaultConditions.slice(0, 3), rules: defaultRules.slice(0, 3), lineup: [{ name: 'Maya K.', role: 'Headline artist' }, { name: 'Open Mic Five', role: 'Opening acts' }], tiers: [{ id: 't1', name: 'Standard', price: 15, quantity: 300, sold: 122, includes: ['Entry'] }, { id: 't2', name: 'Front row + drink', price: 35, quantity: 30, sold: 21, includes: ['Entry', 'Front row', '1 drink'] }], posterHue: 28 },
  { id: 'ev-4', slug: 'acoustic-evenings', title: 'Acoustic Evenings', description: 'Unplugged sessions on the rooftop — three singer-songwriters, string lights and slow sunsets over the skyline. Limited to 200 guests.', category: 'Concerts', subCategory: 'Live band', ageLimit: '18+', tags: ['Concert', 'Rooftop'], date: iso(8, 7, 19), durationHrs: 3, venueId: 'the-loft', organizerId: 'festcrew', status: 'approved', conditions: defaultConditions.slice(0, 4), rules: defaultRules, lineup: [{ name: 'June & Co', role: 'Headline artist' }], tiers: [{ id: 't1', name: 'General', price: 22, quantity: 200, sold: 96, includes: ['Entry', '1 welcome drink'] }], posterHue: 265 },
  { id: 'ev-5', slug: 'techno-bunker', title: 'Techno Bunker', description: 'Raw warehouse energy. International headliner, 30k-watt sound system, lights out at 6 AM. Location shared with ticket holders 24h before doors.', category: 'Concerts', subCategory: 'Techno', ageLimit: '21+', tags: ['Techno', '21+', 'Warehouse'], date: iso(8, 8, 22), durationHrs: 8, venueId: 'warehouse-9', organizerId: 'nightowl', status: 'approved', conditions: defaultConditions, rules: defaultRules, lineup: [{ name: 'KLANG', role: 'Headline artist' }, { name: 'DJ Nova', role: 'Opening DJ' }], tiers: [{ id: 't1', name: 'Phase 1', price: 35, quantity: 400, sold: 400, includes: ['Entry'] }, { id: 't2', name: 'Phase 2', price: 49, quantity: 400, sold: 400, includes: ['Entry'] }, { id: 't3', name: 'Backstage', price: 110, quantity: 40, sold: 40, includes: ['Entry', 'Backstage', '2 drinks'] }], posterHue: 330 },
  { id: 'ev-6', slug: 'rooftop-sundowner', title: 'Rooftop Sundowner', description: 'Golden-hour house sets, craft cocktails and skyline views. The season closer of our rooftop series.', category: 'This weekend', subCategory: 'Sundowner', ageLimit: '21+', tags: ['House', 'Rooftop', '21+'], date: iso(8, 15, 17), durationHrs: 5, venueId: 'the-loft', organizerId: 'livewire', status: 'pending', conditions: defaultConditions.slice(0, 3), rules: defaultRules, lineup: [{ name: 'DJ Nova', role: 'Headline artist' }], tiers: [{ id: 't1', name: 'General', price: 49, quantity: 180, sold: 0, includes: ['Entry', '1 cocktail'] }], posterHue: 45 },
  { id: 'ev-7', slug: 'neon-warehouse-party', title: 'Neon Warehouse Party', description: 'UV paint, neon installations and bass till late.', category: 'Concerts', subCategory: 'Techno', ageLimit: '18+', tags: ['Party', '18+'], date: iso(8, 22, 21), durationHrs: 6, venueId: 'warehouse-9', organizerId: 'livewire', status: 'rejected', rejectionReason: 'banner violates guidelines', conditions: defaultConditions, rules: defaultRules, lineup: [], tiers: [{ id: 't1', name: 'General', price: 39, quantity: 600, sold: 0, includes: ['Entry'] }], posterHue: 310 },
  { id: 'ev-8', slug: 'summer-fest-27', title: "Summer Fest '27", description: 'Next year, bigger. Draft in progress.', category: 'Festivals', subCategory: 'Music festival', ageLimit: 'All ages', tags: ['Festival'], date: iso(12, 31, 16), durationHrs: 8, venueId: 'riverside', organizerId: 'livewire', status: 'draft', conditions: [], rules: [], lineup: [], tiers: [{ id: 't1', name: 'General', price: 45, quantity: 2000, sold: 0, includes: ['Entry'] }], posterHue: 190 },
  { id: 'ev-9', slug: 'bandra-warehouse-rave', title: 'Bandra Warehouse Rave', description: 'Mumbai’s loudest floor goes all night — two rooms of techno with a sunrise chai counter outside.', category: 'Concerts', subCategory: 'Techno', ageLimit: '21+', tags: ['Techno', '21+', 'Warehouse'], date: iso(8, 8, 22), durationHrs: 6, venueId: 'bandra-warehouse', organizerId: 'bombaybeats', status: 'approved', conditions: ['Entry only with valid QR ticket + photo ID', '21+ event — age verified at gate'], rules: [], lineup: [{ name: 'KLANG', role: 'Headline artist' }], tiers: [{ id: 't1', name: 'Early bird', price: 499, quantity: 300, sold: 300, includes: ['Entry'] }, { id: 't2', name: 'General', price: 799, quantity: 500, sold: 342, includes: ['Entry', '1 drink'] }], posterHue: 300 },
  { id: 'ev-10', slug: 'bollywood-night-gateway', title: 'Bollywood Night at the Gateway', description: 'A sea-facing Bollywood mashup night — live dhol, 2000s throwbacks and a midnight confetti drop.', category: 'Concerts', subCategory: 'Bollywood', ageLimit: '18+', tags: ['Bollywood', '18+', 'Indoor'], date: iso(8, 15, 20), durationHrs: 4, venueId: 'gateway-arena', organizerId: 'bombaybeats', status: 'approved', conditions: ['Entry only with valid QR ticket + photo ID'], rules: [], lineup: [], tiers: [{ id: 't1', name: 'General', price: 599, quantity: 1500, sold: 780, includes: ['Entry'] }, { id: 't2', name: 'VIP deck', price: 1499, quantity: 200, sold: 64, includes: ['Entry', 'Sea-view deck', '2 drinks'] }], posterHue: 210 },
  { id: 'ev-11', slug: 'cp-comedy-underground', title: 'CP Comedy Underground', description: 'Five comics, one basement, zero mercy — Delhi’s sharpest open-secret comedy night.', category: 'Comedy', subCategory: 'Stand-up', ageLimit: '18+', tags: ['Comedy', '18+', 'Indoor'], date: iso(8, 9, 19), durationHrs: 2, venueId: 'cp-club', organizerId: 'delhinights', status: 'approved', conditions: ['Entry only with valid QR ticket + photo ID'], rules: [], lineup: [{ name: 'Maya K.', role: 'Headline artist' }], tiers: [{ id: 't1', name: 'Entry', price: 349, quantity: 400, sold: 265, includes: ['Entry'] }], posterHue: 40 },
  { id: 'ev-12', slug: 'indiranagar-indie-jam', title: 'Indiranagar Indie Jam', description: 'Three live bands, craft taps and a terrace acoustic set to close — Bengaluru’s coziest gig night.', category: 'Concerts', subCategory: 'Indie', ageLimit: 'All ages', tags: ['Indie', 'Live band'], date: iso(8, 10, 19), durationHrs: 3, venueId: 'indiranagar-social', organizerId: 'blrcollective', status: 'approved', conditions: [], rules: [], lineup: [{ name: 'June & Co', role: 'Opening DJ' }], tiers: [{ id: 't1', name: 'Entry', price: 449, quantity: 550, sold: 391, includes: ['Entry', '1 craft pint'] }], posterHue: 130 },
  { id: 'ev-13', slug: 'charminar-bass-vault', title: 'Charminar Bass Vault', description: 'Bass and breaks in a converted old-city vault — Hyderabad’s heaviest system.', category: 'Concerts', subCategory: 'EDM', ageLimit: '21+', tags: ['Bass', '21+', 'Warehouse'], date: iso(8, 16, 21), durationHrs: 5, venueId: 'charminar-hall', organizerId: 'deccanlive', status: 'approved', conditions: ['21+ event — age verified at gate'], rules: [], lineup: [], tiers: [{ id: 't1', name: 'General', price: 699, quantity: 700, sold: 214, includes: ['Entry'] }], posterHue: 265 },
  { id: 'ev-14', slug: 'orange-city-sundowner', title: 'Orange City Sundowner', description: 'Open-air sundowner on the grounds — food trucks, a golden-hour acoustic set and a night market.', category: 'Festivals', subCategory: 'Sundowner', ageLimit: 'All ages', tags: ['Open-air', 'Sundowner'], date: iso(8, 23, 16), durationHrs: 6, venueId: 'orange-city-grounds', organizerId: 'deccanlive', status: 'approved', conditions: [], rules: [], lineup: [], tiers: [{ id: 't1', name: 'Day pass', price: 299, quantity: 2000, sold: 486, includes: ['Entry'] }], posterHue: 25 },
];

const COUPONS = [
  { id: 'c1', code: 'FIRST50', type: 'percent', value: 50, maxDiscount: 100, usageLimit: 500, used: 182, perUserLimit: 1, eventScope: 'all', validTill: new Date('2026-08-31'), firstTimeOnly: true, status: 'active' },
  { id: 'c2', code: 'VIPLOVE', type: 'flat', value: 200, usageLimit: 100, used: 34, perUserLimit: 1, eventScope: 'Indie Night Live', validTill: new Date('2026-07-24'), firstTimeOnly: false, status: 'paused' },
];

const CAREER_JOBS = [
  { id: 'job1', title: 'Senior React Engineer', team: 'Engineering', loc: 'Mumbai · Hybrid', type: 'Full-time', status: 'open',
    about: 'Own the guest web app end-to-end — the booking flow, the social layer and the promoter tools millions of night-outs will run on.',
    responsibilities: ['Ship features across the React + TypeScript codebase', 'Own performance: sub-second booking flows on mid-range phones', 'Pair with design on a fast, dark, native-feeling web experience', 'Mentor two mid-level engineers'],
    requirements: ['5+ years with React (hooks, context, suspense)', 'Strong TypeScript and API design instincts', 'Shipped consumer products at scale', 'Bonus: payments / ticketing background'] },
  { id: 'job2', title: 'City Growth Manager', team: 'Growth', loc: 'Bengaluru', type: 'Full-time', status: 'open',
    about: 'Launch and grow Prebooze in Bengaluru — organizers, promoters, venues and the first thousand nights out.',
    responsibilities: ['Sign the city’s top organizers and venues', 'Build the promoter network from zero', 'Own city P&L and weekly growth targets', 'Run launch events with the marketing team'],
    requirements: ['3+ years in growth / city ops (Zomato, Blinkit, Swiggy-style)', 'Deep local nightlife network', 'Comfort with targets and ambiguity'] },
  { id: 'job3', title: 'Community & Promoter Ops', team: 'Operations', loc: 'Delhi', type: 'Full-time', status: 'open',
    about: 'Run the promoter community — onboarding, quality, payouts and keeping show-rates honest.',
    responsibilities: ['Vet and onboard promoter crews', 'Monitor guest-list quality and fraud signals', 'Own promoter payout operations', 'Host monthly promoter meetups'],
    requirements: ['2+ years community or marketplace ops', 'Excellent WhatsApp-speed communication', 'Nightlife native'] },
  { id: 'job4', title: 'Design Intern', team: 'Design', loc: 'Remote', type: 'Internship', status: 'open',
    about: 'Six months shipping real product design — event pages, social banners and the design system.',
    responsibilities: ['Design flows alongside a senior designer', 'Maintain the component library', 'Create social/banner templates for organizers'],
    requirements: ['A portfolio with real product work', 'Figma fluency', 'Available 5 days/week'] },
];

// Admin API careers slice — ported from prebooze-admin/src/store/data.ts.
const SEED_CAREER_TEAMS = ['Engineering', 'Design', 'Growth', 'Operations', 'Support'];
const SEED_APPLICANTS = [
  { id: 'ap1', jobId: 'job1', name: 'Rahul Iyer', email: 'rahul@dev.io', phone: '+91 98•••• 2210', note: 'github.com/rahuldev — 6y React' },
  { id: 'ap2', jobId: 'job1', name: 'Sneha Patil', email: 'sneha@ui.dev', phone: '+91 97•••• 8841', note: 'Ex-Zomato web platform' },
  { id: 'ap3', jobId: 'job2', name: 'Aditya Rao', email: 'adi@growth.co', phone: '+91 96•••• 3324', note: 'Scaled 3 cities at Blinkit' },
  { id: 'ap4', jobId: 'job4', name: 'Mira Shah', email: 'mira@design.me', phone: '+91 90•••• 6672', note: 'behance.net/mirashah' },
];

// Mirrors prebooze-admin's src/store/data.ts PERM_MODULES/SEED_ROLES exactly.
const PERM_MODULES = [
  'Payments & payouts', 'Refunds', 'Event commission (per event)', 'Events & approvals',
  'Content (banners / blogs / pages)', 'Customers & organizers', 'Gate check-in',
];
const perm = (view: boolean, edit: boolean, approve: boolean) => ({ view, edit, approve });
const allOn = () => Object.fromEntries(PERM_MODULES.map((m) => [m, perm(true, true, true)]));

const SEED_ROLES: Record<string, Record<string, { view: boolean; edit: boolean; approve: boolean }>> = {
  Owner: allOn(),
  Manager: { ...allOn(), 'Payments & payouts': perm(true, true, false) },
  Finance: {
    'Payments & payouts': perm(true, true, true), Refunds: perm(true, true, true),
    'Event commission (per event)': perm(true, true, false), 'Events & approvals': perm(true, false, false),
    'Content (banners / blogs / pages)': perm(true, false, false), 'Customers & organizers': perm(true, false, false),
    'Gate check-in': perm(false, false, false),
  },
  Content: {
    'Payments & payouts': perm(false, false, false), Refunds: perm(false, false, false),
    'Event commission (per event)': perm(false, false, false), 'Events & approvals': perm(true, false, false),
    'Content (banners / blogs / pages)': perm(true, true, true), 'Customers & organizers': perm(true, false, false),
    'Gate check-in': perm(false, false, false),
  },
  Support: {
    'Payments & payouts': perm(false, false, false), Refunds: perm(true, true, false),
    'Event commission (per event)': perm(false, false, false), 'Events & approvals': perm(true, false, false),
    'Content (banners / blogs / pages)': perm(true, false, false), 'Customers & organizers': perm(true, true, false),
    'Gate check-in': perm(true, false, false),
  },
  'Scanner only': {
    'Payments & payouts': perm(false, false, false), Refunds: perm(false, false, false),
    'Event commission (per event)': perm(false, false, false), 'Events & approvals': perm(false, false, false),
    'Content (banners / blogs / pages)': perm(false, false, false), 'Customers & organizers': perm(false, false, false),
    'Gate check-in': perm(true, true, false),
  },
};

// Dev-only bootstrap account — the very first Owner has to come from
// somewhere, since creating staff requires an already-logged-in Owner.
// Rotate this password before any real deployment.
const SEED_STAFF = [
  { id: 'staff-owner', name: 'Owner', email: 'owner@prebooze.com', password: 'prebooze123', roleName: 'Owner', city: 'Mumbai' },
];

// Content CMS seed data — ported from prebooze-admin/src/store/data.ts
// (the authoritative shape for this content, not prebooze-web's separate
// static arrays, which don't have ids or the fields this schema needs).
const SEED_BANNERS = [
  { id: 'b1', title: 'Summer Fest hero', statusLabel: 'Live · #1', heading: "Summer Fest '26 is here", description: 'Two stages, twelve artists, fireworks over the river.', ctaLabel: 'Get day passes →', ctaLink: '/events/summer-fest-26', active: true, sort: 0 },
  { id: 'b2', title: 'Host with us', statusLabel: 'Live · #2', heading: 'Turn your events into income', description: 'List in minutes, get paid weekly.', ctaLabel: 'Join as organizer', ctaLink: '/host', active: true, sort: 1 },
  { id: 'b3', title: 'Diwali promo', statusLabel: 'Scheduled', heading: 'Diwali nights, 25% off', description: 'Use DIWALI25 at checkout.', ctaLabel: 'Browse events', ctaLink: '/browse', active: false, sort: 2 },
];

const SEED_BLOG_CATEGORIES = [
  { id: 'bc1', name: 'City guide' },
  { id: 'bc2', name: 'For organizers' },
  { id: 'bc3', name: 'Venues' },
];

const SEED_BLOGS = [
  { id: 'bl1', title: 'Top 10 gigs this monsoon', meta: 'by Dev P. · 2.1k views', status: 'published', category: 'City guide', content: 'The monsoon has a way of thinning the crowds and thickening the atmosphere…' },
  { id: 'bl2', title: 'How to host a sold-out show', meta: 'by Dev P. · targets organizers', status: 'draft', category: 'For organizers', content: 'We looked at every sold-out event on Prebooze in the last six months…' },
  { id: 'bl3', title: 'Venue spotlight: Riverside', meta: 'scheduled 12 Jul, 9 AM', status: 'scheduled', category: 'Venues', content: 'Some venues host events; Riverside Grounds hosts summers…' },
];

const SEED_PAGES = [
  { slug: '/about', title: 'About us' },
  { slug: '/host', title: 'Host with us' },
  { slug: '/refunds', title: 'Refund policy' },
  { slug: '/corporate', title: 'Corporate events' },
  { slug: '/faqs', title: 'FAQs', navGroup: 'Support' },
];

const SEED_TESTIMONIALS = [
  { id: 't1', author: 'Sam Rivera', location: 'Austin', rating: 5, quote: 'Booked in 20 seconds, QR hit my WhatsApp instantly, walked straight in. Never buying paper tickets again.', featured: true },
  { id: 't2', author: 'Priya K.', location: 'Austin', rating: 5, quote: 'Found three gigs I would have missed. The city filter is so good.', featured: true },
  { id: 't3', author: 'Arjun M.', location: 'Dallas', rating: 4, quote: 'Refund landed back in minutes when my plans changed. Rare for a ticketing app.', featured: true },
  { id: 't4', author: 'Nia T.', location: 'Houston', rating: 5, quote: 'Group QR for all four of us meant no bottleneck at the gate. Smart.', featured: false },
];

const SEED_FAQS = [
  { id: 'f1', question: 'How do I get my ticket?', answer: 'Sent instantly to your WhatsApp — also downloadable as a QR from My Bookings.', audience: 'guests', sort: 0 },
  { id: 'f2', question: 'Can I cancel a booking?', answer: 'Yes — free cancellation up to 48 hours before the event. Refunds land back on your payment method instantly.', audience: 'guests', sort: 1 },
  { id: 'f3', question: 'Do I need an account to book?', answer: 'You log in with your WhatsApp number and an OTP — no passwords. Your number is your account.', audience: 'guests', sort: 2 },
  { id: 'f4', question: 'How do organizers get verified?', answer: 'Every organizer completes identity KYC (Aadhaar + selfie) and bank verification before their events go live.', audience: 'organizers', sort: 3 },
  { id: 'f5', question: 'When do organizers get paid?', answer: 'Automatic weekly payouts every Monday, with per-event settlement after the event completes.', audience: 'organizers', sort: 4 },
];

const policyDoc = (id: string, title: string, slug: string, sections: string[]) => ({
  id, title, slug,
  sections: sections.map((h) => ({ heading: h, body: 'Placeholder copy — final legal language to be drafted and reviewed by counsel before launch. It describes, in plain terms, the rights and responsibilities that apply here.' })),
});
const SEED_POLICIES = [
  policyDoc('terms', 'Terms & Conditions', '/legal/terms', ['Introduction', 'Account & eligibility', 'Booking & payments', 'Cancellations', 'Conduct at events', 'Liability']),
  policyDoc('privacy', 'Privacy Policy', '/legal/privacy', ['Data we collect', 'How we use it', 'Sharing & WhatsApp', 'Government ID data', 'Your rights']),
  policyDoc('organizer-policy', 'Organizer Policy', '/legal/organizer-policy', ['Verification & KYC', 'Listing standards', 'Payouts & fees', 'Approval & rejection', 'Suspension']),
  policyDoc('guest-policy', 'Guest Policy', '/legal/guest-policy', ['Entry requirements', 'Age & ID checks', 'Ticket transfers', 'Code of conduct', 'Bans & reporting']),
  policyDoc('refund-policy', 'Refund Policy', '/legal/refund-policy', ['Cancellation window', 'Refund timelines', 'Event cancelled by organizer', 'Non-refundable cases']),
  policyDoc('disclaimer', 'Disclaimer', '/legal/disclaimer', ['Third-party events', 'No warranty', 'Assumption of risk']),
];

const SEED_MENU = {
  header: [
    { label: 'Events', to: '/browse' },
    { label: 'Venues', to: '/venues' },
    { label: 'Blog', to: '/blog' },
    { label: 'Host with us', to: '/host' },
  ],
  footer: [
    { title: 'Explore', links: [{ label: 'Events', to: '/browse' }, { label: 'Venues', to: '/venues' }, { label: 'Blog', to: '/blog' }] },
    { title: 'Company', links: [{ label: 'About us', to: '/about' }, { label: 'Host with us', to: '/host' }, { label: 'Contact', to: '/contact' }] },
    { title: 'Support', links: [{ label: 'FAQs', to: '/faqs' }, { label: 'Refund policy', to: '/legal/refund-policy' }, { label: 'Terms', to: '/legal/terms' }, { label: 'Privacy', to: '/legal/privacy' }] },
  ],
};

const SEED_FEATURED = [
  { id: 'f1', type: 'event' as const, refId: 'ev-3', city: 'Austin', status: 'active' as const, billing: 'per_event' as const, amount: 2000, expiresAt: new Date('2027-01-01') },
  { id: 'f2', type: 'organizer' as const, refId: 'festcrew', city: 'Austin', status: 'active' as const, billing: 'monthly' as const, amount: 4999, expiresAt: new Date('2027-01-01') },
  { id: 'f3', type: 'promoter' as const, refId: 'nova-nights', city: 'Austin', status: 'active' as const, billing: 'monthly' as const, amount: 2999, expiresAt: new Date('2027-01-01') },
  { id: 'f4', type: 'lineup' as const, refId: 'fizzco', city: 'Austin', status: 'active' as const, billing: 'monthly' as const, amount: 1999, expiresAt: new Date('2027-01-01') },
  { id: 'f5', type: 'venue' as const, refId: 'warehouse-9', city: 'Austin', status: 'active' as const, billing: 'monthly' as const, amount: 3999, expiresAt: new Date('2027-01-01') },
  { id: 'f6', type: 'venue' as const, refId: 'the-loft', city: 'Austin', status: 'active' as const, billing: 'monthly' as const, amount: 3999, expiresAt: new Date('2027-01-01') },
];

async function main() {
  for (const v of VENUES) await db.venue.upsert({ where: { id: v.id }, create: v, update: v });
  for (const o of ORGANIZERS) await db.organizer.upsert({ where: { id: o.id }, create: o, update: o });
  for (const p of PROMOTERS) await db.promoter.upsert({ where: { id: p.id }, create: p, update: p });
  for (const l of LINEUPS) await db.lineup.upsert({ where: { id: l.id }, create: l, update: l });
  for (const p of PEOPLE) await db.person.upsert({ where: { id: p.id }, create: p, update: p });
  for (const c of CATEGORIES) await db.category.upsert({ where: { name: c.name }, create: c, update: c });

  let sort = 0;
  for (const c of TOP_CITIES) await db.city.upsert({ where: { name: c.name }, create: { ...c, top: true, sort: sort++ }, update: { ...c, top: true, sort: sort - 1 } });
  for (const name of OTHER_CITIES) await db.city.upsert({ where: { name }, create: { name, top: false, sort: sort++ }, update: {} });

  for (const { country, states } of SEED_LOCATIONS) {
    const countryRow = await db.country.upsert({ where: { name: country }, create: { name: country }, update: {} });
    for (const [stateName, cities] of Object.entries(states)) {
      const stateRow = await db.state.upsert({
        where: { countryId_name: { countryId: countryRow.id, name: stateName } },
        create: { countryId: countryRow.id, name: stateName },
        update: {},
      });
      for (const cityName of cities) await db.city.update({ where: { name: cityName }, data: { stateId: stateRow.id } });
    }
  }

  sort = 0;
  for (const term of TRENDING_SEARCHES) await db.trendingSearch.upsert({ where: { term }, create: { term, sort: sort++ }, update: { sort: sort - 1 } });

  for (const e of EVENTS) {
    // tier ids ("t1"/"t2"/"t3") are only unique *within* an event in the
    // frontend mock data — namespace them for our globally-unique TicketTier.id
    const { tiers, ...rest } = e;
    const namespacedTiers = tiers.map((t) => ({ ...t, id: `${e.id}-${t.id}` }));
    await db.event.upsert({
      where: { id: e.id },
      create: { ...rest, tiers: { create: namespacedTiers } },
      update: { ...rest },
    });
    // keep sold/quantity stable on re-seed rather than duplicating rows
    for (const t of namespacedTiers) {
      await db.ticketTier.upsert({
        where: { id: t.id },
        create: { ...t, eventId: e.id },
        update: {},
      });
    }
  }

  for (const f of SEED_FEATURED) await db.featured.upsert({ where: { id: f.id }, create: f, update: f });
  for (const c of COUPONS) await db.coupon.upsert({ where: { id: c.id }, create: c, update: c });
  for (const j of CAREER_JOBS) await db.careerJob.upsert({ where: { id: j.id }, create: j, update: j });
  for (const name of SEED_CAREER_TEAMS) await db.careerTeam.upsert({ where: { name }, create: { name }, update: {} });
  for (const a of SEED_APPLICANTS) await db.jobApplication.upsert({ where: { id: a.id }, create: a, update: a });

  for (const [name, permissions] of Object.entries(SEED_ROLES)) {
    await db.staffRole.upsert({ where: { name }, create: { name, permissions }, update: { permissions } });
  }
  for (const s of SEED_STAFF) {
    const { password, ...rest } = s;
    await db.staff.upsert({
      where: { id: rest.id },
      create: { ...rest, passwordHash: hashPassword(password) },
      update: { name: rest.name, roleName: rest.roleName, city: rest.city },
    });
  }

  for (const b of SEED_BANNERS) await db.banner.upsert({ where: { id: b.id }, create: b, update: b });
  for (const c of SEED_BLOG_CATEGORIES) await db.blogCategory.upsert({ where: { id: c.id }, create: c, update: c });
  for (const b of SEED_BLOGS) await db.blog.upsert({ where: { id: b.id }, create: b, update: b });
  for (const p of SEED_PAGES) await db.sitePage.upsert({ where: { slug: p.slug }, create: p, update: p });
  for (const t of SEED_TESTIMONIALS) await db.testimonial.upsert({ where: { id: t.id }, create: t, update: t });
  for (const f of SEED_FAQS) await db.faqItem.upsert({ where: { id: f.id }, create: f, update: f });
  for (const p of SEED_POLICIES) await db.policy.upsert({ where: { id: p.id }, create: p, update: p });
  await db.menuConfig.upsert({ where: { id: 'main' }, create: { id: 'main', ...SEED_MENU }, update: SEED_MENU });

  console.log(`Seeded: ${VENUES.length} venues, ${ORGANIZERS.length} organizers, ${PROMOTERS.length} promoters, ${LINEUPS.length} lineups, ${PEOPLE.length} people, ${EVENTS.length} events, ${SEED_FEATURED.length} featured, ${COUPONS.length} coupons, ${CAREER_JOBS.length} career jobs, ${Object.keys(SEED_ROLES).length} staff roles, ${SEED_STAFF.length} staff, ${SEED_BANNERS.length} banners, ${SEED_BLOGS.length} blogs, ${SEED_PAGES.length} pages, ${SEED_TESTIMONIALS.length} testimonials, ${SEED_FAQS.length} faqs, ${SEED_POLICIES.length} policies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
