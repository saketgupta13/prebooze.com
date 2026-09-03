import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { toCitySlug } from '../common/city-slug';

const HOLD_TTL_MS = 8 * 60 * 1000; // matches HoldsService/OrganizerService — a cart still `active` past this is abandoned

// Real phone numbers the team itself uses for testing (OTP checks, booking
// flow QA, etc.) — never real guests, so they shouldn't ever get a real
// "you forgot your cart" WhatsApp/email. Exact strings match normalizePhone's
// output shape ("+91 XXXXXXXXXX").
const TEST_PHONE_NUMBERS = ['+91 9579573727', '+91 8788003601'];

// Same formula as CatalogService.isEventOver — a cart for an event that's
// already finished isn't a recoverable abandonment, there's nothing left
// to nudge the guest back to book.
function isEventOver(e: { date: Date; durationHrs: number }): boolean {
  return new Date(e.date.getTime() + e.durationHrs * 3600000) < new Date();
}

@Injectable()
export class CartsService {
  private readonly log = new Logger('Carts');

  constructor(
    private prisma: PrismaService,
    private wa: WhatsappService,
    private email: EmailService,
  ) {}

  /** Platform-wide, across every organizer — distinct from
   * OrganizerService.remindCart(), which is scoped to one organizer's own
   * events. Admin oversight, same "closes the loop" reasoning as the rest
   * of this mega-domain. */
  /** `past` splits the same underlying list into two tabs on the admin
   * side — a cart for an event that's already happened isn't actionable
   * the way a current one is (nothing left to nudge the guest back to),
   * but it's still worth being able to look at rather than only ever
   * hard-deleting it from view. */
  async list(eventId?: string, past = false) {
    // Fetched unfiltered by status (unlike below) so the dedupe can see a
    // later 'completed' attempt and correctly drop an earlier stale 'active'
    // one for the same user+event — a guest who retried and paid the second
    // time must not still show as abandoned just because their first hold
    // never got its own status flipped (same fix as OrganizerService.carts,
    // which this admin view never had — a guest showed up in both Bookings
    // and Abandoned carts here because of the gap).
    const rows = await this.prisma.cart.findMany({
      where: { user: { phone: { notIn: TEST_PHONE_NUMBERS } }, ...(eventId ? { eventId } : {}) },
      include: { user: { select: { name: true, phone: true } }, event: { select: { title: true, date: true, durationHrs: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const seen = new Set<string>();
    const carts: typeof rows = [];
    for (const c of rows) {
      const key = `${c.userId}:${c.eventId}`;
      if (seen.has(key)) continue; // only the latest attempt per user+event counts
      seen.add(key);
      if (c.status === 'active') carts.push(c);
    }
    return carts.filter((c) => isEventOver(c.event) === past).map((c) => ({
      id: c.id,
      guest: c.user.name || c.user.phone,
      phone: c.user.phone,
      eventId: c.eventId,
      eventTitle: c.event.title,
      qtyMap: c.qtyMap,
      amount: c.total,
      reminded: !!c.remindedAt,
      createdAt: c.createdAt,
    }));
  }

  /** Recovery KPIs — "recovered" means the cart's hold converted into a real
   * booking (BookingsService.create flips status to 'completed'); there's
   * no separate "abandoned" status, every non-completed cart is still live. */
  async stats() {
    // Same latest-attempt-per-user+event dedupe as list() — otherwise a
    // guest's stale first (unconverted) attempt inflates openCount/drags
    // down the recovery rate even though their later attempt completed.
    const rows = await this.prisma.cart.findMany({
      where: { user: { phone: { notIn: TEST_PHONE_NUMBERS } } },
      select: { userId: true, eventId: true, status: true, total: true, createdAt: true, event: { select: { date: true, durationHrs: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const seen = new Set<string>();
    const latest: typeof rows = [];
    for (const c of rows) {
      const key = `${c.userId}:${c.eventId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      latest.push(c);
    }
    const open = latest.filter((c) => c.status === 'active' && !isEventOver(c.event));
    const completed = latest.filter((c) => c.status === 'completed');
    const recoverable = open.reduce((a, c) => a + c.total, 0);
    const recoveredValue = completed.reduce((a, c) => a + c.total, 0);
    const totalSeen = open.length + completed.length;
    return {
      openCount: open.length,
      recoverable,
      recoveredCount: completed.length,
      recoveredValue,
      recoveryRate: totalSeen ? Math.round((completed.length / totalSeen) * 100) : 0,
    };
  }

  async remind(id: string) {
    const cart = await this.prisma.cart.findUnique({ where: { id }, include: { user: true, event: { include: { venue: true } } } });
    if (!cart) throw new NotFoundException('Cart not found');
    await this.prisma.cart.update({ where: { id }, data: { remindedAt: new Date() } });
    const city = cart.event.venue?.city ?? cart.event.privateCity;
    const eventUrl = `${process.env.WEB_APP_URL ?? ''}${city ? `/${toCitySlug(city)}` : ''}/events/${cart.event.slug}`;
    // remindedAt above is set unconditionally (never re-nudge the same cart
    // even if this send fails) — that means a failure here is otherwise
    // invisible with no way to retry, so it's worth a clear log line rather
    // than the silent .catch(() => {}) this used to be.
    await this.wa
      .send(cart.user.phone, 'cart_reminder', [cart.user.name || 'there', cart.event.title, eventUrl])
      .catch((err) => this.log.warn(`Cart reminder WhatsApp to cart ${id} failed: ${(err as Error).message}`));
    await this.email.sendTemplate(cart.user.email, 'cart_reminder', {
      name: cart.user.name, eventTitle: cart.event.title, eventUrl,
    }).catch((err) => this.log.warn(`Cart reminder email to cart ${id} failed: ${(err as Error).message}`));
    return { ok: true };
  }

  async bulkRemind(ids: string[]) {
    let count = 0;
    for (const id of ids) {
      await this.remind(id).catch(() => {});
      count++;
    }
    return { ok: true, count };
  }

  /** Automated counterpart to remind()/bulkRemind() above — those are
   * human-triggered (an admin or organizer clicking a button); this is the
   * platform proactively recovering a guest who verified OTP, held a
   * ticket, and then just never finished — the single biggest drop-off
   * point in the whole booking funnel. Only fires once the hold has
   * actually expired (never nudges someone mid-checkout) and only once per
   * cart (remindedAt gate, same as the manual paths — a guest who already
   * got a manual reminder isn't double-nudged). Driven by CronService. */
  async sendAutoNudges() {
    const cutoff = new Date(Date.now() - HOLD_TTL_MS);
    const candidates = await this.prisma.cart.findMany({
      where: { status: 'active', remindedAt: null, createdAt: { lt: cutoff }, user: { phone: { notIn: TEST_PHONE_NUMBERS } } },
      select: { id: true, userId: true, eventId: true, createdAt: true, event: { select: { date: true, durationHrs: true } } },
    });
    // A candidate can be a stale first attempt that a later hold for the
    // same user+event superseded — including one that already converted to
    // a real booking. Without this check a guest who already paid could get
    // (and, confirmed, did get) a "you forgot your cart" nudge for a cart
    // they'd already completed via a second attempt.
    const superseded = candidates.length
      ? new Set(
          (
            await this.prisma.cart.findMany({
              where: { OR: candidates.map((c) => ({ userId: c.userId, eventId: c.eventId, createdAt: { gt: c.createdAt } })) },
              select: { userId: true, eventId: true },
            })
          ).map((c) => `${c.userId}:${c.eventId}`),
        )
      : new Set<string>();
    // No point nudging a guest back to book an event that's already over.
    const carts = candidates.filter((c) => !superseded.has(`${c.userId}:${c.eventId}`) && !isEventOver(c.event));
    for (const c of carts) {
      await this.remind(c.id).catch((err) => this.log.warn(`Auto-nudge for cart ${c.id} failed: ${(err as Error).message}`));
    }
    return { sent: carts.length };
  }
}
