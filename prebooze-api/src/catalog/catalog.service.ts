import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type FeaturedType = 'event' | 'organizer' | 'promoter' | 'lineup' | 'venue';

// Excludes the admin-only/private fields added for the Admin API
// directory-CRUD slice (contactPerson, phone, gstin, pan, bankLast4) — every
// one of these catalog reads is public and unauthenticated, those must never
// leak here. `contact` (a business email) stays public, same as a storefront
// listing a "contact us" address.
const PUBLIC_ORGANIZER_SELECT = {
  id: true, brandName: true, username: true, verified: true, city: true, since: true,
  rating: true, reviewCount: true, eventsHosted: true, followers: true, following: true,
  about: true, logoHue: true, contact: true, eventTypes: true, links: true, seo: true,
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

  /** An event is "over" once its window (date → date + durationHrs) has
   * fully elapsed — same definition Admin API's dashboard "live now" stat
   * uses. Filtered in application code, not the Prisma `where`, since the
   * cutoff depends on each row's own durationHrs. */
  static isEventOver(e: { date: Date; durationHrs: number }, now = new Date()): boolean {
    return new Date(e.date.getTime() + e.durationHrs * 3600000) < now;
  }

  // ---------- events ----------
  async events(q: { city?: string; cat?: string; sub?: string; search?: string; sort?: string }) {
    const events = await this.prisma.event.findMany({
      where: {
        status: 'approved',
        ...(q.city ? { venue: { city: q.city } } : {}),
        ...(q.cat ? { category: q.cat } : {}),
        ...(q.sub ? { subCategory: q.sub } : {}),
        ...(q.search ? { title: { contains: q.search, mode: 'insensitive' } } : {}),
      },
      select: PUBLIC_EVENT_SELECT,
      orderBy: { date: 'asc' },
    });

    const upcoming = events.filter((e) => !CatalogService.isEventOver(e));

    const withPrice = upcoming.map((e) => ({
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

  async event(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: PUBLIC_EVENT_SELECT,
    });
    if (!event || event.status !== 'approved' || CatalogService.isEventOver(event)) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  // ---------- directories ----------
  async venues(city?: string) {
    // `license` (operating-license reference, directory-CRUD slice) excluded
    // — same reasoning as PUBLIC_ORGANIZER_SELECT.
    return this.prisma.venue.findMany({
      where: city ? { city } : {},
      orderBy: { rating: 'desc' },
      select: {
        id: true, name: true, verified: true, type: true, locality: true, city: true, address: true,
        capacity: true, rating: true, followers: true, amenities: true, about: true, timings: true,
        photoHue: true, contact: true, rules: true, seo: true, createdAt: true, updatedAt: true,
      },
    });
  }

  async organizers(city?: string) {
    const rows = await this.prisma.organizer.findMany({
      where: city ? { city } : {},
      orderBy: { eventsHosted: 'desc' },
      select: PUBLIC_ORGANIZER_SELECT,
    });
    if (!city) return rows;
    const featured = await this.activeFeaturedRefs('organizer', city);
    return this.sortFeaturedFirst(rows, (o) => o.id, featured);
  }

  async promoters(city?: string) {
    const rows = await this.prisma.promoter.findMany({ where: city ? { city } : {}, orderBy: { showRate: 'desc' } });
    if (!city) return rows;
    const featured = await this.activeFeaturedRefs('promoter', city);
    return this.sortFeaturedFirst(rows, (p) => p.slug, featured);
  }

  async lineups(city?: string) {
    const rows = await this.prisma.lineup.findMany({ where: city ? { city } : {}, orderBy: { followers: 'desc' } });
    if (!city) return rows;
    const featured = await this.activeFeaturedRefs('lineup', city);
    return this.sortFeaturedFirst(rows, (l) => l.slug, featured);
  }

  async people(city?: string) {
    return this.prisma.person.findMany({ where: city ? { city } : {}, orderBy: { followers: 'desc' } });
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
  async categories() {
    return this.prisma.category.findMany({ orderBy: { sort: 'asc' } });
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

  async trending() {
    const rows = await this.prisma.trendingSearch.findMany({ orderBy: { sort: 'asc' } });
    return rows.map((r) => r.term);
  }
}
