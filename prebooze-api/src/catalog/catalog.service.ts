import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type FeaturedType = 'event' | 'organizer' | 'promoter' | 'lineup' | 'venue';

/** Deterministic cosmetic hue from an id — mirrors SocialService's own copy
 * (person avatars need the same derived-not-authored hue there). */
function hueFromId(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

// Filtered out of auto-detected trending terms — common connector/filler
// words that show up in almost every event title regardless of what's
// actually trending (e.g. "Night Live" everywhere isn't a useful signal).
const TRENDING_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'night', 'nights', 'live', 'presents', 'present',
  'feat', 'featuring', 'vol', 'edition', 'season', 'part', 'special', 'ft', 'at', 'in',
  'on', 'of', 'to', 'an', 'is', 'this', 'our', 'your', 'you', 'all', 'new',
]);

// Excludes the admin-only/private fields added for the Admin API
// directory-CRUD slice (contactPerson, phone, gstin, pan, bankLast4) — every
// one of these catalog reads is public and unauthenticated, those must never
// leak here. `contact` (a business email) stays public, same as a storefront
// listing a "contact us" address.
const PUBLIC_ORGANIZER_SELECT = {
  id: true, brandName: true, username: true, verified: true, city: true, since: true,
  rating: true, reviewCount: true, eventsHosted: true, followers: true, following: true,
  about: true, logoHue: true, logoUrl: true, contact: true, eventTypes: true, socialLinks: true, seo: true,
  createdAt: true, updatedAt: true,
} as const;

// Excludes contactPerson/contactPersonPhone — same admin-only/private
// reasoning as PUBLIC_ORGANIZER_SELECT above.
const PUBLIC_VENUE_SELECT = {
  id: true, name: true, verified: true, type: true, locality: true, city: true, address: true,
  capacity: true, rating: true, reviewCount: true, followers: true, amenities: true, about: true, timings: true,
  photoHue: true, galleryUrls: true, logoUrl: true, contact: true, rules: true, seo: true, socialLinks: true,
  createdAt: true, updatedAt: true,
} as const;

// Excludes the admin-only/private fields added for the Reports/Payments
// slices (commission, paidOut, payoutUtr — a privately negotiated take-rate
// and internal payout bookkeeping) and the rejection note (only meaningful
// for a non-approved event, which should never reach a guest anyway) — same
// reasoning as PUBLIC_ORGANIZER_SELECT above. This was previously leaking
// via a bare `include` that pulled every raw Event column.
const PUBLIC_EVENT_SELECT = {
  id: true, slug: true, title: true, description: true, category: true, subCategory: true,
  ageLimit: true, tags: true, date: true, durationHrs: true, venueId: true, status: true,
  conditions: true, rules: true, lineup: true, posterHue: true, seo: true, promoterConfig: true,
  socialBanners: true, salesPaused: true, posterUrl: true, galleryUrls: true, teaserVideoUrl: true,
  createdAt: true, updatedAt: true,
  tiers: true, venue: true, organizer: { select: PUBLIC_ORGANIZER_SELECT },
} as const;

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  /** Active, in-window featured refIds for a type+city — used to sort "featured first". */
  private async activeFeaturedRefs(type: FeaturedType, city: string): Promise<Set<string>> {
    const rows = await this.prisma.featured.findMany({
      where: { type, city, status: 'active', expiresAt: { gt: new Date() } },
      select: { refId: true },
    });
    return new Set(rows.map((r) => r.refId));
  }

  private sortFeaturedFirst<T>(items: T[], idOf: (t: T) => string, featured: Set<string>): T[] {
    return [...items].sort((a, b) => Number(featured.has(idOf(b))) - Number(featured.has(idOf(a))));
  }

  /** Real follower counts from the Follow table, keyed exactly the way each
   * profile page's own `toggleFollow` call keys it (organizer: bare id,
   * venue/promoter/lineup: "type:id-or-slug" prefixed) — replaces the
   * static seed `followers` int, which real follow/unfollow clicks never
   * moved since the frontend only wrote to local state before this. */
  private async realFollowerCounts(keys: string[]): Promise<Map<string, number>> {
    if (!keys.length) return new Map();
    const rows = await this.prisma.follow.groupBy({ by: ['followeeKey'], where: { followeeKey: { in: keys } }, _count: true });
    return new Map(rows.map((r) => [r.followeeKey, r._count]));
  }

  /** An event is "over" once its window (date → date + durationHrs) has
   * fully elapsed — same definition Admin API's dashboard "live now" stat
   * uses. Filtered in application code, not the Prisma `where`, since the
   * cutoff depends on each row's own durationHrs. */
  static isEventOver(e: { date: Date; durationHrs: number }, now = new Date()): boolean {
    return new Date(e.date.getTime() + e.durationHrs * 3600000) < now;
  }

  // ---------- events ----------
  async events(q: { city?: string; cat?: string; sub?: string; search?: string; sort?: string; organizerId?: string; venueId?: string; includePast?: boolean }) {
    const events = await this.prisma.event.findMany({
      where: {
        status: 'approved',
        ...(q.city ? { venue: { city: q.city } } : {}),
        ...(q.cat ? { category: q.cat } : {}),
        ...(q.sub ? { subCategory: q.sub } : {}),
        ...(q.search ? { title: { contains: q.search, mode: 'insensitive' } } : {}),
        ...(q.organizerId ? { organizerId: q.organizerId } : {}),
        ...(q.venueId ? { venueId: q.venueId } : {}),
      },
      select: PUBLIC_EVENT_SELECT,
      orderBy: { date: 'asc' },
    });

    // General browsing (Home, Categories, search, Wishlist, "recommended")
    // should never surface an event nobody can book anymore — but an
    // organizer's or venue's own profile page shows their full track
    // record, past included, same for anything that explicitly asks for it
    // (LineupProfile.tsx, which has to match by name client-side since
    // Event.lineup isn't a real relation).
    const showPast = Boolean(q.organizerId || q.venueId || q.includePast);
    const visible = showPast ? events : events.filter((e) => !CatalogService.isEventOver(e));

    const withPrice = visible.map((e) => ({
      ...e,
      minPrice: e.tiers.length ? Math.min(...e.tiers.map((t) => t.price)) : 0,
    }));

    let sorted = withPrice;
    if (q.sort === 'price_asc') sorted = [...withPrice].sort((a, b) => a.minPrice - b.minPrice);
    else if (q.sort === 'price_desc') sorted = [...withPrice].sort((a, b) => b.minPrice - a.minPrice);
    // default: date ascending (soonest first), already applied by the query

    if (q.city) {
      const featured = await this.activeFeaturedRefs('event', q.city);
      sorted = this.sortFeaturedFirst(sorted, (e) => e.id, featured);
    }
    return sorted;
  }

  /** Deliberately doesn't gate on isEventOver — a past event's own detail
   * page has to be reachable (from Organizer/Venue/Lineup "Past events",
   * a guest's own booking history, a shared link after the fact) even
   * though nobody can book it anymore; the booking UI itself is what
   * disables purchasing for a finished event, not a 404 here. Draft/
   * pending/rejected events still 404 for anyone who isn't meant to see
   * them at all, regardless of date. */
  async event(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: PUBLIC_EVENT_SELECT,
    });
    if (!event || event.status !== 'approved') {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  // ---------- directories ----------
  async venues(city?: string) {
    // `license` (operating-license reference, directory-CRUD slice) excluded
    // — same reasoning as PUBLIC_ORGANIZER_SELECT.
    const rows = await this.prisma.venue.findMany({
      where: city ? { city } : {},
      orderBy: { rating: 'desc' },
      select: PUBLIC_VENUE_SELECT,
    });
    const counts = await this.realFollowerCounts(rows.map((v) => `venue:${v.id}`));
    return rows.map((v) => ({ ...v, followers: counts.get(`venue:${v.id}`) ?? 0 }));
  }

  /** Single-venue fetch — the detail page used to call venues() (every venue
   * in the whole city or, on some pages, unfiltered) just to find the one it
   * needed, which meant shipping every other venue's full profile over the
   * wire on every visit. Same real GET-by-id gap organizers/promoters/
   * lineups had below. */
  async venue(id: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id },
      select: PUBLIC_VENUE_SELECT,
    });
    if (!venue) throw new NotFoundException('Venue not found');
    const counts = await this.realFollowerCounts([`venue:${venue.id}`]);
    return { ...venue, followers: counts.get(`venue:${venue.id}`) ?? 0 };
  }

  async organizers(city?: string) {
    const rows = await this.prisma.organizer.findMany({
      where: city ? { city } : {},
      orderBy: { eventsHosted: 'desc' },
      select: PUBLIC_ORGANIZER_SELECT,
    });
    const counts = await this.realFollowerCounts(rows.map((o) => o.id));
    const withCounts = rows.map((o) => ({ ...o, followers: counts.get(o.id) ?? 0 }));
    if (!city) return withCounts;
    const featured = await this.activeFeaturedRefs('organizer', city);
    return this.sortFeaturedFirst(withCounts, (o) => o.id, featured);
  }

  async organizer(id: string) {
    const org = await this.prisma.organizer.findUnique({ where: { id }, select: PUBLIC_ORGANIZER_SELECT });
    if (!org) throw new NotFoundException('Organizer not found');
    const counts = await this.realFollowerCounts([org.id]);
    return { ...org, followers: counts.get(org.id) ?? 0 };
  }

  async promoters(city?: string) {
    const rows = await this.prisma.promoter.findMany({ where: city ? { city } : {}, orderBy: { showRate: 'desc' } });
    const counts = await this.realFollowerCounts(rows.map((p) => `promoter:${p.slug}`));
    const withCounts = rows.map((p) => ({ ...p, followers: counts.get(`promoter:${p.slug}`) ?? 0 }));
    if (!city) return withCounts;
    const featured = await this.activeFeaturedRefs('promoter', city);
    return this.sortFeaturedFirst(withCounts, (p) => p.slug, featured);
  }

  async promoter(slug: string) {
    const promoter = await this.prisma.promoter.findUnique({ where: { slug } });
    if (!promoter) throw new NotFoundException('Promoter not found');
    const counts = await this.realFollowerCounts([`promoter:${slug}`]);
    return { ...promoter, followers: counts.get(`promoter:${slug}`) ?? 0 };
  }

  async lineups(city?: string) {
    const rows = await this.prisma.lineup.findMany({ where: city ? { city } : {}, orderBy: { followers: 'desc' } });
    const counts = await this.realFollowerCounts(rows.map((l) => `lineup:${l.slug}`));
    const withCounts = rows.map((l) => ({ ...l, followers: counts.get(`lineup:${l.slug}`) ?? 0 }));
    if (!city) return withCounts;
    const featured = await this.activeFeaturedRefs('lineup', city);
    return this.sortFeaturedFirst(withCounts, (l) => l.slug, featured);
  }

  async lineup(slug: string) {
    const lineup = await this.prisma.lineup.findUnique({ where: { slug } });
    if (!lineup) throw new NotFoundException('Line-up not found');
    const counts = await this.realFollowerCounts([`lineup:${slug}`]);
    return { ...lineup, followers: counts.get(`lineup:${slug}`) ?? 0 };
  }

  async people(city?: string) {
    return this.prisma.person.findMany({ where: city ? { city } : {}, orderBy: { followers: 'desc' } });
  }

  /** Real public guest profile (GET /people/:username) — the "People"
   * directory above still reads the seeded Person model (a separate,
   * explicitly-mock table), but this is a real User row: PersonProfile.tsx
   * used to resolve a username against that same seed data, so a real
   * guest's own profile page 404'd for everyone but never actually existed.
   * `viewerId` (from an optionally-decoded JWT, not a required guard — this
   * route has to work logged out too) only gates the "going"/"interested"
   * payload per the target's attendanceVisibility; followers/following
   * lists are always real and public, same as any other directory profile. */
  async person(username: string, viewerId?: string) {
    const user = await this.prisma.user.findFirst({ where: { username } });
    if (!user) throw new NotFoundException('Person not found');

    const [followerRows, followingRows] = await Promise.all([
      this.prisma.follow.findMany({ where: { followeeKey: `person:${user.id}` } }),
      this.prisma.follow.findMany({ where: { followerId: user.id, followeeKey: { startsWith: 'person:' } } }),
    ]);
    const followerIds = followerRows.map((r) => r.followerId);
    const followingIds = followingRows.map((r) => r.followeeKey.slice('person:'.length));
    const [followerUsers, followingUsers] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: followerIds } } }),
      this.prisma.user.findMany({ where: { id: { in: followingIds } } }),
    ]);
    const toPerson = (u: (typeof followerUsers)[number]) => ({
      id: u.id, name: u.name || 'Guest', username: u.username || u.id, city: u.city,
      avatarHue: hueFromId(u.id), avatarUrl: u.avatarUrl ?? undefined, bio: u.bio || undefined,
      verified: u.idVerified, followers: 0, follows: [] as string[],
    });
    const followers = followerUsers.map(toPerson);
    const following = followingUsers.map(toPerson);

    const isFollowedByViewer = viewerId ? followerIds.includes(viewerId) : false;
    const canSeeAttendance = user.attendanceVisibility === 'public' || (user.attendanceVisibility === 'followers' && isFollowedByViewer);

    let going: unknown[] = [];
    let interested: unknown[] = [];
    if (canSeeAttendance) {
      const [bookings, interests] = await Promise.all([
        this.prisma.booking.findMany({ where: { userId: user.id, status: 'confirmed' }, include: { event: { select: PUBLIC_EVENT_SELECT } } }),
        this.prisma.eventInterest.findMany({ where: { userId: user.id } }),
      ]);
      going = bookings.map((b) => b.event).filter((e) => !CatalogService.isEventOver(e as never));
      const interestedEvents = await this.prisma.event.findMany({
        where: { id: { in: interests.map((i) => i.eventId) }, status: 'approved' },
        select: PUBLIC_EVENT_SELECT,
      });
      interested = interestedEvents.filter((e) => !CatalogService.isEventOver(e as never));
    }

    return {
      id: user.id, name: user.name || 'Guest', username: user.username || user.id, city: user.city,
      bio: user.bio || undefined, avatarUrl: user.avatarUrl ?? undefined, avatarHue: hueFromId(user.id),
      verified: user.idVerified, followers, following, going, interested,
    };
  }

  // ---------- per-entity SEO lookups ----------
  // Slim, id-or-slug tolerant reads for prebooze-web's useEntitySeo hook —
  // these entities don't have a full public detail-by-id route (only list
  // endpoints above), and adding one is out of scope; this just lets a
  // profile page merge in the admin-authored seo override for the one field
  // it actually needs, same "live wins per-field, else fall back" pattern
  // as usePlatformInfo. Always returns a valid seo shape (empty strings, not
  // null/404) on no match — returning JS `null` here serializes to an empty
  // response body, not the JSON literal "null", which broke res.json() on
  // the frontend; an empty-but-valid object is also exactly what useSeo
  // already treats as "no override, fall back to fallbackTitle".
  private static readonly EMPTY_SEO = { title: '', description: '', keywords: '' };

  async venueSeo(id: string) {
    const v = await this.prisma.venue.findUnique({ where: { id }, select: { seo: true } });
    return (v?.seo as typeof CatalogService.EMPTY_SEO) ?? CatalogService.EMPTY_SEO;
  }

  async organizerSeo(idOrUsername: string) {
    const o = await this.prisma.organizer.findFirst({
      where: { OR: [{ id: idOrUsername }, { username: idOrUsername }] },
      select: { seo: true },
    });
    return (o?.seo as typeof CatalogService.EMPTY_SEO) ?? CatalogService.EMPTY_SEO;
  }

  async promoterSeo(idOrSlug: string) {
    const p = await this.prisma.promoter.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { seo: true },
    });
    return (p?.seo as typeof CatalogService.EMPTY_SEO) ?? CatalogService.EMPTY_SEO;
  }

  async lineupSeo(idOrSlug: string) {
    const l = await this.prisma.lineup.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { seo: true },
    });
    return (l?.seo as typeof CatalogService.EMPTY_SEO) ?? CatalogService.EMPTY_SEO;
  }

  async featured(city?: string) {
    return this.prisma.featured.findMany({
      where: { status: 'active', expiresAt: { gt: new Date() }, ...(city ? { city } : {}) },
    });
  }

  // ---------- taxonomy & locations ----------
  // EventCategory is the one real source of truth for the category+
  // subcategory tree — guest browse, the header, and both event editors'
  // pickers all read this same list now (the old legacy Category model +
  // CATEGORY_TREE mock constant are retired).
  async categories() {
    const rows = await this.prisma.eventCategory.findMany({ orderBy: { sort: 'asc' }, select: { name: true, icon: true, subs: true } });
    return rows;
  }

  async cities() {
    // `enabled` (Admin API locations slice) — a disabled city drops out of
    // the public picker entirely, matching the mock's cascading toggle.
    const cities = await this.prisma.city.findMany({ where: { enabled: true }, orderBy: { sort: 'asc' } });
    const counts = await this.prisma.event.groupBy({
      by: ['venueId'],
      where: { status: 'approved' },
      _count: true,
    });
    // map venueId -> city, then aggregate counts per city
    const venues = await this.prisma.venue.findMany({ select: { id: true, city: true } });
    const venueCity = new Map(venues.map((v) => [v.id, v.city]));
    const eventsByCity = new Map<string, number>();
    for (const c of counts) {
      const city = venueCity.get(c.venueId);
      if (!city) continue;
      eventsByCity.set(city, (eventsByCity.get(city) ?? 0) + c._count);
    }
    return cities.map((c) => ({ name: c.name, icon: c.icon ?? undefined, top: c.top, events: eventsByCity.get(c.name) ?? 0 }));
  }

  /** Real, admin-managed venue-type tags (Admin > Content > Venue types),
   * each with a real "how many upcoming events happen at a venue of this
   * type" count — Venue.type is a comma-joined free-text string (same
   * multi-select convention as Organizer.eventTypes), so this tallies by
   * splitting each event's venue's type string and matching against the
   * real type vocabulary, the same way cities() aggregates by venue.city. */
  async venueTypes() {
    const types = await this.prisma.venueType.findMany({ orderBy: { sort: 'asc' } });
    const events = await this.prisma.event.findMany({
      where: { status: 'approved' },
      select: { venue: { select: { type: true } } },
    });
    const counts = new Map<string, number>();
    for (const e of events) {
      const tags = (e.venue?.type ?? '').split(',').map((t) => t.trim()).filter(Boolean);
      for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return types.map((t) => ({ name: t.name, icon: t.icon ?? undefined, events: counts.get(t.name) ?? 0 }));
  }

  // ---------- search ----------
  async search(q: string) {
    if (!q.trim()) return [];
    const like = { contains: q, mode: 'insensitive' as const };
    const [events, venues, organizers, lineups] = await Promise.all([
      this.prisma.event.findMany({ where: { status: 'approved', title: like }, take: 5, select: { title: true, slug: true } }),
      this.prisma.venue.findMany({ where: { name: like }, take: 5, select: { name: true, id: true } }),
      this.prisma.organizer.findMany({ where: { brandName: like }, take: 5, select: { brandName: true, id: true } }),
      this.prisma.lineup.findMany({ where: { name: like }, take: 5, select: { name: true, slug: true } }),
    ]);
    return [
      ...events.map((e) => ({ label: e.title, type: 'Event', to: `/events/${e.slug}` })),
      ...venues.map((v) => ({ label: v.name, type: 'Venue', to: `/venues/${v.id}` })),
      ...organizers.map((o) => ({ label: o.brandName, type: 'Organizer', to: `/organizers/${o.id}` })),
      ...lineups.map((l) => ({ label: l.name, type: 'Artist', to: `/lineup/${l.slug}` })),
    ].slice(0, 7);
  }

  /** Admin-pinned terms (real CRUD — see AdminTrendingController) always
   * show first, in their chosen order; any remaining slots (up to 8 total)
   * are auto-filled by tokenizing upcoming approved events' titles into
   * words, filtering stopwords/short words, and ranking by how many
   * distinct events each word appears in — a real, live "what's trending"
   * signal instead of a permanently-static list admin has to keep hand-
   * curated forever. */
  async trending() {
    const pinned = await this.prisma.trendingSearch.findMany({ orderBy: { sort: 'asc' } });
    const pinnedTerms = pinned.map((r) => r.term);
    const need = 8 - pinnedTerms.length;
    if (need <= 0) return pinnedTerms.slice(0, 8);

    const soon = new Date(Date.now() + 45 * 24 * 3600 * 1000);
    const events = await this.prisma.event.findMany({
      where: { status: 'approved', date: { gte: new Date(), lte: soon } },
      select: { title: true },
    });

    const pinnedLower = new Set(pinnedTerms.map((t) => t.toLowerCase()));
    const counts = new Map<string, number>(); // lowercase word -> distinct-event count
    const display = new Map<string, string>(); // lowercase word -> first-seen original casing
    for (const e of events) {
      const words = new Set(e.title.split(/[\s\-–—:,'"!?()]+/).map((w) => w.trim()).filter(Boolean));
      for (const w of words) {
        const lower = w.toLowerCase();
        if (lower.length < 3 || TRENDING_STOPWORDS.has(lower) || pinnedLower.has(lower)) continue;
        counts.set(lower, (counts.get(lower) ?? 0) + 1);
        if (!display.has(lower)) display.set(lower, w);
      }
    }

    const auto = [...counts.entries()]
      .filter(([, count]) => count > 1) // a word only one event uses isn't "trending"
      .sort((a, b) => b[1] - a[1])
      .slice(0, need)
      .map(([lower]) => display.get(lower)!);

    return [...pinnedTerms, ...auto];
  }
}
