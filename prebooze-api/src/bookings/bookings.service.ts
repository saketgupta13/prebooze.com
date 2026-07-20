import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { HoldsService } from './holds.service';
import { RazorpayService } from '../payments/razorpay.service';
import { WhatsappService } from '../notifications/whatsapp';

const FEE_PER_TICKET = 1.5; // ₹, matches prebooze-web's BOOKING_FEE_PER_TICKET
const REFERRAL_REWARD = 100; // ₹, matches prebooze-web's REFERRAL_CONFIG.referrer

export interface CreateBookingInput {
  holdId: string;
  mainGuest: string;
  whatsapp: string;
  guests?: { name: string; gender?: string; whatsapp?: string }[]; // extra guests beyond the main one
  couponCode?: string;
  walletCredit?: number; // ₹ the user wants to apply from their balance
  promoterRef?: string;
  razorpay?: { orderId: string; paymentId: string; signature: string };
}

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private holds: HoldsService,
    private razorpay: RazorpayService,
    private jwt: JwtService,
    private wa: WhatsappService,
  ) {}

  async createHold(userId: string, eventId: string, qty: Record<string, number>) {
    return this.holds.create(userId, eventId, qty);
  }

  /** Shared by quote() and create() — never trust a client-supplied amount,
   * always re-derive pricing server-side from the hold + live coupon/wallet state. */
  private async priceHold(userId: string, holdId: string, couponCode?: string, requestedWalletCredit?: number) {
    const hold = await this.holds.get(holdId);
    if (hold.userId !== userId) throw new ForbiddenException('This hold belongs to a different session');

    const event = await this.prisma.event.findUnique({ where: { id: hold.eventId }, include: { tiers: true } });
    if (!event) throw new NotFoundException('Event not found');

    const lines = Object.entries(hold.qty)
      .filter(([, n]) => n > 0)
      .map(([tierId, n]) => {
        const tier = event.tiers.find((t) => t.id === tierId);
        if (!tier) throw new BadRequestException(`Unknown ticket tier ${tierId}`);
        return { tier, qty: n };
      });
    if (!lines.length) throw new BadRequestException('No tickets selected');

    const qty = lines.reduce((a, l) => a + l.qty, 0);
    const subtotal = lines.reduce((a, l) => a + l.qty * l.tier.price, 0);
    const fee = Math.round(qty * FEE_PER_TICKET);

    // ---- coupon ----
    let discount = 0;
    let couponRow = null as Awaited<ReturnType<typeof this.prisma.coupon.findUnique>>;
    if (couponCode) {
      couponRow = await this.prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
      if (!couponRow) throw new BadRequestException('Invalid coupon code');
      if (couponRow.status !== 'active') throw new BadRequestException('This coupon is no longer active');
      if (couponRow.validTill < new Date()) throw new BadRequestException('This coupon has expired');
      if (couponRow.eventScope !== 'all' && couponRow.eventScope !== event.title) {
        throw new BadRequestException('This coupon does not apply to this event');
      }
      if (couponRow.used >= couponRow.usageLimit) throw new BadRequestException('This coupon has been fully redeemed');
      const raw = couponRow.type === 'percent' ? (subtotal * couponRow.value) / 100 : couponRow.value;
      discount = Math.min(Math.round(raw), couponRow.maxDiscount ?? raw, subtotal);
    }

    // ---- wallet credit ----
    const balance = await this.walletBalance(userId);
    const requestedCredit = Math.max(0, requestedWalletCredit ?? 0);
    const walletCreditUsed = Math.min(requestedCredit, balance, Math.max(0, subtotal + fee - discount));

    const total = subtotal + fee - discount - walletCreditUsed;
    return { hold, event, lines, qty, subtotal, fee, discount, couponRow, walletCreditUsed, total };
  }

  /** Called before showing the Razorpay checkout widget — creates the order
   * with the *final* (post-coupon, post-wallet-credit) amount, since Razorpay
   * requires the order amount to match what's actually charged. */
  async quote(userId: string, holdId: string, couponCode?: string, walletCredit?: number) {
    const p = await this.priceHold(userId, holdId, couponCode, walletCredit);
    const order = p.total > 0 ? await this.razorpay.createOrder(p.total * 100, holdId) : null;
    return {
      subtotal: p.subtotal, fee: p.fee, discount: p.discount, walletCreditUsed: p.walletCreditUsed, total: p.total,
      razorpayOrderId: order?.orderId,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || undefined,
    };
  }

  async create(userId: string, input: CreateBookingInput) {
    const { event, lines, qty, subtotal, fee, discount, couponRow, walletCreditUsed, total } =
      await this.priceHold(userId, input.holdId, input.couponCode, input.walletCredit);

    // ---- payment ----
    let paymentId: string | null = null;
    if (total > 0) {
      if (input.razorpay) {
        const ok = this.razorpay.verifyPaymentSignature(input.razorpay.orderId, input.razorpay.paymentId, input.razorpay.signature);
        if (!ok) throw new BadRequestException('Payment verification failed');
        paymentId = input.razorpay.paymentId;
      } else if (!this.razorpay.live) {
        // dev convenience: simulate a completed payment so the flow is curl-testable
        paymentId = this.razorpay.devFakePaymentId();
      } else {
        throw new BadRequestException('Payment is required to complete this booking');
      }
    }

    const id = '#TKT-' + randomInt(10000, 99999);
    const guests = [
      { name: input.mainGuest.trim(), checkedIn: false },
      ...(input.guests ?? []).map((g) => ({ name: g.name.trim(), checkedIn: false, gender: g.gender, whatsapp: g.whatsapp })),
    ];
    const tierBreakdown = Object.fromEntries(lines.map((l) => [l.tier.id, l.qty]));
    const qrToken = await this.jwt.signAsync({ bookingId: id }, { expiresIn: '30d' });

    // ---- atomic: guard against overselling, write booking + debit wallet + bump coupon use ----
    await this.prisma.$transaction(async (tx) => {
      for (const l of lines) {
        const res = await tx.ticketTier.updateMany({
          where: { id: l.tier.id, sold: { lte: l.tier.quantity - l.qty } },
          data: { sold: { increment: l.qty } },
        });
        if (res.count === 0) throw new BadRequestException(`"${l.tier.name}" sold out while you were checking out`);
      }

      await tx.booking.create({
        data: {
          id,
          userId,
          eventId: event.id,
          tierName: lines.map((l) => `${l.qty}× ${l.tier.name}`).join(', '),
          tierBreakdown: tierBreakdown as Prisma.InputJsonValue,
          qty,
          subtotal,
          fee,
          discount,
          total,
          couponCode: couponRow?.code,
          guests: guests as unknown as Prisma.InputJsonValue,
          mainGuest: input.mainGuest.trim(),
          whatsapp: input.whatsapp.trim(),
          promoterRef: input.promoterRef,
          walletCreditUsed,
          paymentId: paymentId ?? undefined,
          qrToken,
        },
      });

      if (walletCreditUsed > 0) {
        await tx.walletTx.create({
          data: { userId, type: 'spend', amount: -walletCreditUsed, note: `Paid at checkout — ${id}` },
        });
      }
      if (couponRow) {
        await tx.coupon.update({ where: { id: couponRow.id }, data: { used: { increment: 1 } } });
      }
    });

    await this.holds.release(input.holdId);

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.wa.send(input.whatsapp, 'booking_confirmed', [input.mainGuest.trim(), event.title, String(qty), id, String(total)]).catch(() => {});

    // ---- referral qualification: referee's first paid booking rewards the referrer ----
    const referral = await this.prisma.referral.findUnique({ where: { refereeId: userId } });
    if (referral && referral.status === 'joined') {
      await this.prisma.$transaction([
        this.prisma.referral.update({ where: { id: referral.id }, data: { status: 'qualified' } }),
        this.prisma.walletTx.create({
          data: {
            userId: referral.referrerId,
            type: 'referral_reward',
            amount: REFERRAL_REWARD,
            note: `Referral reward — ${user.name || 'your friend'} made their first booking`,
          },
        }),
      ]);
      const referrer = await this.prisma.user.findUnique({ where: { id: referral.referrerId } });
      if (referrer) await this.wa.send(referrer.phone, 'referral_reward', [String(REFERRAL_REWARD), user.name || 'Your friend']).catch(() => {});
    }

    return this.prisma.booking.findUniqueOrThrow({ where: { id }, include: { event: { include: { venue: true } } } });
  }

  async list(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: { event: { include: { venue: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancel(userId: string, id: string, refundTo: 'wallet' | 'source') {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) throw new ForbiddenException();
    if (booking.status !== 'confirmed') throw new BadRequestException('This booking is not eligible for refund');

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id }, data: { status: 'refunded', refundedTo: refundTo } });

      // restore inventory per tier so the freed spot is real, not just cosmetic
      const breakdown = booking.tierBreakdown as Record<string, number>;
      for (const [tierId, n] of Object.entries(breakdown)) {
        await tx.ticketTier.update({ where: { id: tierId }, data: { sold: { decrement: n } } });
      }

      if (refundTo === 'wallet') {
        await tx.walletTx.create({
          data: { userId, type: 'refund', amount: booking.total, note: `Instant refund — booking ${id}` },
        });
      }
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (refundTo === 'wallet') {
      await this.wa.send(user.phone, 'refund_wallet', [id, String(booking.total)]).catch(() => {});
    } else {
      if (booking.paymentId) await this.razorpay.refund(booking.paymentId, booking.total * 100).catch(() => {});
      await this.wa.send(user.phone, 'refund_source', [id, String(booking.total)]).catch(() => {});
    }

    // FIFO: offer the freed spot to the first person still waiting
    const next = await this.prisma.waitlistEntry.findFirst({
      where: { eventId: booking.eventId, status: 'waiting' },
      orderBy: { joinedAt: 'asc' },
    });
    if (next) {
      await this.prisma.waitlistEntry.update({ where: { id: next.id }, data: { status: 'offered' } });
      const [waiter, event] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: next.userId } }),
        this.prisma.event.findUnique({ where: { id: booking.eventId } }),
      ]);
      if (waiter && event) await this.wa.send(waiter.phone, 'waitlist_offer', [waiter.name || 'there', event.title, `${process.env.WEB_APP_URL ?? ''}/events/${event.slug}`]).catch(() => {});
    }

    return this.prisma.booking.findUniqueOrThrow({ where: { id } });
  }

  async checkIn(qrToken: string) {
    let payload: { bookingId: string };
    try {
      payload = await this.jwt.verifyAsync(qrToken);
    } catch {
      throw new BadRequestException('Invalid or expired ticket QR');
    }
    const booking = await this.prisma.booking.findUnique({ where: { id: payload.bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'confirmed') throw new BadRequestException(`Ticket is ${booking.status}, not valid for entry`);
    if (booking.checkedIn) throw new BadRequestException('Already checked in — ' + booking.checkedInAt?.toISOString());

    return this.prisma.booking.update({
      where: { id: booking.id },
      data: { checkedIn: true, checkedInAt: new Date() },
    });
  }

  // ---------- waitlist ----------
  async joinWaitlist(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const existing = await this.prisma.waitlistEntry.findUnique({ where: { eventId_userId: { eventId, userId } } });
    if (existing) return existing;
    return this.prisma.waitlistEntry.create({ data: { eventId, userId } });
  }

  async waitlist(eventId: string) {
    return this.prisma.waitlistEntry.findMany({ where: { eventId }, orderBy: { joinedAt: 'asc' } });
  }

  private async walletBalance(userId: string): Promise<number> {
    const agg = await this.prisma.walletTx.aggregate({ where: { userId }, _sum: { amount: true } });
    return agg._sum.amount ?? 0;
  }
}
