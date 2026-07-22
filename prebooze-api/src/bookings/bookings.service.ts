import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import type { Prisma, Booking } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { HoldsService } from './holds.service';
import { RazorpayService } from '../payments/razorpay.service';
import { WhatsappService } from '../notifications/whatsapp';
import { REFERRAL_REFERRER_REWARD } from '../referrals/referral.constants';
import { NotificationsService } from '../admin/notifications.service';

const FALLBACK_FEE_PER_TICKET = 1.5; // ₹ — used only if PlatformSettings row is somehow missing

export interface CreateBookingInput {
  holdId: string;
  mainGuest: string;
  whatsapp: string;
  guests?: { name: string; gender?: string; whatsapp?: string }[]; // extra guests beyond the main one
  couponCode?: string;
  walletCredit?: number; // ₹ the user wants to apply from their balance
  promoterRef?: string;
  payMethodId?: string; // saved card/UPI used at checkout — becomes the default
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
    private notifications: NotificationsService,
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

    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
    if (settings?.maintenanceMode) throw new BadRequestException('Prebooze is temporarily down for maintenance — please check back shortly');
    if (settings?.salesPaused) throw new BadRequestException('Ticket sales are currently paused platform-wide');
    if (event.salesPaused) throw new BadRequestException('Ticket sales are currently paused for this event');

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
    const fee = Math.round(qty * (settings?.bookingFee ?? FALLBACK_FEE_PER_TICKET));

    // ---- coupon ----
    let discount = 0;
    let couponRow = null as Awaited<ReturnType<typeof this.prisma.coupon.findUnique>>;
    if (couponCode) {
      couponRow = await this.prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
      if (!couponRow) throw new BadRequestException('Invalid coupon code');
      if (couponRow.status !== 'active') throw new BadRequestException('This coupon is no longer active');
      if (couponRow.validTill < new Date()) throw new BadRequestException('This coupon has expired');
      // an organizer's own coupon only ever applies to their events — "all"
      // scopes to all of *that organizer's* events, not the whole platform
      if (couponRow.organizerId && couponRow.organizerId !== event.organizerId) {
        throw new BadRequestException('This coupon does not apply to this event');
      }
      if (couponRow.eventScope !== 'all' && couponRow.eventScope !== event.title) {
        throw new BadRequestException('This coupon does not apply to this event');
      }
      if (couponRow.gender !== 'all') {
        const buyer = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (buyer.gender.toLowerCase() !== couponRow.gender.toLowerCase()) {
          throw new BadRequestException('This promo code is not available for your profile');
        }
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
    const buyer = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (buyer.blocked) throw new ForbiddenException('This account is blocked from booking — contact support');

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

      // abandoned-cart recovery: this hold converted, so it's no longer a cart to nudge
      await tx.cart.updateMany({ where: { holdId: input.holdId }, data: { status: 'completed' } });

      // organizer earnings ledger — credited the ticket subtotal, not the
      // booking fee (that's platform revenue); no commission/take-rate
      // modeled yet, see OrganizerLedgerTx in schema.prisma
      await tx.organizerLedgerTx.create({
        data: { organizerId: event.organizerId, type: 'sale', amount: subtotal, eventId: event.id, eventTitle: event.title, note: `Booking ${id}` },
      });

      // platform's own finance ledger (Admin API finance ledger slice) —
      // the booking fee IS the platform's revenue, auto-posted so finance
      // staff see real numbers instead of an empty manual scratchpad
      if (fee > 0) {
        await tx.ledgerEntry.create({
          data: { kind: 'income', category: 'Booking fees', amount: fee, note: `Booking ${id}`, auto: true },
        });
      }

      // paying with a saved method sets it default
      if (input.payMethodId) {
        const method = await tx.payMethod.findUnique({ where: { id: input.payMethodId } });
        if (method && method.userId === userId && !method.isDefault) {
          await tx.payMethod.updateMany({ where: { userId }, data: { isDefault: false } });
          await tx.payMethod.update({ where: { id: input.payMethodId }, data: { isDefault: true } });
        }
      }
    });

    await this.holds.release(input.holdId);

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.wa.send(input.whatsapp, 'booking_confirmed', [input.mainGuest.trim(), event.title, String(qty), id, String(total)]).catch(() => {});

    // ---- referral qualification: referee's first paid booking rewards the referrer ----
    const referral = await this.prisma.referral.findUnique({ where: { refereeId: userId } });
    if (referral && referral.status === 'joined') {
      const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
      const reward = settings?.referralReferrer ?? REFERRAL_REFERRER_REWARD;
      await this.prisma.$transaction([
        this.prisma.referral.update({ where: { id: referral.id }, data: { status: 'qualified' } }),
        this.prisma.walletTx.create({
          data: {
            userId: referral.referrerId,
            type: 'referral_reward',
            amount: reward,
            note: `Referral reward — ${user.name || 'your friend'} made their first booking`,
          },
        }),
      ]);
      const referrer = await this.prisma.user.findUnique({ where: { id: referral.referrerId } });
      if (referrer) await this.wa.send(referrer.phone, 'referral_reward', [String(reward), user.name || 'Your friend']).catch(() => {});
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

  /** Wallet refunds stay instant (low-risk, reversible, in-house money) —
   * unchanged from the original design. Refunds to the original payment
   * source now require admin sign-off first (BACKEND.md "Admin API" —
   * bookings/refunds/customers slice): this only records the request and
   * flips the booking to `refund_requested`. Nothing about the sale is
   * undone yet — inventory, the organizer's ledger, and the waitlist all
   * stay untouched until an admin actually approves, so a decline can put
   * the booking back exactly as it was with nothing to unwind. */
  async cancel(userId: string, id: string, refundTo: 'wallet' | 'source') {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) throw new ForbiddenException();
    if (booking.status !== 'confirmed') throw new BadRequestException('This booking is not eligible for refund');

    if (refundTo === 'source') {
      await this.prisma.booking.update({ where: { id }, data: { status: 'refund_requested', refundedTo: 'source' } });
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      await this.wa.send(user.phone, 'refund_requested', [id, String(booking.total)]).catch(() => {});
      await this.notifications.notify('↩', `Refund requested — booking ${id} · ₹${booking.total}`, '/admin/bookings?status=refund_requested');
      return this.prisma.booking.findUniqueOrThrow({ where: { id } });
    }

    return this.finalizeRefund(booking, 'wallet');
  }

  /** Staff-only — see AdminBookingsController. Actually moves the money:
   * inventory restore, organizer ledger reversal, the real Razorpay refund
   * call, and the FIFO waitlist offer all happen here, not at request time. */
  async adminApproveRefund(id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'refund_requested') throw new BadRequestException('This booking has no pending refund request');
    return this.finalizeRefund(booking, 'source');
  }

  /** Staff-only. Nothing was touched at request time, so declining is just
   * reverting the status — matches the mock's resolveRefund(false) exactly. */
  async adminDeclineRefund(id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'refund_requested') throw new BadRequestException('This booking has no pending refund request');
    return this.prisma.booking.update({ where: { id }, data: { status: 'confirmed', refundedTo: null } });
  }

  private async finalizeRefund(booking: Booking, refundTo: 'wallet' | 'source') {
    const { id, userId } = booking;

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

      // reverse the organizer's earnings credit from the original sale
      const event = await tx.event.findUnique({ where: { id: booking.eventId }, select: { organizerId: true, title: true } });
      if (event) {
        await tx.organizerLedgerTx.create({
          data: { organizerId: event.organizerId, type: 'refund', amount: -booking.subtotal, eventId: booking.eventId, eventTitle: event.title, note: `Refund — booking ${id}` },
        });
      }

      // reverse the platform's own "Booking fees" income the same way —
      // the refund gives back booking.total in full, fee included
      if (booking.fee > 0) {
        await tx.ledgerEntry.create({
          data: { kind: 'expense', category: 'Refund losses', amount: booking.fee, note: `Refund — booking ${id}`, auto: true },
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

  // ---------- admin: bookings list/detail ----------
  async adminList(status?: string) {
    return this.prisma.booking.findMany({
      where: status ? { status: status as never } : undefined,
      include: { user: { select: { name: true, phone: true } }, event: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminGet(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { user: { select: { name: true, phone: true } }, event: { include: { venue: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async checkIn(qrToken: string) {
    let payload: { bookingId: string };
    try {
      payload = await this.jwt.verifyAsync(qrToken);
    } catch {
      await this.logCheckIn({ ok: false, reason: 'invalid or expired QR' });
      throw new BadRequestException('Invalid or expired ticket QR');
    }
    const booking = await this.prisma.booking.findUnique({ where: { id: payload.bookingId } });
    if (!booking) {
      await this.logCheckIn({ ok: false, reason: 'invalid QR — booking not found' });
      throw new NotFoundException('Booking not found');
    }
    if (booking.status !== 'confirmed') {
      await this.logCheckIn({ ok: false, reason: `ticket is ${booking.status}, not valid for entry`, eventId: booking.eventId, bookingId: booking.id, guestName: booking.mainGuest, tierName: booking.tierName });
      throw new BadRequestException(`Ticket is ${booking.status}, not valid for entry`);
    }
    if (booking.checkedIn) {
      await this.logCheckIn({ ok: false, reason: `duplicate QR — already scanned ${booking.checkedInAt?.toISOString()}`, eventId: booking.eventId, bookingId: booking.id, guestName: booking.mainGuest, tierName: booking.tierName });
      throw new BadRequestException('Already checked in — ' + booking.checkedInAt?.toISOString());
    }

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { checkedIn: true, checkedInAt: new Date() },
    });
    await this.logCheckIn({ ok: true, reason: 'checked in', eventId: booking.eventId, bookingId: booking.id, guestName: booking.mainGuest, tierName: booking.tierName, headcount: booking.qty });
    return updated;
  }

  /** Feeds the admin Live Monitor's gate feed + "rejected QRs" KPI — written
   * on every branch above, success or rejection, so that page has something
   * real to read instead of the mock's simulated setInterval feed. Never
   * blocks the actual check-in on a logging failure. */
  private async logCheckIn(data: { ok: boolean; reason: string; eventId?: string; bookingId?: string; guestName?: string; tierName?: string; headcount?: number }) {
    await this.prisma.checkInLog
      .create({ data: { ok: data.ok, reason: data.reason, eventId: data.eventId, bookingId: data.bookingId, guestName: data.guestName, tierName: data.tierName, headcount: data.headcount ?? 1 } })
      .catch(() => {});
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
