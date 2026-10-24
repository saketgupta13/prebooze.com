import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { toCitySlug } from '../common/city-slug';

/** Public reads for content the Admin API's CMS slice manages. Not called
 * for by prebooze-web's typed contract (src/api/index.ts has no equivalent
 * — this content is still static in the mock), but a CMS nobody can read
 * defeats the point of building one; added so a future frontend wiring has
 * something real to fetch instead of prebooze-web's hardcoded arrays. */
@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  /** `city` scopes to a paid organizer/venue banner for that city
   * (Banner.city) alongside every ordinary admin-created banner (city:
   * null, shown everywhere, unchanged from before paid placements
   * existed) — omit it to get only the global ones, same as before this
   * param existed, rather than guessing which city to scope to.
   * expiresAt is filtered here (not left to the frontend) since the same
   * query-time-filter pattern Featured's activeFeaturedRefs already uses:
   * an expired row just naturally stops matching, no cron needed to "end"
   * it (CronService.marketingExpiryTick only flips the MarketingOrder's
   * own status, for billing-history purposes — it doesn't need to touch
   * this row at all for it to stop showing). */
  async banners(city?: string) {
    return this.prisma.banner.findMany({
      where: {
        active: true,
        OR: [{ city: null }, ...(city ? [{ city }] : [])],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
      },
      orderBy: { sort: 'asc' },
    });
  }

  async testimonials(featuredOnly?: boolean) {
    return this.prisma.testimonial.findMany({
      where: featuredOnly ? { featured: true } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async faqs(audience?: 'guests' | 'organizers') {
    return this.prisma.faqItem.findMany({ where: audience ? { audience } : undefined, orderBy: { sort: 'asc' } });
  }

  async policies() {
    return this.prisma.policy.findMany({ select: { id: true, title: true, slug: true, updatedAt: true }, orderBy: { title: 'asc' } });
  }

  async policy(slug: string) {
    const policy = await this.prisma.policy.findUnique({ where: { slug } });
    if (!policy) throw new NotFoundException('Policy not found');
    return policy;
  }

  async blogs() {
    return this.prisma.blog.findMany({
      where: { status: 'published' },
      select: { id: true, title: true, meta: true, category: true, bannerUrl: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async blog(id: string) {
    const blog = await this.prisma.blog.findUnique({ where: { id } });
    if (!blog || blog.status !== 'published') throw new NotFoundException('Post not found');
    return blog;
  }

  async page(slug: string) {
    const page = await this.prisma.sitePage.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async menu() {
    return (await this.prisma.menuConfig.findUnique({ where: { id: 'main' } })) ?? { header: [], footer: [] };
  }

  /** Same city/expiry shape as banners() above. Also resolves a real
   * "Book now" link — Reel.ctaLink (admin-typed, 2026-10-25, for an
   * ordinary reel with no real paid order behind it) wins if set; otherwise
   * falls back to resolving it from eventId (paid reel marketing,
   * 2026-10-24 — Reel.eventId is a plain denormalized string, no FK, same
   * reasoning as Banner/MarketingOrder's own eventId fields, so this
   * batch-fetches the event's slug + city itself). null bookUrl (neither
   * set, or a linked event that's since been deleted) just means no CTA
   * shows under that reel. */
  async reels(city?: string) {
    const rows = await this.prisma.reel.findMany({
      where: {
        active: true,
        OR: [{ city: null }, ...(city ? [{ city }] : [])],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
      },
      orderBy: { createdAt: 'desc' },
    });
    const eventIds = [...new Set(rows.filter((r) => !r.ctaLink).map((r) => r.eventId).filter((id): id is string => !!id))];
    const events = eventIds.length
      ? await this.prisma.event.findMany({
          where: { id: { in: eventIds } },
          select: { id: true, slug: true, venue: { select: { city: true } }, privateCity: true, unlistedVenueCity: true },
        })
      : [];
    const byId = new Map(events.map((e) => [e.id, e]));
    return rows.map((r) => {
      if (r.ctaLink) return { ...r, bookUrl: r.ctaLink };
      const event = r.eventId ? byId.get(r.eventId) : undefined;
      const eventCity = event?.venue?.city ?? event?.privateCity ?? event?.unlistedVenueCity;
      const bookUrl = event && eventCity ? `/${toCitySlug(eventCity)}/events/${event.slug}` : null;
      return { ...r, bookUrl };
    });
  }

  /** Guest-relevant slice of PlatformSettings only — payoutDay/autoPayout
   * stay admin-internal (organizer/promoter payout ops, nothing a guest
   * needs). bookingFee WAS excluded on the same "internal" theory, but that
   * was actually a bug: BookingsService already charges the real
   * bookingFee on every booking (see bookings.service.ts), so hiding the
   * number from the API while a guest's Checkout page showed a different
   * hardcoded estimate risked the two silently diverging. Exposing the
   * real number here is what lets Checkout.tsx show guests the actual fee
   * they'll be charged instead of a stale guess. gstPct/gstEnabled (real
   * GSTIN activated 2026-09-21) for the exact same reason — Checkout.tsx's
   * own optimistic pre-quote estimate needs the real rate too, not a
   * hardcoded guess, same as bookingFee's own reasoning above. */
  async platformInfo() {
    const s = await this.prisma.platformSettings.upsert({ where: { id: 'main' }, update: {}, create: { id: 'main' } });
    return {
      maintenanceMode: s.maintenanceMode, comingSoonMode: s.comingSoonMode, salesPaused: s.salesPaused, socials: s.socials, siteSeo: s.siteSeo, contact: s.contact,
      footerCopyright: s.footerCopyright, feeLabel: s.feeLabel, absorbedBy: s.absorbedBy,
      bookingFee: s.bookingFee, gstPct: s.gstEnabled ? s.gstPct : 0, logoUrl: s.logoUrl, faviconUrl: s.faviconUrl,
    };
  }
}
