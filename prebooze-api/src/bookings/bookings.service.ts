import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import type { Prisma, Booking } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { HoldsService } from './holds.service';
import { RazorpayService } from '../payments/razorpay.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { money } from '../notifications/email-templates';
import { REFERRAL_REFERRER_REWARD, referralCodeFor } from '../referrals/referral.constants';
import { NotificationsService } from '../admin/notifications.service';
import { InvoicesService } from '../invoices/invoices.service';
import { normalizePhone } from '../auth/auth.service';
import { StaffAlertsService } from '../notifications/staff-alerts';

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
    private email: EmailService,
    private notifications: NotificationsService,
    private invoices: InvoicesService,
    private staffAlerts: StaffAlertsService,
  ) {}

  async createHold(userId: string, eventId: string, qty: Record<string, number>) {
    return this.holds.create(userId, eventId, qty);
  }

  /** Event.commission (admin's "Event commission (per event)" setting) —
   * null/unset by default, so this is 0 for every event nobody's explicitly
   * opted into a platform cut on. */
  private commissionFor(subtotal: number, commissionPct: number | null): number {
    return commissionPct ? Math.round((subtotal * commissionPct) / 100) : 0;
  }

  /** One running total per (event, category) instead of a fresh row per
   * ticket sold — the finance ledger used to get a new "Booking fees" line
   * for every single booking, which buried real activity in noise instead
   * of showing what an event actually earned the platform. eventId+category
   * has a real unique index (see LedgerEntry in schema.prisma) so this is a
   * genuine upsert-and-increment, not read-then-write. */
  private async postEventLedger(
    tx: Prisma.TransactionClient,
    eventId: string,
    eventTitle: string,
    category: string,
    kind: 'income' | 'expense',
    amount: number,
  ) {
    if (amount <= 0) return;
    await tx.ledgerEntry.upsert({
      where: { eventId_category: { eventId, category } },
      create: { kind, category, amount, note: eventTitle, eventId, auto: true },
      update: { amount: { increment: amount } },
    });
  }

  /** Shared by quote() and create() — never trust a client-supplied amount,
   * always re-derive pricing server-side from the hold + live coupon/wallet state. */
  private async priceHold(userId: string, holdId: string, couponCode?: string, requestedWalletCredit?: number) {
    const hold = await this.holds.get(holdId);
    if (hold.userId !== userId) throw new ForbiddenException('This hold belongs to a different session');

    const event = await this.prisma.event.findUnique({ where: { id: hold.eventId }, include: { tiers: true } });
    if (!event) throw new NotFoundException('Event not found');
    // re-checked here (not just at hold creation) since a hold can sit for up
    // to HOLD_TTL_S before quote()/create() actually runs — same "over"
    // definition as CatalogService.isEventOver / HoldsService.create.
    if (new Date(event.date.getTime() + event.durationHrs * 3600000) < new Date()) {
      throw new BadRequestException('This event has already happened — tickets are no longer on sale');
    }

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
      // perUserLimit/firstTimeOnly were captured by both the organizer and
      // admin coupon editors but never actually enforced here — any
      // "1 per user" or "first-time only" code could be reused indefinitely
      // by the same guest. Counts every booking regardless of status
      // (including cancelled/refunded) so cancel-then-rebook can't be used
      // to reset eligibility.
      if (couponRow.firstTimeOnly) {
        const priorBookings = await this.prisma.booking.count({ where: { userId } });
        if (priorBookings > 0) throw new BadRequestException('This coupon is for first-time bookings only');
      }
      if (couponRow.perUserLimit > 0) {
        const priorUses = await this.prisma.booking.count({ where: { userId, couponCode: couponRow.code } });
        if (priorUses >= couponRow.perUserLimit) throw new BadRequestException('You\'ve already used this coupon the maximum number of times');
      }
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

      // organizer earnings ledger — credited the ticket subtotal minus
      // whatever commission % admin set on this event (0 for the vast
      // majority of events, which have no commission configured)
      const commission = this.commissionFor(subtotal, event.commission);
      await tx.organizerLedgerTx.create({
        data: { organizerId: event.organizerId, type: 'sale', amount: subtotal - commission, eventId: event.id, eventTitle: event.title, note: `Booking ${id}` },
      });

      // platform's own finance ledger (Admin API finance ledger slice) — one
      // running total per event per category, not one row per booking
      await this.postEventLedger(tx, event.id, event.title, 'Ticket commission', 'income', commission);
      await this.postEventLedger(tx, event.id, event.title, 'Booking fees', 'income', fee);

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
    await this.email.sendTemplate(user.email, 'booking_confirmed', {
      name: input.mainGuest.trim(), eventTitle: event.title, qty: String(qty), bookingId: id, total: money(total),
    }).catch(() => {});

    // ---- invoice: GST only on the platform's own booking-fee revenue, same
    // convention Reports.ts/computeFin already uses — the organizer's ticket
    // price isn't Prebooze's revenue to tax here.
    if (subtotal > 0) {
      const [settings, venue] = await Promise.all([
        this.prisma.platformSettings.findUnique({ where: { id: 'main' } }),
        this.prisma.venue.findUnique({ where: { id: event.venueId }, select: { city: true } }),
      ]);
      const gstPct = settings?.gstPct ?? 0;
      const gstAmount = Math.round((fee * gstPct) / 100);
      await this.invoices.create({
        type: 'booking', refId: id, role: 'guest',
        payerName: input.mainGuest.trim(), payerEmail: user.email, payerPhone: input.whatsapp,
        city: venue?.city, description: `${qty}× ${event.title}`,
        subtotal, gstPct, gstAmount, total,
      }).catch(() => {});
    }

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
      if (referrer) {
        await this.wa.send(referrer.phone, 'referral_reward', [String(reward), user.name || 'Your friend']).catch(() => {});
        await this.email.sendTemplate(referrer.email, 'referral_reward', {
          name: referrer.name, amount: money(reward), friendName: user.name || 'Your friend',
        }).catch(() => {});
      }
    }

    return this.prisma.booking.findUniqueOrThrow({ where: { id }, include: { event: { include: { venue: true } } } });
  }

  /** Staff-recorded phone orders/walk-ups/comps — bypasses the hold/QR
   * checkout session and Razorpay entirely, unlike the guest flow above.
   * Finds-or-creates the buyer by phone the same way OTP signup does (an
   * admin-onboarded customer and a later real signup on the same number
   * resolve to one account, never two). Reuses the same fee formula as
   * guest checkout (bookingFee × qty, no separate GST add-on charged to the
   * guest) rather than reproducing the mock's one-off fee formula, for
   * consistency with every other booking in the system. Comp bookings
   * (subtotal 0) skip the organizer ledger credit — nothing was actually
   * sold — and skip the platform fee too. */
  async adminCreate(input: {
    eventId: string;
    tierId: string;
    qty: number;
    guestName: string;
    phone: string;
    gender?: string;
    others?: { name: string; gender?: string; whatsapp?: string }[];
    method: string;
  }) {
    if (!input.guestName?.trim() || !input.phone?.trim()) throw new BadRequestException('Guest name and phone are required');
    if (!input.qty || input.qty < 1) throw new BadRequestException('qty must be at least 1');

    const event = await this.prisma.event.findUnique({ where: { id: input.eventId }, include: { tiers: true } });
    if (!event) throw new NotFoundException('Event not found');
    const tier = event.tiers.find((t) => t.id === input.tierId);
    if (!tier) throw new BadRequestException('Unknown ticket tier');
    if (tier.quantity - tier.sold < input.qty) throw new BadRequestException(`Only ${tier.quantity - tier.sold} left in "${tier.name}"`);

    const phone = normalizePhone(input.phone);
    const buyer =
      (await this.prisma.user.findUnique({ where: { phone } })) ??
      (await this.prisma.user.create({ data: { phone, name: input.guestName.trim(), referralCode: referralCodeFor(phone) } }));

    const isComp = input.method.toLowerCase().includes('comp');
    const subtotal = isComp ? 0 : tier.price * input.qty;
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
    const fee = isComp ? 0 : Math.round(input.qty * (settings?.bookingFee ?? FALLBACK_FEE_PER_TICKET));
    const total = subtotal + fee;

    const id = '#TKT-' + randomInt(10000, 99999);
    const guests = [
      { name: input.guestName.trim(), checkedIn: false, gender: input.gender },
      ...(input.others ?? []).slice(0, input.qty - 1).filter((o) => o.name?.trim()).map((o) => ({ name: o.name.trim(), checkedIn: false, gender: o.gender, whatsapp: o.whatsapp })),
    ];
    const qrToken = await this.jwt.signAsync({ bookingId: id }, { expiresIn: '30d' });

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.ticketTier.updateMany({
        where: { id: tier.id, sold: { lte: tier.quantity - input.qty } },
        data: { sold: { increment: input.qty } },
      });
      if (res.count === 0) throw new BadRequestException(`"${tier.name}" sold out`);

      await tx.booking.create({
        data: {
          id,
          userId: buyer.id,
          eventId: event.id,
          tierName: `${input.qty}× ${tier.name}`,
          tierBreakdown: { [tier.id]: input.qty } as Prisma.InputJsonValue,
          qty: input.qty,
          subtotal,
          fee,
          total,
          guests: guests as unknown as Prisma.InputJsonValue,
          mainGuest: input.guestName.trim(),
          whatsapp: phone,
          paymentMethod: isComp ? 'Comp' : input.method,
          qrToken,
        },
      });

      const commission = this.commissionFor(subtotal, event.commission);
      if (subtotal > 0) {
        await tx.organizerLedgerTx.create({
          data: { organizerId: event.organizerId, type: 'sale', amount: subtotal - commission, eventId: event.id, eventTitle: event.title, note: `Booking ${id} (manual)` },
        });
      }
      await this.postEventLedger(tx, event.id, event.title, 'Ticket commission', 'income', commission);
      await this.postEventLedger(tx, event.id, event.title, 'Booking fees', 'income', fee);
    });

    await this.wa.send(phone, 'booking_confirmed', [input.guestName.trim(), event.title, String(input.qty), id, String(total)]).catch(() => {});
    return this.prisma.booking.findUniqueOrThrow({ where: { id }, include: { event: { include: { venue: true } } } });
  }

  async list(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: { event: { include: { venue: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** My Bookings' "Resend to WhatsApp" — re-sends the exact same template
   * create() already sends at purchase time, off the booking's own stored
   * data (not a live re-price), for a guest who missed/deleted the original. */
  async resend(userId: string, id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { event: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) throw new ForbiddenException();
    await this.wa.send(booking.whatsapp, 'booking_confirmed', [booking.mainGuest, booking.event.title, String(booking.qty), booking.id, String(booking.total)]);
    return { ok: true };
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
      await this.email.sendTemplate(user.email, 'refund_requested', {
        name: user.name, bookingId: id, amount: money(booking.total),
      }).catch(() => {});
      await this.notifications.notify('↩', `Refund requested — booking ${id} · ₹${booking.total}`, '/admin/bookings?status=refund_requested');
      await this.staffAlerts.alert(`↩ Refund requested — booking ${id} · ₹${booking.total} · ${user.name}`).catch(() => {});
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

      // reverse the organizer's earnings credit from the original sale —
      // same subtotal-minus-commission the original booking credited them
      const event = await tx.event.findUnique({ where: { id: booking.eventId }, select: { organizerId: true, title: true, commission: true } });
      const commission = event ? this.commissionFor(booking.subtotal, event.commission) : 0;
      if (event) {
        await tx.organizerLedgerTx.create({
          data: { organizerId: event.organizerId, type: 'refund', amount: -(booking.subtotal - commission), eventId: booking.eventId, eventTitle: event.title, note: `Refund — booking ${id}` },
        });
      }

      // reverse the platform's own income the same way — the refund gives
      // back booking.total in full, fee + commission included. Recorded as
      // a separate "Refund losses" expense (aggregated per event, same as
      // the income side) rather than netted directly against the income
      // categories, so gross income and gross refunds both stay visible.
      if (event) {
        await this.postEventLedger(tx, booking.eventId, event.title, 'Refund losses', 'expense', booking.fee + commission);
      }
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (refundTo === 'wallet') {
      await this.wa.send(user.phone, 'refund_wallet', [id, String(booking.total)]).catch(() => {});
    } else {
      if (booking.paymentId) await this.razorpay.refund(booking.paymentId, booking.total * 100).catch(() => {});
      await this.wa.send(user.phone, 'refund_source', [id, String(booking.total)]).catch(() => {});
    }
    await this.email.sendTemplate(user.email, 'refund_processed', {
      name: user.name, bookingId: id, amount: money(booking.total),
      refundNote: refundTo === 'wallet'
        ? 'to your Prebooze wallet — ready to use instantly.'
        : 'to your original payment method — usually 5–7 business days to reflect.',
    }).catch(() => {});

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
      if (waiter && event) {
        const eventUrl = `${process.env.WEB_APP_URL ?? ''}/events/${event.slug}`;
        await this.wa.send(waiter.phone, 'waitlist_offer', [waiter.name || 'there', event.title, eventUrl]).catch(() => {});
        await this.email.sendTemplate(waiter.email, 'waitlist_offer', {
          name: waiter.name, eventTitle: event.title, eventUrl,
        }).catch(() => {});
      }
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

  /** `scannerUserId` is whoever is operating the scanner (the organizer's
   * own JWT — same auth mechanism as a guest's, since an approved organizer
   * is still just a User row with role='organizer'). Previously this had no
   * ownership check at all: any authenticated JWT holder who got hold of a
   * valid token could check in a booking on any organizer's event. Now it's
   * scoped the same way every other gate-ops endpoint is (see
   * OrganizerService.myEvent) — must be the organizer who owns the event. */
  async checkIn(qrToken: string, scannerUserId: string) {
    let payload: { bookingId: string };
    try {
      payload = await this.jwt.verifyAsync(qrToken);
    } catch {
      await this.logCheckIn({ ok: false, reason: 'invalid or expired QR' });
      throw new BadRequestException('Invalid or expired ticket QR');
    }
    const booking = await this.prisma.booking.findUnique({ where: { id: payload.bookingId }, include: { event: true } });
    if (!booking) {
      await this.logCheckIn({ ok: false, reason: 'invalid QR — booking not found' });
      throw new NotFoundException('Booking not found');
    }
    const scannerOrg = await this.prisma.organizer.findUnique({ where: { userId: scannerUserId } });
    if (!scannerOrg || scannerOrg.id !== booking.event.organizerId) {
      await this.logCheckIn({ ok: false, reason: 'scanned by an organizer who does not own this event', eventId: booking.eventId, bookingId: booking.id });
      throw new ForbiddenException('This ticket is for a different event than the one you manage');
    }
    if (booking.status !== 'confirmed') {
      await this.logCheckIn({ ok: false, reason: `ticket is ${booking.status}, not valid for entry`, eventId: booking.eventId, bookingId: booking.id, guestName: booking.mainGuest, tierName: booking.tierName });
      throw new BadRequestException(`Ticket is ${booking.status}, not valid for entry`);
    }
    if (booking.checkedIn) {
      await this.logCheckIn({ ok: false, reason: `duplicate QR — already scanned ${booking.checkedInAt?.toISOString()}`, eventId: booking.eventId, bookingId: booking.id, guestName: booking.mainGuest, tierName: booking.tierName });
      throw new BadRequestException('Already checked in — ' + booking.checkedInAt?.toISOString());
    }

    // Conditional on checkedIn:false (not a plain update) so two near-
    // simultaneous scans of the same QR — a screenshotted ticket at two
    // gates, a camera scan racing a manual-entry confirm — can't both pass
    // the read-then-write gap above and both admit. Only one write can ever
    // match this where clause; the loser sees count 0 and is rejected below,
    // same as the fast-path check above but race-safe.
    const result = await this.prisma.booking.updateMany({
      where: { id: booking.id, checkedIn: false },
      data: { checkedIn: true, checkedInAt: new Date() },
    });
    if (result.count === 0) {
      const latest = await this.prisma.booking.findUnique({ where: { id: booking.id } });
      await this.logCheckIn({ ok: false, reason: `duplicate QR — already scanned ${latest?.checkedInAt?.toISOString()}`, eventId: booking.eventId, bookingId: booking.id, guestName: booking.mainGuest, tierName: booking.tierName });
      throw new BadRequestException('Already checked in — ' + latest?.checkedInAt?.toISOString());
    }
    const updated = await this.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
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
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const existing = await this.prisma.waitlistEntry.findUnique({ where: { eventId_userId: { eventId, userId } } });
    const row = existing ?? (await this.prisma.waitlistEntry.create({ data: { eventId, userId } }));
    return { phone: user.phone, name: user.name || 'Guest', joinedAt: row.joinedAt.toISOString(), status: row.status };
  }

  /** Public (see BookingsController — shown to logged-out guests too), so
   * this projects into the same {phone, name, joinedAt, status} shape the
   * frontend already used for its old local-only mock state, rather than
   * the raw WaitlistEntry row (id/eventId/userId) — no reason to leak
   * userId to an unauthenticated caller. */
  async waitlist(eventId: string) {
    const rows = await this.prisma.waitlistEntry.findMany({ where: { eventId }, orderBy: { joinedAt: 'asc' }, include: { user: true } });
    return rows.map((w) => ({ phone: w.user.phone, name: w.user.name || 'Guest', joinedAt: w.joinedAt.toISOString(), status: w.status }));
  }

  /** Automatic — called daily by CronService.reviewRequestTick. Prompts a
   * guest to review the organizer a day after the event they had a real
   * confirmed booking for actually ended. `event.date` is a coarse fetch
   * window (Event has no stored "ends at"), the real end-time check
   * (date + durationHrs) happens in JS since Prisma can't filter on a
   * computed column. Gated by reviewReminderSentAt the same way
   * FeaturedService.remindExpiringSoon gates its own reminder. */
  async remindForReview(): Promise<{ remindedCount: number }> {
    const windowStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // events that started up to 3 days ago
    const windowEnd = new Date(Date.now() - 12 * 60 * 60 * 1000); // ...and started at least 12h ago
    const candidates = await this.prisma.booking.findMany({
      where: { status: 'confirmed', reviewReminderSentAt: null, event: { date: { gte: windowStart, lte: windowEnd } } },
      include: { event: { include: { organizer: true } }, user: true },
    });

    let remindedCount = 0;
    for (const b of candidates) {
      const endsAt = b.event.date.getTime() + b.event.durationHrs * 60 * 60 * 1000;
      const hoursSinceEnd = (Date.now() - endsAt) / (60 * 60 * 1000);
      if (hoursSinceEnd < 24 || hoursSinceEnd > 72) continue; // ask once, a day-to-three-days after it actually ended

      const data = { name: b.user.name || b.mainGuest, eventTitle: b.event.title, organizerName: b.event.organizer.brandName, organizerId: b.event.organizerId };
      await this.email.sendTemplate(b.user.email, 'review_request', data).catch(() => {});
      await this.wa.send(b.user.phone, 'review_reminder', [data.eventTitle, data.organizerName]).catch(() => {});
      await this.prisma.booking.update({ where: { id: b.id }, data: { reviewReminderSentAt: new Date() } });
      remindedCount++;
    }
    return { remindedCount };
  }

  private async walletBalance(userId: string): Promise<number> {
    const agg = await this.prisma.walletTx.aggregate({ where: { userId }, _sum: { amount: true } });
    return agg._sum.amount ?? 0;
  }
}
