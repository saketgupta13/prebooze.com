import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';

const HOLD_TTL_MS = 8 * 60 * 1000; // matches HoldsService/OrganizerService — a cart still `active` past this is abandoned

@Injectable()
export class CartsService {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsappService,
    private email: EmailService,
  ) {}

  /** Platform-wide, across every organizer — distinct from
   * OrganizerService.remindCart(), which is scoped to one organizer's own
   * events. Admin oversight, same "closes the loop" reasoning as the rest
   * of this mega-domain. */
  async list(eventId?: string) {
    const carts = await this.prisma.cart.findMany({
      where: { status: 'active', ...(eventId ? { eventId } : {}) },
      include: { user: { select: { name: true, phone: true } }, event: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return carts.map((c) => ({
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
    const [open, completed] = await Promise.all([
      this.prisma.cart.findMany({ where: { status: 'active' }, select: { total: true } }),
      this.prisma.cart.findMany({ where: { status: 'completed' }, select: { total: true } }),
    ]);
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
    const cart = await this.prisma.cart.findUnique({ where: { id }, include: { user: true, event: true } });
    if (!cart) throw new NotFoundException('Cart not found');
    await this.prisma.cart.update({ where: { id }, data: { remindedAt: new Date() } });
    const eventUrl = `${process.env.WEB_APP_URL ?? ''}/events/${cart.event.slug}`;
    await this.wa
      .send(cart.user.phone, 'cart_reminder', [cart.user.name || 'there', cart.event.title, eventUrl])
      .catch(() => {});
    await this.email.sendTemplate(cart.user.email, 'cart_reminder', {
      name: cart.user.name, eventTitle: cart.event.title, eventUrl,
    }).catch(() => {});
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
    const carts = await this.prisma.cart.findMany({
      where: { status: 'active', remindedAt: null, createdAt: { lt: cutoff } },
      select: { id: true },
    });
    for (const c of carts) await this.remind(c.id).catch(() => {});
    return { sent: carts.length };
  }
}
