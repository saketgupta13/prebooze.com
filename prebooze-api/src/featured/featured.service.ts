import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';

/** Mirrors prebooze-web's FEATURED_PRICING (src/data/mock.ts). The typed
 * frontend contract (src/api/index.ts featured.rates()) omits venueMonthly
 * even though Featured.type includes 'venue' and the mock pricing table has
 * it — included here anyway since a venue partner requesting featured
 * placement needs a real rate, not a gap. */
const RATES = { perEvent: 2000, organizerMonthly: 4999, promoterMonthly: 2999, lineupMonthly: 1999, venueMonthly: 3999 };

type FeaturedType = 'event' | 'organizer' | 'promoter' | 'lineup' | 'venue';

function monthFromNow(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

@Injectable()
export class FeaturedService {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsappService,
  ) {}

  /** Resolves ownership + the server-trusted city/expiry for a request —
   * never the client's. Throws ForbiddenException if the caller doesn't
   * actually own refId. */
  private async resolveTarget(userId: string, type: FeaturedType, refId: string): Promise<{ city: string; expiresAt: Date }> {
    switch (type) {
      case 'event': {
        const org = await this.prisma.organizer.findUnique({ where: { userId } });
        const event = await this.prisma.event.findUnique({ where: { id: refId }, include: { venue: true } });
        if (!org || !event || event.organizerId !== org.id) throw new ForbiddenException();
        return { city: event.venue.city, expiresAt: event.date };
      }
      case 'organizer': {
        const org = await this.prisma.organizer.findUnique({ where: { userId } });
        if (!org || org.id !== refId) throw new ForbiddenException();
        return { city: org.city, expiresAt: monthFromNow() };
      }
      case 'promoter': {
        const p = await this.prisma.promoter.findUnique({ where: { userId } });
        if (!p || p.slug !== refId) throw new ForbiddenException();
        return { city: p.city, expiresAt: monthFromNow() };
      }
      case 'lineup': {
        const l = await this.prisma.lineup.findUnique({ where: { userId } });
        if (!l || l.slug !== refId) throw new ForbiddenException();
        return { city: l.city, expiresAt: monthFromNow() };
      }
      case 'venue': {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user?.venueId || user.venueId !== refId) throw new ForbiddenException();
        const venue = await this.prisma.venue.findUnique({ where: { id: refId } });
        if (!venue) throw new NotFoundException();
        return { city: venue.city, expiresAt: monthFromNow() };
      }
      default:
        throw new BadRequestException('Unknown featured type');
    }
  }

  /** No billing is wired up here — same documented gap as Promoter
   * subscription (Phase 7). The frontend's typed contract
   * (`featured.request(input: Omit<Featured,'id'|'status'|'createdAt'>)`)
   * has no room for a Razorpay order/confirmation, unlike bookings' two-step
   * quote()/create() — so unlike bookings, there's no payment to verify or
   * simulate here, just a pending request recorded for admin review. */
  async request(userId: string, input: { type: FeaturedType; refId: string; billing: 'per_event' | 'monthly' }) {
    if (!input.type || !input.refId) throw new BadRequestException('type and refId are required');
    if (input.type === 'event' && input.billing !== 'per_event') throw new BadRequestException('Events are featured per-event, not monthly');
    if (input.type !== 'event' && input.billing !== 'monthly') throw new BadRequestException(`${input.type} can only be featured monthly`);

    const { city, expiresAt } = await this.resolveTarget(userId, input.type, input.refId);
    const amount = input.billing === 'per_event' ? RATES.perEvent : RATES[`${input.type}Monthly` as keyof typeof RATES];

    // matches the mock's requestFeatured: a fresh request replaces whatever
    // pending/active/expired record already existed for this exact item
    await this.prisma.featured.deleteMany({ where: { type: input.type as never, refId: input.refId } });
    const row = await this.prisma.featured.create({
      data: { type: input.type as never, refId: input.refId, city, billing: input.billing as never, amount, expiresAt },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) await this.wa.send(user.phone, 'featured_submitted', [String(amount), `${input.type} (${input.refId})`]).catch(() => {});

    return row;
  }

  rates() {
    return RATES;
  }

  // ---------- admin: minimal review queue, same pattern as /admin/events ----------
  async listForAdmin(status?: string) {
    return this.prisma.featured.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'asc' },
    });
  }

  async adminApprove(id: string) {
    const row = await this.prisma.featured.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Featured request not found');
    return this.prisma.featured.update({ where: { id }, data: { status: 'active' } });
  }

  async adminReject(id: string) {
    const row = await this.prisma.featured.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Featured request not found');
    return this.prisma.featured.update({ where: { id }, data: { status: 'rejected' } });
  }
}
