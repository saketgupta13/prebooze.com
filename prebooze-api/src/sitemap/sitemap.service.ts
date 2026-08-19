import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { toCitySlug } from '../common/city-slug';

const SITE_ORIGIN = 'https://prebooze.com';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

// Non-city-scoped pages only — the city-scoped discovery pages (/, /browse,
// /categories, /venues, /organizers, /promoters, /lineups) are generated
// per-city below instead, one entry per city that actually has real
// inventory of that type (see cityListingUrls) rather than a single
// city-agnostic entry that no longer resolves to real content.
const STATIC_URLS: SitemapUrl[] = [
  { loc: '/testimonials', changefreq: 'monthly', priority: 0.4 },
  { loc: '/host', changefreq: 'monthly', priority: 0.7 },
  { loc: '/about', changefreq: 'monthly', priority: 0.5 },
  { loc: '/contact', changefreq: 'monthly', priority: 0.4 },
  { loc: '/faqs', changefreq: 'monthly', priority: 0.5 },
  { loc: '/blog', changefreq: 'weekly', priority: 0.6 },
  { loc: '/careers', changefreq: 'monthly', priority: 0.4 },
];

/** One sitemap entry per (real) city for a given listing-page shape — never
 * blindly every admin-"enabled" city, since a city with zero real inventory
 * of this type would just be an empty listing page, which is exactly the
 * kind of thin content that's actively bad to proactively sitemap. */
function cityListingUrls(cities: Set<string>, path: '' | 'browse' | 'categories' | 'venues' | 'organizers' | 'promoters' | 'lineups', changefreq: string, priority: number): SitemapUrl[] {
  return [...cities].map((city) => ({ loc: `/${toCitySlug(city)}${path ? '/' + path : ''}`, changefreq, priority }));
}

/** Real, DB-driven sitemap — every dynamic entry below is public/live
 * content a guest can actually browse to, regenerated on every request
 * instead of a hand-maintained static file that inevitably drifts the
 * moment a new event/venue/organizer gets published. Guest profiles
 * (/u/:username) are deliberately excluded — individual people aren't the
 * kind of content worth proactively promoting to search engines, unlike
 * businesses/events. */
@Injectable()
export class SitemapService {
  constructor(private prisma: PrismaService) {}

  async build(): Promise<string> {
    const [events, venues, organizers, promoters, lineups, pages, blogs] = await Promise.all([
      this.prisma.event.findMany({ where: { status: 'approved' }, select: { slug: true, updatedAt: true, privateCity: true, venue: { select: { city: true } } } }),
      this.prisma.venue.findMany({ select: { id: true, updatedAt: true, city: true } }),
      this.prisma.organizer.findMany({ select: { id: true, updatedAt: true, city: true } }),
      this.prisma.promoter.findMany({ select: { slug: true, updatedAt: true, city: true } }),
      this.prisma.lineup.findMany({ select: { slug: true, updatedAt: true, city: true } }),
      this.prisma.sitePage.findMany({ select: { slug: true, updatedAt: true } }),
      this.prisma.blog.findMany({ where: { status: 'published' }, select: { id: true, updatedAt: true } }),
    ]);

    // Skips an event with neither a venue nor a privateCity — violates the
    // schema's own "exactly one of the two" invariant, shouldn't happen,
    // but a sitemap entry with no city segment would be a malformed URL.
    const eventsWithCity = events
      .map((e) => ({ ...e, city: e.venue?.city ?? e.privateCity }))
      .filter((e): e is typeof e & { city: string } => !!e.city);

    const eventCities = new Set(eventsWithCity.map((e) => e.city));
    const venueCities = new Set(venues.map((v) => v.city));
    const organizerCities = new Set(organizers.map((o) => o.city));
    const promoterCities = new Set(promoters.map((p) => p.city));
    const lineupCities = new Set(lineups.map((l) => l.city));

    const urls: SitemapUrl[] = [
      ...STATIC_URLS,
      ...cityListingUrls(eventCities, '', 'daily', 1.0),
      ...cityListingUrls(eventCities, 'browse', 'daily', 0.9),
      ...cityListingUrls(eventCities, 'categories', 'weekly', 0.6),
      ...cityListingUrls(venueCities, 'venues', 'weekly', 0.8),
      ...cityListingUrls(organizerCities, 'organizers', 'weekly', 0.8),
      ...cityListingUrls(promoterCities, 'promoters', 'weekly', 0.8),
      ...cityListingUrls(lineupCities, 'lineups', 'weekly', 0.8),
      ...eventsWithCity.map((e) => ({ loc: `/${toCitySlug(e.city)}/events/${e.slug}`, lastmod: e.updatedAt.toISOString(), changefreq: 'weekly', priority: 0.8 })),
      ...venues.map((v) => ({ loc: `/${toCitySlug(v.city)}/venues/${v.id}`, lastmod: v.updatedAt.toISOString(), changefreq: 'weekly', priority: 0.7 })),
      ...organizers.map((o) => ({ loc: `/${toCitySlug(o.city)}/organizers/${o.id}`, lastmod: o.updatedAt.toISOString(), changefreq: 'weekly', priority: 0.7 })),
      ...promoters.map((p) => ({ loc: `/${toCitySlug(p.city)}/promoter/${p.slug}`, lastmod: p.updatedAt.toISOString(), changefreq: 'weekly', priority: 0.6 })),
      ...lineups.map((l) => ({ loc: `/${toCitySlug(l.city)}/lineup/${l.slug}`, lastmod: l.updatedAt.toISOString(), changefreq: 'weekly', priority: 0.6 })),
      ...pages.map((p) => ({ loc: `/legal/${p.slug}`, lastmod: p.updatedAt.toISOString(), changefreq: 'yearly', priority: 0.3 })),
      ...blogs.map((b) => ({ loc: `/blog/${b.id}`, lastmod: b.updatedAt.toISOString(), changefreq: 'monthly', priority: 0.6 })),
    ];

    const body = urls
      .map((u) => {
        const parts = [`    <loc>${SITE_ORIGIN}${u.loc}</loc>`];
        if (u.lastmod) parts.push(`    <lastmod>${u.lastmod}</lastmod>`);
        if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
        if (u.priority !== undefined) parts.push(`    <priority>${u.priority.toFixed(1)}</priority>`);
        return `  <url>\n${parts.join('\n')}\n  </url>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  }
}
