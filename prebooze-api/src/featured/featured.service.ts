import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { money } from '../notifications/email-templates';
import { InvoicesService } from '../invoices/invoices.service';
import { RazorpayService } from '../payments/razorpay.service';

/** Mirrors prebooze-web's FEATURED_PRICING (src/data/mock.ts). The typed
 * frontend contract (src/api/index.ts featured.rates()) omits venueMonthly
 * even though Featured.type includes 'venue' and the mock pricing table has
 * it — included here anyway since a venue partner requesting featured
 * placement needs a real rate, not a gap. Used only as the seed default now
 * — real rates live on PlatformSettings, admin-editable (Admin API
 * "featured rates" slice — this was flagged in this file's own comment as
 * "separate Admin API work" and left a hardcoded constant until now). */
const FALLBACK_RATES = { perEvent: 2000, organizerMonthly: 4999, promoterMonthly: 2999, lineupMonthly: 1999, venueMonthly: 3999 };

type FeaturedType = 'event' | 'organizer' | 'promoter' | 'lineup' | 'venue';

function monthFromNow(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

@Injectable()
export class FeaturedService {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsappService,
    private email: EmailService,
    private invoices: InvoicesService,
    private razorpay: RazorpayService,
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

  /** Creates the request AND a real Razorpay order for the amount owed —
   * the request stays `paid: false` until `confirmPayment` verifies a real
   * checkout signature; `adminApprove` refuses to approve an unpaid one.
   * Previously this only ever recorded a pending request with an invoice
   * nobody was ever actually charged for — same documented gap as Promoter
   * subscription used to be before real Razorpay billing landed there. */
  async request(userId: string, input: { type: FeaturedType; refId: string; billing: 'per_event' | 'monthly' }) {
    if (!input.type || !input.refId) throw new BadRequestException('type and refId are required');
    if (input.type === 'event' && input.billing !== 'per_event') throw new BadRequestException('Events are featured per-event, not monthly');
    if (input.type !== 'event' && input.billing !== 'monthly') throw new BadRequestException(`${input.type} can only be featured monthly`);

    const { city, expiresAt } = await this.resolveTarget(userId, input.type, input.refId);
    const rates = await this.rates();
    const amount = input.billing === 'per_event' ? rates.perEvent : rates[`${input.type}Monthly` as keyof typeof rates];

    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
    const gstPct = settings?.gstPct ?? 0;
    const gstAmount = Math.round((amount * gstPct) / 100);
    const total = amount + gstAmount;

    // matches the mock's requestFeatured: a fresh request replaces whatever
    // pending/active/expired record already existed for this exact item
    await this.prisma.featured.deleteMany({ where: { type: input.type as never, refId: input.refId } });
    let row = await this.prisma.featured.create({
      data: { type: input.type as never, refId: input.refId, city, billing: input.billing as never, amount, expiresAt },
    });

    const { orderId } = await this.razorpay.createOrder(total * 100, row.id);
    row = await this.prisma.featured.update({ where: { id: row.id }, data: { razorpayOrderId: orderId } });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const itemLabel = `${input.type} (${input.refId})`;
      await this.wa.send(user.phone, 'featured_submitted', [String(amount), itemLabel]).catch(() => {});
      await this.email.sendTemplate(user.email, 'featured_submitted', {
        name: user.name, amount: money(amount), itemLabel,
      }).catch(() => {});

      await this.invoices.create({
        type: 'featured', refId: row.id, role: input.type === 'event' ? 'organizer' : input.type,
        payerName: user.name, payerEmail: user.email, payerPhone: user.phone, city,
        description: `Featured placement — ${itemLabel}`,
        subtotal: amount, gstPct, gstAmount, total,
      }).catch(() => {});
    }

    return { ...row, razorpayOrder: { orderId, amount: total * 100, keyId: process.env.RAZORPAY_KEY_ID || undefined } };
  }

  /** Verifies the checkout-returned signature against the order created in
   * `request()` and marks the placement payable-for-review. Re-checks
   * ownership the same way `request()` did — Featured has no userId column
   * (refId + type is the only link back to an owner), so this is the only
   * way to confirm the caller confirming payment is the same one who made
   * the request. */
  async confirmPayment(userId: string, id: string, proof: { paymentId: string; signature: string }) {
    const row = await this.prisma.featured.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Featured request not found');
    await this.resolveTarget(userId, row.type as FeaturedType, row.refId); // throws if not the owner
    if (!row.razorpayOrderId) throw new BadRequestException('This request has no payment to confirm');
    if (row.paid) return row;

    const valid = this.razorpay.verifyPaymentSignature(row.razorpayOrderId, proof.paymentId, proof.signature);
    if (!valid) throw new BadRequestException('Payment verification failed');

    return this.prisma.featured.update({ where: { id }, data: { paid: true, paymentId: proof.paymentId } });
  }

  /** The caller's own current Featured row for this exact item, if any —
   * lets the frontend show real status (pending/active/expiresAt) instead
   * of a local guess. Reuses resolveTarget purely for its ownership check. */
  async mine(userId: string, type: FeaturedType, refId: string) {
    await this.resolveTarget(userId, type, refId);
    return this.prisma.featured.findFirst({ where: { type: type as never, refId } });
  }

  async rates() {
    const s = await this.prisma.platformSettings.upsert({ where: { id: 'main' }, update: {}, create: { id: 'main' } });
    return {
      perEvent: s.featuredPerEvent,
      organizerMonthly: s.featuredOrganizerMonthly,
      promoterMonthly: s.featuredPromoterMonthly,
      lineupMonthly: s.featuredLineupMonthly,
      venueMonthly: s.featuredVenueMonthly,
    };
  }

  async updateRates(body: Partial<typeof FALLBACK_RATES>) {
    const data: Record<string, number> = {};
    if (body.perEvent !== undefined) data.featuredPerEvent = body.perEvent;
    if (body.organizerMonthly !== undefined) data.featuredOrganizerMonthly = body.organizerMonthly;
    if (body.promoterMonthly !== undefined) data.featuredPromoterMonthly = body.promoterMonthly;
    if (body.lineupMonthly !== undefined) data.featuredLineupMonthly = body.lineupMonthly;
    if (body.venueMonthly !== undefined) data.featuredVenueMonthly = body.venueMonthly;
    await this.prisma.platformSettings.upsert({ where: { id: 'main' }, update: data, create: { id: 'main', ...data } });
    return this.rates();
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
    if (!row.paid) throw new BadRequestException('Cannot approve a featured request that hasn’t been paid for yet');
    return this.prisma.featured.update({ where: { id }, data: { status: 'active' } });
  }

  async adminReject(id: string) {
    const row = await this.prisma.featured.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Featured request not found');
    return this.prisma.featured.update({ where: { id }, data: { status: 'rejected' } });
  }

  /** Manual "remind" action for a lapsed placement (Admin > Featured >
   * Expired tab) — resolves whichever role actually owns `refId` (an event's
   * "owner" is its organizer, since events don't have their own login) and
   * sends the featured_expired_reminder template. Doesn't require `status`
   * to already be 'expired' — a manual reminder is still a reasonable admin
   * action on an about-to-expire active placement, not just a lapsed one. */
  async adminRemind(id: string) {
    const row = await this.prisma.featured.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Featured request not found');

    const target = await this.resolveOwnerAndLabel(row.type as FeaturedType, row.refId);
    if (!target?.email) throw new BadRequestException('No contact email on file for this placement’s owner');

    await this.email
      .sendTemplate(target.email, 'featured_expired_reminder', {
        name: target.name,
        itemLabel: target.itemLabel,
        expiredOn: row.expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      })
      .catch((err) => {
        throw new BadRequestException(`Reminder email failed to send: ${(err as Error).message}`);
      });

    return { ok: true, sentTo: target.email };
  }

  /** Automatic — called daily by CronService.featuredExpiringSoonTick.
   * Distinct from adminRemind above: this fires proactively on *active*
   * placements within 3 days of expiry (not yet lapsed), and only once per
   * placement (`expiryReminderSentAt` gates re-sends) rather than being a
   * manual, repeatable admin action. */
  async remindExpiringSoon(): Promise<{ remindedCount: number }> {
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.featured.findMany({
      where: { status: 'active', expiresAt: { lte: in3Days, gt: new Date() }, expiryReminderSentAt: null },
    });

    let remindedCount = 0;
    for (const row of rows) {
      const target = await this.resolveOwnerAndLabel(row.type as FeaturedType, row.refId);
      if (!target?.email) continue;
      await this.email
        .sendTemplate(target.email, 'featured_expiring_soon', {
          name: target.name,
          itemLabel: target.itemLabel,
          expiresOn: row.expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        })
        .catch(() => {});
      await this.prisma.featured.update({ where: { id: row.id }, data: { expiryReminderSentAt: new Date() } });
      remindedCount++;
    }
    return { remindedCount };
  }

  private async resolveOwnerAndLabel(type: FeaturedType, refId: string): Promise<{ email: string | null; name: string; itemLabel: string } | null> {
    if (type === 'event') {
      const event = await this.prisma.event.findUnique({ where: { id: refId }, include: { organizer: true } });
      if (!event) return null;
      const owner = event.organizer.userId ? await this.prisma.user.findUnique({ where: { id: event.organizer.userId } }) : null;
      return { email: owner?.email ?? null, name: event.organizer.brandName, itemLabel: event.title };
    }
    if (type === 'organizer') {
      const org = await this.prisma.organizer.findUnique({ where: { id: refId } });
      if (!org) return null;
      const owner = org.userId ? await this.prisma.user.findUnique({ where: { id: org.userId } }) : null;
      return { email: owner?.email ?? null, name: org.brandName, itemLabel: org.brandName };
    }
    if (type === 'promoter') {
      const p = await this.prisma.promoter.findFirst({ where: { OR: [{ id: refId }, { slug: refId }] } });
      if (!p) return null;
      const owner = p.userId ? await this.prisma.user.findUnique({ where: { id: p.userId } }) : null;
      return { email: owner?.email ?? null, name: p.name, itemLabel: p.name };
    }
    if (type === 'lineup') {
      const l = await this.prisma.lineup.findFirst({ where: { OR: [{ id: refId }, { slug: refId }] } });
      if (!l) return null;
      const owner = l.userId ? await this.prisma.user.findUnique({ where: { id: l.userId } }) : null;
      return { email: owner?.email ?? null, name: l.name, itemLabel: l.name };
    }
    // venue: linked in the reverse direction (User.venueId), no Venue.userId FK
    const venue = await this.prisma.venue.findUnique({ where: { id: refId } });
    if (!venue) return null;
    const owner = await this.prisma.user.findFirst({ where: { venueId: refId } });
    return { email: owner?.email ?? null, name: venue.name, itemLabel: venue.name };
  }
}
