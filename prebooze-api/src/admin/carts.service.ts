import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';

@Injectable()
export class CartsService {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsappService,
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

  async remind(id: string) {
    const cart = await this.prisma.cart.findUnique({ where: { id }, include: { user: true, event: true } });
    if (!cart) throw new NotFoundException('Cart not found');
    await this.prisma.cart.update({ where: { id }, data: { remindedAt: new Date() } });
    await this.wa
      .send(cart.user.phone, 'cart_reminder', [cart.user.name || 'there', cart.event.title, `${process.env.WEB_APP_URL ?? ''}/events/${cart.event.slug}`])
      .catch(() => {});
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
}
