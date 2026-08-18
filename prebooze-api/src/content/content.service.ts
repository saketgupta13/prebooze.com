import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/** Public reads for content the Admin API's CMS slice manages. Not called
 * for by prebooze-web's typed contract (src/api/index.ts has no equivalent
 * — this content is still static in the mock), but a CMS nobody can read
 * defeats the point of building one; added so a future frontend wiring has
 * something real to fetch instead of prebooze-web's hardcoded arrays. */
@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  async banners() {
    return this.prisma.banner.findMany({ where: { active: true }, orderBy: { sort: 'asc' } });
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

  async reels() {
    return this.prisma.reel.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } });
  }

  /** Guest-relevant slice of PlatformSettings only — payoutDay/autoPayout
   * stay admin-internal (organizer/promoter payout ops, nothing a guest
   * needs). bookingFee WAS excluded on the same "internal" theory, but that
   * was actually a bug: BookingsService already charges the real
   * bookingFee on every booking (see bookings.service.ts), so hiding the
   * number from the API while a guest's Checkout page showed a different
   * hardcoded estimate risked the two silently diverging. Exposing the
   * real number here is what lets Checkout.tsx show guests the actual fee
   * they'll be charged instead of a stale guess. No GST — Prebooze isn't
   * registered. */
  async platformInfo() {
    const s = await this.prisma.platformSettings.upsert({ where: { id: 'main' }, update: {}, create: { id: 'main' } });
    return {
      maintenanceMode: s.maintenanceMode, comingSoonMode: s.comingSoonMode, salesPaused: s.salesPaused, socials: s.socials, siteSeo: s.siteSeo, contact: s.contact,
      footerCopyright: s.footerCopyright, feeLabel: s.feeLabel, absorbedBy: s.absorbedBy,
      bookingFee: s.bookingFee, logoUrl: s.logoUrl, faviconUrl: s.faviconUrl,
    };
  }
}
