import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const SITE_ORIGIN = 'https://prebooze.com';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

const STATIC_URLS: SitemapUrl[] = [
  { loc: '/', changefreq: 'daily', priority: 1.0 },
  { loc: '/browse', changefreq: 'daily', priority: 0.9 },
  { loc: '/categories', changefreq: 'weekly', priority: 0.6 },
  { loc: '/venues', changefreq: 'weekly', priority: 0.8 },
  { loc: '/organizers', changefreq: 'weekly', priority: 0.8 },
  { loc: '/promoters', changefreq: 'weekly', priority: 0.8 },
  { loc: '/lineups', changefreq: 'weekly', priority: 0.8 },
  { loc: '/testimonials', changefreq: 'monthly', priority: 0.4 },
  { loc: '/host', changefreq: 'monthly', priority: 0.7 },
  { loc: '/about', changefreq: 'monthly', priority: 0.5 },
  { loc: '/contact', changefreq: 'monthly', priority: 0.4 },
  { loc: '/faqs', changefreq: 'monthly', priority: 0.5 },
  { loc: '/blog', changefreq: 'weekly', priority: 0.6 },
  { loc: '/careers', changefreq: 'monthly', priority: 0.4 },
];

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
      this.prisma.event.findMany({ where: { status: 'approved' }, select: { slug: true, updatedAt: true } }),
      this.prisma.venue.findMany({ select: { id: true, updatedAt: true } }),
      this.prisma.organizer.findMany({ select: { id: true, updatedAt: true } }),
      this.prisma.promoter.findMany({ select: { slug: true, updatedAt: true } }),
      this.prisma.lineup.findMany({ select: { slug: true, updatedAt: true } }),
      this.prisma.sitePage.findMany({ select: { slug: true, updatedAt: true } }),
      this.prisma.blog.findMany({ where: { status: 'published' }, select: { id: true, updatedAt: true } }),
    ]);

    const urls: SitemapUrl[] = [
      ...STATIC_URLS,
      ...events.map((e) => ({ loc: `/events/${e.slug}`, lastmod: e.updatedAt.toISOString(), changefreq: 'weekly', priority: 0.8 })),
      ...venues.map((v) => ({ loc: `/venues/${v.id}`, lastmod: v.updatedAt.toISOString(), changefreq: 'weekly', priority: 0.7 })),
      ...organizers.map((o) => ({ loc: `/organizers/${o.id}`, lastmod: o.updatedAt.toISOString(), changefreq: 'weekly', priority: 0.7 })),
      ...promoters.map((p) => ({ loc: `/promoter/${p.slug}`, lastmod: p.updatedAt.toISOString(), changefreq: 'weekly', priority: 0.6 })),
      ...lineups.map((l) => ({ loc: `/lineup/${l.slug}`, lastmod: l.updatedAt.toISOString(), changefreq: 'weekly', priority: 0.6 })),
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
