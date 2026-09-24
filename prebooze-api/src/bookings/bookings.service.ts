import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt, randomBytes } from 'crypto';
import type { Prisma, Booking } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { HoldsService } from './holds.service';
import { CatalogService } from '../catalog/catalog.service';
import { PhonePeService } from '../payments/phonepe.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { money, moneyOrFree } from '../notifications/email-templates';
import { ticketPdfBuffer } from '../notifications/ticket-pdf';
import { WalletService } from '../wallet/wallet.service';
import { REFERRAL_REFERRER_REWARD, uniqueReferralCodeFor } from '../referrals/referral.constants';
import { NotificationsService } from '../admin/notifications.service';
import { istDateKey, istDayStart } from '../common/ist-date';
import { InvoicesService } from '../invoices/invoices.service';
import { effectiveTierPrice, tierWindowState } from '../common/ticket-tier-pricing';
import { partySizeFromTierName, isCoupleTierName } from '../common/party-size';
import { normalizeGender } from '../common/coupon-gender';
import { requiredAgeFor } from '../common/age-gate';
import { normalizePhone } from '../auth/auth.service';
import { PLACEHOLDER_USERNAME, uniqueUsernameFromName } from '../auth/guest-username';
import { missingProfileFields } from '../auth/profile-completeness';
import { StaffAlertsService } from '../notifications/staff-alerts';
import { MetaConversionsService } from '../meta/meta-conversions.service';
import { LeadsService } from '../admin/leads.service';
import { getGatewayAndMethod, calculateGatewayFee, getGatewayFeeLostOnRefund, type PaymentMethod } from '../payments/gateway-fee';
import { computeGst } from '../common/gst';
import { notifyEventOwner } from '../common/notify-event-owner';
import { OrgNotificationsService } from '../notifications/org-notifications';
import { OrgAccessService } from '../organizer/org-access.service';

const FALLBACK_FEE_PCT = 3; // % — used only if PlatformSettings row is somehow missing
const RAZORPAY_FEE_PCT = 2.36; // confirmed against real live payments 2026-08-27
const WHATSAPP_MSG_COST = 0.145; // ₹ — AiSensy utility-template rate
// Prebooze's own promoter-referral incentive (2026-09-02) — % of Prebooze's
// own commission on a booking, paid to whichever real promoter's ?ref= is
// on it. Deliberately separate from and unrelated to the organizer-funded
// revenueShare system (promoterRevSharePct below) — this one needs no
// organizer opt-in, applies to any live event. See Booking.
// promoterPlatformCommission's schema comment for the full reasoning.
const PROMOTER_PLATFORM_COMMISSION_PCT = 2;
// Flat rate on every organizer-created offline booking (walk-up/phone/gate
// inquiry — createOfflineBookingSelfCollected/PaymentLink below),
// deliberately NOT the event's own event.commission — a fixed incentive
// rate to route door sales through the platform instead of cash-under-the-
// table, same value regardless of what that event charges online.
const OFFLINE_BOOKING_COMMISSION_PCT = 2;

export interface CreateBookingInput {
  holdId: string;
  mainGuest: string;
  // Checkout.tsx collects and requires this for the main attendee same as
  // every extra guest — was validated client-side but never actually sent
  // here, so it silently never landed on a single real booking (confirmed
  // against production data: every extra guest had gender saved, the main
  // attendee never did). Real 2026-08-27 finding, not a guest behavior gap.
  mainGuestGender?: string;
  // Self-declared, only ever asked at checkout when the event is 18+/21+
  // and the account doesn't already have a qualifying age on file (see
  // requiredAgeFor/BookingsService.create's age gate).
  age?: number;
  whatsapp: string;
  guests?: { name: string; gender?: string; whatsapp?: string }[]; // extra guests beyond the main one
  couponCode?: string;
  walletCredit?: number; // ₹ the user wants to apply from their balance
  promoterRef?: string;
  // Sub-promoter handle credited within promoterRef's own team (?via= on the
  // ticket link) — pure attribution, doesn't affect pricing or
  // promoterCommission, which are both computed the same regardless. Only
  // meaningful alongside a real promoterRef; ignored otherwise.
  promoterVia?: string;
  payMethodId?: string; // saved card/UPI used at checkout — becomes the default
  razorpay?: { orderId: string; paymentId: string; signature: string };
  // PhonePe has no client-reported signature to verify (see PhonePeService's
  // doc comment) — the guest's browser hands back only the merchantOrderId
  // it was redirected with; create() independently confirms real payment by
  // calling PhonePeService.getOrderStatus itself, never trusting this alone.
  phonepe?: { merchantOrderId: string };
}

@Injectable()
export class BookingsService {
  private razorpay: any = null;
  constructor(
    private prisma: PrismaService,
    private holds: HoldsService,
    
    private phonepe: PhonePeService,
    private jwt: JwtService,
    private wa: WhatsappService,
    private email: EmailService,
    private notifications: NotificationsService,
    private invoices: InvoicesService,
    private staffAlerts: StaffAlertsService,
    private wallet: WalletService,
    private meta: MetaConversionsService,
    private leads: LeadsService,
    private orgNotifications: OrgNotificationsService,
    private orgAccess: OrgAccessService,
  ) {}

  // Real gap (2026-09-24): OrgNotificationsService.notify() was only ever
  // wired up for event approved/rejected — its own doc comment already
  // named "booking received" as an example future trigger, but no booking/
  // cart/refund path ever actually called it. Small helper so each of
  // those call sites below is one line, not a repeated
  // notifyEventOwner-then-notify dance.
  private async notifyOrg(event: { organizerId: string | null; hostedByVenue: boolean; venueId: string | null }, kind: string, text: string, to?: string) {
    const owner = await notifyEventOwner(this.prisma, event);
    if (owner) await this.orgNotifications.notify(owner.userId, kind, text, to).catch(() => {});
  }

  async createHold(userId: string, eventId: string, qty: Record<string, number>) {
    return this.holds.create(userId, eventId, qty);
  }

  /** Event.commission (admin's "Event commission (per event)" setting) —
   * null/unset by default, so this is 0 for every event nobody's explicitly
   * opted into a platform cut on. */
  private commissionFor(subtotal: number, commissionPct: number | null): number {
    return commissionPct ? Math.round((subtotal * commissionPct) / 100) : 0;
  }

  /** What the guest actually receives on a refund is booking.total minus
   * this — real costs a refund causes that Prebooze doesn't get back.
   * Real 2026-08-28 finding: Razorpay keeps its own processing fee (~2.36%,
   * confirmed against a live refunded payment — the fee stayed deducted
   * after the refund went through) even on a full refund, for both
   * refund-to-source (a real Razorpay refund call) and refund-to-wallet
   * (no Razorpay call happens, but the fee was already lost at the
   * original sale's settlement regardless of what the guest later chooses).
   * A cancellation also sends real WhatsApp messages beyond the original
   * booking confirmation — 1 for wallet (refund_wallet) or 2 for
   * refund-to-source (refund_requested at cancel time + refund_source at
   * approval) — same per-message cost used to size the booking fee itself. */
  private refundDeductionFor(
    booking: { total: number; paymentId: string | null; paymentMethod?: string | null },
    refundTo: 'wallet' | 'source',
  ): number {
    const msgCount = refundTo === 'source' ? 2 : 1;
    const { feeLost, gstLost } = getGatewayFeeLostOnRefund(booking);
    return Math.round(feeLost + gstLost + msgCount * WHATSAPP_MSG_COST);
  }

  /** The organizer-configured revenue-share % for this promoter on this
   * event, or 0 if there's no valid attribution. Gated on both
   * allowedPromoters (the same list that gates free-list eligibility) and
   * revenueShare having a real entry for this slug — an unrecognised/stale
   * ?ref= earns nothing, it just doesn't get validated hard enough to block
   * the booking either. Locked into Booking.promoterCommission once at
   * creation (never recomputed), so a later organizer edit to the rate
   * never retroactively changes what a promoter already earned on a past sale. */
  private promoterRevSharePct(promoterRef: string | undefined, promoterConfig: unknown): number {
    if (!promoterRef) return 0;
    const cfg = promoterConfig as { enabled?: boolean; allowedPromoters?: string[]; revenueShare?: Record<string, number> } | null;
    if (!cfg?.enabled || !cfg.allowedPromoters?.includes(promoterRef)) return 0;
    return cfg.revenueShare?.[promoterRef] || 0;
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
  private async priceHold(userId: string, holdId: string, couponCode?: string, requestedWalletCredit?: number, promoterRef?: string) {
    const hold = await this.holds.get(holdId);
    if (hold.userId !== userId) throw new ForbiddenException('This hold belongs to a different session');

    const event = await this.prisma.event.findUnique({ where: { id: hold.eventId }, include: { tiers: true, venue: true, organizer: true } });
    if (!event) throw new NotFoundException('Event not found');
    // re-checked here (not just at hold creation) since a hold can sit for up
    // to HOLD_TTL_S before quote()/create() actually runs — same "over"
    // definition as CatalogService.isEventOver / HoldsService.create.
    if (CatalogService.isEventOver(event)) {
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
    const baseSubtotal = lines.reduce((a, l) => a + l.qty * effectiveTierPrice(l.tier, event.date), 0);

    // ---- promoter revenue-share markup — only when this hold carries a
    // ?ref= attributed to an allowed promoter who has a nonzero rate set for
    // this event. When it doesn't apply, `subtotal` is just `baseSubtotal`
    // and every line below behaves exactly as it always has. When it does,
    // the guest is charged the promoter's % *and* Prebooze's own event
    // commission % on top of the base price (each computed independently
    // off baseSubtotal, not compounded) — the organizer still nets exactly
    // baseSubtotal either way, and Prebooze's cut is guest-funded here
    // instead of carved out of the organizer's revenue. */
    const promoterPct = this.promoterRevSharePct(promoterRef, event.promoterConfig);
    const commission = this.commissionFor(baseSubtotal, event.commission);
    const promoterCommission = this.commissionFor(baseSubtotal, promoterPct);
    const promoterMarkupApplies = promoterCommission > 0;
    const subtotal = promoterMarkupApplies ? baseSubtotal + promoterCommission + commission : baseSubtotal;

    // ---- coupon ----
    let discount = 0;
    let couponRow = null as Awaited<ReturnType<typeof this.prisma.coupon.findUnique>>;
    if (couponCode) {
      couponRow = await this.prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
      if (!couponRow) throw new BadRequestException('Invalid coupon code');
      if (couponRow.status !== 'active') throw new BadRequestException('This coupon is no longer active');
      if (couponRow.validTill < new Date()) throw new BadRequestException('This coupon has expired');
      // an organizer's own coupon only ever applies to their events, and a
      // venue's own coupon only ever applies to events it hosts itself —
      // "all" scopes to all of *that owner's* events, not the whole platform
      if (couponRow.organizerId && couponRow.organizerId !== event.organizerId) {
        throw new BadRequestException('This coupon does not apply to this event');
      }
      if (couponRow.venueId && (!event.hostedByVenue || couponRow.venueId !== event.venueId)) {
        throw new BadRequestException('This coupon does not apply to this event');
      }
      if (couponRow.eventScope !== 'all' && couponRow.eventScope !== event.title) {
        throw new BadRequestException('This coupon does not apply to this event');
      }
      // A personally-earned coupon (e.g. the profile-completion reward) is
      // only ever redeemable by the guest it was issued to — real bug
      // this closes: it wasn't checked at all, so anyone who came across
      // another guest's code (it was also showing up in everyone's
      // available-coupons list — see availableCoupons' matching fix) could
      // actually redeem their reward.
      if (couponRow.userId && couponRow.userId !== userId) {
        throw new BadRequestException('This coupon isn\'t valid for your account');
      }
      if (couponRow.gender !== 'all') {
        const buyer = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        if (normalizeGender(buyer.gender) !== normalizeGender(couponRow.gender)) {
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

    // ---- booking fee — % of the discounted subtotal, not the raw one, so
    // it tracks what's actually going to be charged (a fully-discounted
    // free ticket correctly gets a ₹0 fee, same as it always has). Costed
    // to cover Razorpay's real cut (~2.42% grossed-up) plus the WhatsApp
    // confirmation (~₹0.15) — see PlatformSettings.bookingFee's doc comment
    // for the full reasoning. Ignores wallet credit deliberately: credit is
    // a guest choice applied after this point, and basing the fee on
    // pre-credit value is the simpler, still-fair approximation rather than
    // a fully circular fee-depends-on-credit-depends-on-fee formula.
    const fee = Math.round(((subtotal - discount) * (settings?.bookingFee ?? FALLBACK_FEE_PCT)) / 100);

    // ---- GST — real GSTIN activated 2026-09-21. Charged only on Prebooze's
    // own booking fee, not the full ticket price: the ticket itself is the
    // organizer's sale (their own, separate tax liability), Prebooze's only
    // taxable supply here is the service fee it actually earns. Same
    // gstEnabled kill-switch reasoning as PlatformSettings.gstEnabled's own
    // doc comment — false (the default, and every pre-launch booking)
    // behaves exactly like the old always-0 code. */
    const gstPct = settings?.gstEnabled ? (settings?.gstPct ?? 0) : 0;
    // Place of supply for event-admission services is the event's own
    // location (IGST Act s.12(6)) — same resolution create()'s invoice
    // creation uses below, just done here too so the checkout quote can
    // show the real CGST+SGST/IGST split before payment, not just the
    // combined amount.
    const eventState = event.venue?.state
      ?? (event.privateCity ? (await this.prisma.city.findUnique({ where: { name: event.privateCity }, include: { state: true } }).catch(() => null))?.state?.name : null)
      ?? null;
    // Named bookingGst, not gst — create()'s own gateway-fee accounting
    // below already uses `gst` for a completely different thing (the
    // payment gateway's own GST on ITS processing fee, an expense to
    // Prebooze, not this — the GST Prebooze charges the guest on its
    // booking fee, real revenue owed to the government).
    const gstSplit = computeGst(fee, gstPct, eventState);
    const bookingGst = gstSplit.gstAmount;

    // ---- wallet credit ----
    const balance = await this.walletBalance(userId);
    const requestedCredit = Math.max(0, requestedWalletCredit ?? 0);
    const walletCreditUsed = Math.min(requestedCredit, balance, Math.max(0, subtotal + fee + bookingGst - discount));

    const total = subtotal + fee + bookingGst - discount - walletCreditUsed;
    return {
      hold, event, lines, qty, baseSubtotal, subtotal, commission, promoterCommission, promoterMarkupApplies,
      fee, gstPct, bookingGst, cgstAmount: gstSplit.cgstAmount, sgstAmount: gstSplit.sgstAmount, igstAmount: gstSplit.igstAmount,
      discount, couponRow, walletCreditUsed, total,
    };
  }

  /** Checkout's "available promo codes" strip — same eligibility rules
   * priceHold() enforces at apply-time (status/expiry/scope/usage/gender/
   * first-time/per-user-limit), just surfaced ahead of time instead of only
   * discovered after a guest types a code and gets rejected. Only ever
   * returns codes this exact guest can actually use right now. */
  async availableCoupons(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const buyer = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const candidates = await this.prisma.coupon.findMany({
      where: {
        status: 'active',
        validTill: { gt: new Date() },
        AND: [
          {
            OR: [
              { organizerId: null, venueId: null },
              ...(event.organizerId ? [{ organizerId: event.organizerId }] : []),
              ...(event.hostedByVenue && event.venueId ? [{ venueId: event.venueId }] : []),
            ],
          },
          { OR: [{ eventScope: 'all' }, { eventScope: event.title }] },
          // A personally-earned coupon (userId set — e.g. the
          // profile-completion reward) only ever shows to the guest it was
          // issued to, same as it's only ever redeemable by them below.
          { OR: [{ userId: null }, { userId }] },
        ],
      },
      orderBy: { value: 'desc' },
    });

    const eligible: { code: string; type: string; value: number; maxDiscount: number | null; description: string | null }[] = [];
    for (const c of candidates) {
      if (c.used >= c.usageLimit) continue;
      if (c.gender !== 'all' && normalizeGender(buyer.gender) !== normalizeGender(c.gender)) continue;
      if (c.firstTimeOnly) {
        const priorBookings = await this.prisma.booking.count({ where: { userId } });
        if (priorBookings > 0) continue;
      }
      if (c.perUserLimit > 0) {
        const priorUses = await this.prisma.booking.count({ where: { userId, couponCode: c.code } });
        if (priorUses >= c.perUserLimit) continue;
      }
      eligible.push({ code: c.code, type: c.type, value: c.value, maxDiscount: c.maxDiscount, description: c.description });
    }
    return eligible;
  }

  /** Called before sending the guest to checkout — creates the PhonePe order
   * with the *final* (post-coupon, post-wallet-credit) amount, since the
   * gateway requires the order amount to match what's actually charged.
   * `holdId` doubles as PhonePe's `merchantOrderId` — PhonePe doesn't
   * generate its own order identifier the way Razorpay did, we hand it one,
   * so there's no separate id to track or reverse-lookup later (see
   * PhonePeService's doc comment). Real end-to-end checkout is now a
   * browser redirect to `redirectUrl`, not an embedded widget — the
   * frontend must navigate there directly, not open it in a modal. */
  async quote(userId: string, holdId: string, couponCode?: string, walletCredit?: number, promoterRef?: string) {
    const p = await this.priceHold(userId, holdId, couponCode, walletCredit, promoterRef);
    const returnUrl = `${process.env.WEB_APP_URL || 'https://prebooze.com'}/checkout?holdId=${encodeURIComponent(holdId)}&phonepe_return=1`;
    // A fresh, disposable merchantOrderId on every call — never holdId
    // itself. The checkout page's quote effect legitimately re-fires more
    // than once per session (a coupon applied, wallet-credit toggled), and
    // this used to be safe under Razorpay because createOrder always minted
    // its own new order id with no caller input; PhonePe's merchantOrderId
    // is caller-chosen and must be unique, so reusing holdId here made the
    // *second* quote() call for the same hold 500 — real bug hit
    // 2026-09-18, confirmed against a live re-quote of an already-ordered
    // hold. Unpaid stray orders simply expire on PhonePe's own side.
    let phonepeRedirectUrl: string | undefined;
    let phonepeMerchantOrderId: string | undefined;
    if (p.total > 0) {
      const merchantOrderId = `${holdId}-${randomBytes(6).toString('hex')}`;
      const order = await this.phonepe.createOrder(merchantOrderId, p.total * 100, returnUrl);
      phonepeRedirectUrl = order.redirectUrl;
      phonepeMerchantOrderId = merchantOrderId;
      // Durable record of this exact id, for the PhonePe webhook fallback
      // (reconcilePhonePePayment) to look this cart up by — best-effort,
      // must never block a real quote over a tracking write.
      await this.prisma.cart.updateMany({ where: { holdId }, data: { phonepeMerchantOrderId: merchantOrderId } }).catch(() => {});
    }
    return {
      subtotal: p.subtotal, fee: p.fee, gstPct: p.gstPct, gst: p.bookingGst,
      cgstAmount: p.cgstAmount, sgstAmount: p.sgstAmount, igstAmount: p.igstAmount,
      discount: p.discount, walletCreditUsed: p.walletCreditUsed, total: p.total,
      promoterMarkupApplies: p.promoterMarkupApplies,
      promoterShare: p.promoterMarkupApplies ? p.promoterCommission : 0,
      platformShare: p.promoterMarkupApplies ? p.commission : 0,
      phonepeRedirectUrl,
      phonepeMerchantOrderId,
    };
  }

  /** Nudges a guest toward the profile-completion reward (AuthService.
   * claimProfileCompletionReward) right alongside a booking confirmation —
   * the reward already exists but was pull-only (FinishProfile.tsx), so
   * nobody ever heard about it unless they happened to visit that page.
   * Fresh DB read (not the caller's in-memory `user`) since a booking may
   * have just backfilled city/state/country a few lines earlier — checking
   * against a stale copy would nudge someone about a field that's already
   * filled. Repeats on every booking, not just the first, until the guest
   * either finishes the profile or claims the reward — same reasoning as
   * cart_reminder repeating per abandoned cart rather than a one-shot. */
  private async maybeNudgeProfileReward(userId: string, eventTitle: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u || u.profileRewardClaimedAt || missingProfileFields(u).length === 0) return;
    // Same referral link ReferEarn.tsx builds client-side (`{origin}/r/{code}`)
    // — riding along on this nudge rather than a separate send, since a
    // guest who's already reading about one reward is a reasonable moment
    // to mention the other.
    const referralLink = `${process.env.WEB_APP_URL || 'https://prebooze.com'}/r/${u.referralCode ?? ''}`;
    await this.wa.send(u.phone, 'profile_reward_nudge', [u.name || 'there', eventTitle, referralLink]).catch(() => {});
    if (u.email) {
      await this.email.sendTemplate(u.email, 'profile_reward_nudge', { name: u.name, eventTitle, referralCode: u.referralCode ?? '' }).catch(() => {});
    }
  }

  /** Snapshots the guest's attendee-details/coupon/wallet/promoter/
   * payMethod choices onto their Cart row the instant they click Pay —
   * before Razorpay even opens. Purely a safety net for reconcilePayment()
   * below; never blocks or fails the real checkout if this write doesn't
   * land. See the 2026-08-27 incident (payment captured, no booking ever
   * created, guest's browser tab died mid-UPI-app-switch) this exists to
   * close for good. */
  async prepare(userId: string, input: {
    holdId: string;
    mainGuest: string;
    mainGuestGender?: string;
    age?: number;
    whatsapp: string;
    guests?: { name: string; gender?: string; whatsapp?: string }[];
    couponCode?: string;
    walletCredit?: number;
    promoterRef?: string;
    promoterVia?: string;
    payMethodId?: string;
  }) {
    await this.prisma.cart
      .updateMany({
        where: { holdId: input.holdId, userId },
        data: {
          bookingPayload: {
            mainGuest: input.mainGuest,
            mainGuestGender: input.mainGuestGender ?? null,
            age: input.age ?? null,
            whatsapp: input.whatsapp,
            guests: input.guests ?? [],
            couponCode: input.couponCode ?? null,
            walletCredit: input.walletCredit ?? 0,
            promoterRef: input.promoterRef ?? null,
            promoterVia: input.promoterVia ?? null,
            payMethodId: input.payMethodId ?? null,
          } as unknown as Prisma.InputJsonValue,
        },
      })
      .catch(() => {});
    return { ok: true };
  }

  /** Razorpay webhook fallback for `payment.captured` (RazorpayWebhookController)
   * — closes the gap where a real payment gets captured but the guest's own
   * browser never comes back to finish create() (most commonly: a UPI
   * app-switch backgrounds/kills the tab mid-payment). Idempotent against
   * the client's own successful call via Booking.paymentId's unique
   * constraint — whichever path lands first wins, the other silently no-ops. */
  async reconcilePayment(paymentId: string, orderId: string, amountPaise: number) {
    const existing = await this.prisma.booking.findUnique({ where: { paymentId } });
    if (existing) return; // client's own call (or an earlier webhook delivery) already handled this

    const order = await this.razorpay.getOrder(orderId);
    const holdId = order?.receipt ?? null;
    const cart = holdId ? await this.prisma.cart.findUnique({ where: { holdId } }) : null;
    const payload = cart?.bookingPayload as {
      mainGuest: string; mainGuestGender: string | null; age: number | null; whatsapp: string; guests: { name: string; gender?: string; whatsapp?: string }[];
      couponCode: string | null; walletCredit: number; promoterRef: string | null; promoterVia: string | null; payMethodId: string | null;
    } | null;

    if (!cart || !payload) {
      // We genuinely don't know who this guest is or what they meant to
      // book (prepare() never landed, or ran before this feature shipped)
      // — can't safely fabricate a name/tier, so this needs a human, same
      // as how the Gagandeep Singh incident got resolved manually.
      await this.staffAlerts
        .alert(`⚠ Razorpay captured payment ${paymentId} (₹${(amountPaise / 100).toFixed(2)}, order ${orderId}) with no matching booking and no recoverable cart. Check the Razorpay dashboard and reach out to the guest directly.`)
        .catch(() => {});
      return;
    }

    try {
      await this.holds.reopen(holdId!, cart.userId, cart.eventId, cart.qtyMap as Record<string, number>);
      const signature = this.razorpay.signPayment(orderId, paymentId);
      const booking = await this.create(cart.userId, {
        holdId: holdId!,
        mainGuest: payload.mainGuest,
        mainGuestGender: payload.mainGuestGender ?? undefined,
        age: payload.age ?? undefined,
        whatsapp: payload.whatsapp,
        guests: payload.guests,
        couponCode: payload.couponCode ?? undefined,
        walletCredit: payload.walletCredit,
        promoterRef: payload.promoterRef ?? undefined,
        promoterVia: payload.promoterVia ?? undefined,
        payMethodId: payload.payMethodId ?? undefined,
        razorpay: { orderId, paymentId, signature },
      });
      await this.staffAlerts
        .alert(`✓ Auto-recovered a booking via the payment webhook — ${payload.mainGuest}'s own confirmation never arrived (likely a UPI app-switch killing the browser tab) but payment ${paymentId} was real, so Booking ${booking.id} was created automatically.`)
        .catch(() => {});
    } catch (e) {
      // A P2002 on Booking.paymentId means the client's own call landed in
      // the same moment this ran — genuinely not a failure, just a race
      // this constraint exists to resolve safely. Anything else (sold out
      // in the meantime, event no longer on sale, etc.) needs a human.
      if ((e as { code?: string })?.code === 'P2002') return;
      await this.staffAlerts
        .alert(`⚠ Razorpay captured payment ${paymentId} (₹${(amountPaise / 100).toFixed(2)}, guest ${payload.mainGuest} / ${payload.whatsapp}) but auto-creating the booking failed: ${(e as Error).message}. Needs manual recovery.`)
        .catch(() => {});
    }
  }

  /** PhonePe webhook fallback for a completed order (PhonePeWebhookController)
   * — same reasoning as reconcilePayment above, adapted for PhonePe's real
   * shape: there's no separate gateway payment id to look an order up by
   * (Razorpay's getOrder(orderId).receipt), so the cart is found directly
   * by the merchantOrderId quote() recorded on it (see Cart.
   * phonepeMerchantOrderId's doc comment) instead. Idempotent the same way,
   * via Booking.paymentId's unique constraint. */
  async reconcilePhonePePayment(merchantOrderId: string, amountPaise: number) {
    const existing = await this.prisma.booking.findUnique({ where: { paymentId: merchantOrderId } });
    if (existing) return; // client's own call (or an earlier webhook delivery) already handled this

    const cart = await this.prisma.cart.findFirst({ where: { phonepeMerchantOrderId: merchantOrderId } });
    const payload = cart?.bookingPayload as {
      mainGuest: string; mainGuestGender: string | null; age: number | null; whatsapp: string; guests: { name: string; gender?: string; whatsapp?: string }[];
      couponCode: string | null; walletCredit: number; promoterRef: string | null; promoterVia: string | null; payMethodId: string | null;
      // Only set by createOfflineBookingPaymentLink — an organizer-created
      // offline booking has no logged-in guest browser to call create()
      // itself, so this webhook is that booking's ONLY finalization path,
      // not a recovery fallback like the branch below.
      isOfflineOrgBooking?: boolean; offlineOrganizerId?: string;
    } | null;

    if (!cart || !payload) {
      // Same "can't safely fabricate a name/tier" reasoning as the Razorpay
      // fallback — this needs a human.
      await this.staffAlerts
        .alert(`⚠ PhonePe order ${merchantOrderId} completed (₹${(amountPaise / 100).toFixed(2)}) with no matching booking and no recoverable cart. Check the PhonePe dashboard and reach out to the guest directly.`)
        .catch(() => {});
      return;
    }

    if (payload.isOfflineOrgBooking && payload.offlineOrganizerId) {
      await this.finalizeOfflineLinkBooking(cart, merchantOrderId, amountPaise, {
        mainGuest: payload.mainGuest, mainGuestGender: payload.mainGuestGender, whatsapp: payload.whatsapp,
        guests: payload.guests, offlineOrganizerId: payload.offlineOrganizerId,
      }).catch(async (e) => {
        await this.staffAlerts
          .alert(`⚠ Offline payment-link order ${merchantOrderId} completed (₹${(amountPaise / 100).toFixed(2)}, guest ${payload.mainGuest}) but finalizing the booking failed: ${(e as Error).message}. Needs manual recovery.`)
          .catch(() => {});
      });
      return;
    }

    try {
      await this.holds.reopen(cart.holdId, cart.userId, cart.eventId, cart.qtyMap as Record<string, number>);
      const booking = await this.create(cart.userId, {
        holdId: cart.holdId,
        mainGuest: payload.mainGuest,
        mainGuestGender: payload.mainGuestGender ?? undefined,
        age: payload.age ?? undefined,
        whatsapp: payload.whatsapp,
        guests: payload.guests,
        couponCode: payload.couponCode ?? undefined,
        walletCredit: payload.walletCredit,
        promoterRef: payload.promoterRef ?? undefined,
        promoterVia: payload.promoterVia ?? undefined,
        payMethodId: payload.payMethodId ?? undefined,
        phonepe: { merchantOrderId },
      });
      await this.staffAlerts
        .alert(`✓ Auto-recovered a booking via the PhonePe webhook — ${payload.mainGuest}'s own confirmation never arrived (likely their browser never made it back from PhonePe's page) but payment ${merchantOrderId} was real, so Booking ${booking.id} was created automatically.`)
        .catch(() => {});
    } catch (e) {
      // A P2002 on Booking.paymentId means the client's own call landed in
      // the same moment this ran — genuinely not a failure, just a race
      // this constraint exists to resolve safely. Anything else (sold out
      // in the meantime, event no longer on sale, etc.) needs a human.
      if ((e as { code?: string })?.code === 'P2002') return;
      await this.staffAlerts
        .alert(`⚠ PhonePe order ${merchantOrderId} completed (₹${(amountPaise / 100).toFixed(2)}, guest ${payload.mainGuest} / ${payload.whatsapp}) but auto-creating the booking failed: ${(e as Error).message}. Needs manual recovery.`)
        .catch(() => {});
    }
  }

  /** Real pg.refund.completed / pg.refund.failed webhook handling — the
   * gap that caused a real 2026-09-23 incident: a refund initiated
   * directly on the PhonePe dashboard (because our own Refund Status API
   * was returning 401 for this merchant account) had nowhere to land, so
   * the booking stayed stuck showing "failed, retry" even after the real
   * refund completed. Looked up by `originalMerchantOrderId`, which is
   * exactly what's stored as `Booking.paymentId` for every PhonePe
   * booking (see refundViaGateway/HoldsService.create) — one outstanding
   * refund per booking is the only case this app ever creates, so no
   * separate match on refundId is needed. */
  async reconcilePhonePeRefund(originalMerchantOrderId: string, state: 'COMPLETED' | 'FAILED', refundId: string | undefined, amountPaise: number) {
    const booking = await this.prisma.booking.findUnique({ where: { paymentId: originalMerchantOrderId } });
    if (!booking) return; // not one of ours (or a payment, not a refund, id) — nothing to do

    if (state === 'COMPLETED') {
      const amount = Math.round(amountPaise / 100);
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { refundFailedAt: null, refundGatewayState: 'COMPLETED', refundGatewayRefundId: refundId ?? booking.refundGatewayRefundId, refundGatewayAmount: amount },
      });
      const user = await this.prisma.user.findUnique({ where: { id: booking.userId } });
      if (user) {
        await this.wa.send(user.phone, 'refund_source', [booking.id, String(amount)]).catch(() => {});
        await this.email.sendTemplate(user.email, 'refund_processed', {
          name: user.name, bookingId: booking.id, amount: money(amount),
          refundNote: 'to your original payment method — usually 5–7 business days to reflect.',
        }).catch(() => {});
      }
    } else {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { refundFailedAt: new Date(), refundGatewayState: 'FAILED', refundGatewayRefundId: refundId ?? booking.refundGatewayRefundId },
      });
      await this.staffAlerts
        .alert(`⚠ Refund to original payment method FAILED (confirmed by PhonePe webhook) for booking ${booking.id} — refund ${refundId ?? 'unknown id'}. The guest has NOT been paid back. Retry from Booking detail.`)
        .catch(() => {});
    }
  }

  async create(userId: string, input: CreateBookingInput, reqMeta?: { ip?: string; userAgent?: string }) {
    const buyer = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (buyer.blocked) throw new ForbiddenException('This account is blocked from booking — contact support');
    if (!input.mainGuest?.trim()) throw new BadRequestException('Attendee name is required');

    let priced: Awaited<ReturnType<typeof this.priceHold>>;
    try {
      priced = await this.priceHold(userId, input.holdId, input.couponCode, input.walletCredit, input.promoterRef);
    } catch (e) {
      // PhonePe's real, full-page redirect can easily outlast the 8-min
      // Redis hold TTL (bank-app switch, guest hesitation, a slow network)
      // in a way Razorpay's embedded modal never could — that modal never
      // left the tab the hold was ticking in. A guest whose payment
      // genuinely completed must not lose their booking just because the
      // hold itself expired first while they were away on PhonePe's page.
      // Reopen it from the durable Cart row (same recovery HoldsService.
      // reopen already does for the Razorpay webhook fallback below) before
      // giving up — real incident caught 2026-09-19 during PhonePe cutover
      // verification: a completed ₹1 payment had no booking to show for it.
      if (!input.phonepe) throw e;
      const cart = await this.prisma.cart.findUnique({ where: { holdId: input.holdId } });
      if (!cart || cart.userId !== userId) throw e;
      try {
        await this.holds.reopen(input.holdId, userId, cart.eventId, cart.qtyMap as Record<string, number>);
        priced = await this.priceHold(userId, input.holdId, input.couponCode, input.walletCredit, input.promoterRef);
      } catch (reopenErr) {
        // The hold expired AND the recovery attempt also failed (most
        // likely sold out in the meantime) — there's no PhonePe webhook
        // configured yet to catch this asynchronously later (unlike
        // Razorpay's reconcilePayment below), so this needs a human now,
        // same alerting precedent as that fallback's own failure branch.
        const status = await this.phonepe.getOrderStatus(input.phonepe.merchantOrderId).catch(() => null);
        if (status?.state === 'COMPLETED') {
          await this.staffAlerts
            .alert(`⚠ PhonePe order ${input.phonepe.merchantOrderId} completed (₹${(status.amount / 100).toFixed(2)}) but its hold couldn't be recovered to create a booking: ${(reopenErr as Error).message}. Needs manual recovery — check the PhonePe dashboard and reach out to the guest.`)
            .catch(() => {});
        }
        throw reopenErr;
      }
    }
    const { event, lines, qty, baseSubtotal, subtotal, commission, promoterCommission, promoterMarkupApplies, fee, gstPct, bookingGst, igstAmount: bookingIgst, discount, couponRow, walletCreditUsed, total } = priced;

    // Prebooze's own promoter-referral commission — completely separate
    // from promoterCommission above (organizer-funded, requires
    // allowedPromoters opt-in). This one only requires the ref to belong to
    // a real Promoter row — no organizer configuration involved at all, by
    // design (see PROMOTER_PLATFORM_COMMISSION_PCT). Doesn't touch
    // subtotal/total: Prebooze is splitting its own cut here, not adding a
    // guest-funded markup, so pricing above is completely unaffected.
    let promoterPlatformCommission = 0;
    if (input.promoterRef && commission > 0) {
      const platformPromoter = await this.prisma.promoter.findUnique({ where: { slug: input.promoterRef }, select: { id: true } });
      if (platformPromoter) promoterPlatformCommission = Math.round((commission * PROMOTER_PLATFORM_COMMISSION_PCT) / 100);
    }

    // A tier like "Couple" or "Group of 5" admits more than one person per
    // ticket — the guest list must have a name for every one of them, not
    // just one per ticket unit, or a Couple booking silently loses track of
    // who the second person is (real incident: two Couple bookings for the
    // same event both only recorded the buyer's own name).
    const expectedHeadcount = lines.reduce((a, l) => a + l.qty * partySizeFromTierName(l.tier.name), 0);
    const providedHeadcount = 1 + (input.guests ?? []).length;
    if (providedHeadcount !== expectedHeadcount) {
      throw new BadRequestException(`This booking needs a name for all ${expectedHeadcount} attendee${expectedHeadcount > 1 ? 's' : ''} — got ${providedHeadcount}`);
    }

    // Couple tiers specifically (not any 2-person tier) are priced on the
    // door policy most Indian nightlife venues run: exactly one male + one
    // female per pair, to keep an all-male "stag" group from entering at
    // the discounted Couple rate — real incident: a 3× Couple booking's 6
    // guests, across 3 pairs, were all recorded Male. Checked as flat
    // position-pairs across every line in booking order, same indexing the
    // headcount check above already guarantees lines up 1:1.
    {
      const flatGenders = [input.mainGuestGender, ...(input.guests ?? []).map((g) => g.gender)];
      let cursor = 0;
      for (const l of lines) {
        const per = partySizeFromTierName(l.tier.name);
        if (isCoupleTierName(l.tier.name)) {
          for (let t = 0; t < l.qty; t++) {
            const pair = flatGenders.slice(cursor, cursor + 2);
            if (!(pair.includes('Male') && pair.includes('Female'))) {
              throw new BadRequestException(`"${l.tier.name}" tickets need one male and one female guest per pair`);
            }
            cursor += 2;
          }
        } else {
          cursor += l.qty * per;
        }
      }
    }

    // Age gate — only for an 18+/21+ event (requiredAge is null otherwise,
    // no-op for the overwhelming majority of bookings). A previously-cleared
    // age (e.g. confirmed 25 once) never needs re-asking. A stored age that
    // no longer clears *this* event's bar (confirmed 19 once, now booking a
    // 21+) gets re-asked rather than silently trusted or permanently
    // blocked — people's age only goes up, so re-confirming is always safe
    // and catches an honest typo the first time around.
    const requiredAge = requiredAgeFor(event.ageLimit);
    if (requiredAge !== null && (buyer.age ?? 0) < requiredAge) {
      if (input.age === undefined) throw new BadRequestException(`This event is ${event.ageLimit} — confirm your age to continue`);
      if (input.age < requiredAge) throw new BadRequestException(`This event is ${event.ageLimit} — you don't meet the age requirement`);
    }

    // ---- payment ----
    // PhonePe has no client-reported signature — the only trustworthy
    // confirmation is our own server calling getOrderStatus and requiring
    // state === 'COMPLETED'. paymentId is the merchantOrderId itself
    // (== holdId) since PhonePe never hands back a separate payment id the
    // way Razorpay did — nothing else to store.
    let paymentId: string | null = null;
    let paymentMethod: PaymentMethod | null = null;
    if (total > 0) {
      if (input.phonepe) {
        const status = await this.phonepe.getOrderStatus(input.phonepe.merchantOrderId);
        if (!status || status.state !== 'COMPLETED') throw new BadRequestException('Payment verification failed');
        // The order was created against whatever `total` quote() computed
        // at that moment — if a coupon/wallet-credit choice changed between
        // then and now (a slow guest, a coupon expiring mid-checkout), this
        // create() call would otherwise book at a DIFFERENT price than what
        // PhonePe actually collected, silently over/under-charging. Refuse
        // rather than guess; this needs a human, not an automatic booking.
        if (status.amount !== total * 100) {
          await this.staffAlerts
            .alert(`⚠ PhonePe order ${input.phonepe.merchantOrderId} collected ₹${(status.amount / 100).toFixed(2)} but this booking now prices at ₹${total} — refused rather than auto-created. Needs manual review (likely a coupon/credit change mid-checkout).`)
            .catch(() => {});
          throw new BadRequestException(`This booking's price changed since you paid — contact support with reference ${input.phonepe.merchantOrderId}`);
        }
        paymentId = input.phonepe.merchantOrderId;
        // Fetch and store payment method for fee calculations
        const methodResult = await this.phonepe.getPaymentMethod(paymentId).catch(() => null);
        if (methodResult) {
          paymentMethod = methodResult.method as PaymentMethod;
          // Auto-save the method this real payment actually used (see
          // WalletService.saveUsedMethod) — swallows its own errors, same as
          // every other post-payment side effect here; a save failure must
          // never fail a booking that already genuinely completed payment.
          await this.wallet.saveUsedMethod(userId, methodResult).catch(() => {});
        }
      } else if (!this.phonepe.live) {
        // dev convenience: simulate a completed payment so the flow is curl-testable
        paymentId = this.phonepe.devFakeMerchantOrderId();
      } else {
        throw new BadRequestException('Payment is required to complete this booking');
      }
    }

    const id = '#TKT-' + randomInt(10000, 99999);
    const guests = [
      { name: input.mainGuest.trim(), checkedIn: false, gender: input.mainGuestGender },
      ...(input.guests ?? []).map((g) => ({ name: g.name.trim(), checkedIn: false, gender: g.gender, whatsapp: g.whatsapp })),
    ];
    const tierBreakdown = Object.fromEntries(lines.map((l) => [l.tier.id, l.qty]));
    const qrToken = await this.jwt.signAsync({ bookingId: id }, { expiresIn: '30d' });

    // ---- atomic: guard against overselling, write booking + debit wallet + bump coupon use ----
    const booking = await this.prisma.$transaction(async (tx) => {
      for (const l of lines) {
        const res = await tx.ticketTier.updateMany({
          where: { id: l.tier.id, sold: { lte: l.tier.quantity - l.qty } },
          data: { sold: { increment: l.qty } },
        });
        if (res.count === 0) throw new BadRequestException(`"${l.tier.name}" sold out while you were checking out`);
      }

      const created = await tx.booking.create({
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
          promoterVia: input.promoterRef ? input.promoterVia : undefined,
          promoterCommission,
          commission,
          promoterPlatformCommission,
          walletCreditUsed,
          paymentId: paymentId ?? undefined,
          paymentMethod: paymentMethod ?? undefined,
          qrToken,
          // Locked in now, same reasoning as promoterCommission above — a
          // later edit to a tier's cover charge never changes what this
          // specific booking already promised its guest. A ₹0 tier's free
          // window (see ticket-tier-pricing.ts) pays nothing, so it gets no
          // redeemable credit either — only a booking made after the window
          // closes (paying lateFeePrice) actually earns the tier's cover
          // charge. A normal always-paid tier is unaffected either way.
          coverCharge: lines.reduce((a, l) => a + (tierWindowState(l.tier, event.date) === 'free' ? 0 : l.tier.coverCharge) * l.qty, 0),
        },
      });

      // First real booking is the moment a guest's identity is confirmed —
      // backfill their blank profile name from it rather than leaving
      // User.name empty forever (checkout never wrote this back before).
      // Same moment their username can move on from the phone-digit
      // placeholder (uniqueUsername, verifyOtp) to a real name-based one —
      // only if they haven't already customized it themselves. Gender rides
      // along the same way — same "was captured on the booking but never
      // reached the profile" gap name/city already had.
      const nameUpdate = !buyer.name?.trim() ? { name: input.mainGuest.trim() } : {};
      const genderUpdate = !buyer.gender?.trim() && input.mainGuestGender ? { gender: input.mainGuestGender } : {};
      // Always trust a freshly-provided age over whatever's stored — it
      // only ever gets sent when the stored one didn't clear this event's
      // bar (or there wasn't one), so the fresh answer is strictly the more
      // current/correct one. A dob-derived age (AuthService.updateMe) is
      // never overwritten by this in practice — a qualifying stored age
      // never triggers the checkout re-ask that produces input.age.
      const ageUpdate = input.age !== undefined ? { age: input.age } : {};
      const newUsername = !buyer.name?.trim() && PLACEHOLDER_USERNAME.test(buyer.username)
        ? await uniqueUsernameFromName(tx, input.mainGuest.trim(), userId)
        : undefined;
      if (Object.keys(nameUpdate).length || Object.keys(genderUpdate).length || Object.keys(ageUpdate).length || newUsername) {
        await tx.user.update({ where: { id: userId }, data: { ...nameUpdate, ...genderUpdate, ...ageUpdate, ...(newUsername ? { username: newUsername } : {}) } });
      }

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

      // With no promoter markup, the organizer nets subtotal minus Prebooze's
      // carved-out commission — unchanged from before. With a markup active,
      // both the promoter's and Prebooze's cuts were funded by the guest on
      // top of baseSubtotal, so the organizer nets baseSubtotal in full.
      const organizerCredit = promoterMarkupApplies ? baseSubtotal : subtotal - commission;
      // Venue-hosted events (see Event.hostedByVenue) credit the venue's own
      // ledger instead — the venue is the platform's ledger-of-record for
      // its own hosted events even when collaborating with an organizer;
      // that split happens offline between them (see VenueLedgerTx doc
      // comment). Every event created the normal organizer way is
      // hostedByVenue: false and hits the exact same branch as before.
      if (event.hostedByVenue && event.venueId) {
        await tx.venueLedgerTx.create({
          data: { venueId: event.venueId, type: 'sale', amount: organizerCredit, eventId: event.id, eventTitle: event.title, note: `Booking ${id}` },
        });
      } else if (event.organizerId) {
        await tx.organizerLedgerTx.create({
          data: { organizerId: event.organizerId, type: 'sale', amount: organizerCredit, eventId: event.id, eventTitle: event.title, note: `Booking ${id}` },
        });
      }

      // platform's own finance ledger (Admin API finance ledger slice) — one
      // running total per event per category, not one row per booking
      await this.postEventLedger(tx, event.id, event.title, 'Ticket commission', 'income', commission);
      await this.postEventLedger(tx, event.id, event.title, 'Booking fees', 'income', fee);
      // Kept as its own category, deliberately never folded into "Booking
      // fees" — this is GST collected from the guest on Prebooze's behalf,
      // owed to the government on the next GST return, not real Prebooze
      // revenue. This ledger only models income/expense (no liability kind),
      // so it's bucketed as 'income' for now with a name that makes the
      // distinction obvious in the finance ledger UI; flag to an accountant
      // if a real liability line is wanted instead.
      await this.postEventLedger(tx, event.id, event.title, 'GST collected (payable)', 'income', bookingGst);
      // Real cost of this sale, previously invisible — only deducted from a
      // later refund (see refundDeductionFor), never recorded as its own
      // expense on the sale itself until now. Post gateway fees based on
      // payment method: Razorpay posts one combined 2.36% fee; PhonePe posts
      // 0% for UPI and 1.99% + 18% GST for card/netbanking.
      if (paymentId && total > 0) {
        const { gateway, method } = getGatewayAndMethod(paymentId);
        // calculateGatewayFee is paise-in/paise-out (see settlements.
        // service.ts's own `/ 100` after calling it) — LedgerEntry.amount
        // is whole rupees like every other ₹ field, so the paise result
        // needs the same conversion here. Real bug fixed 2026-09-23: a
        // card/netbanking PhonePe sale was posting its gateway-fee expense
        // ~100x too large (paise value stored as if it were rupees).
        const { baseFee, gst } = calculateGatewayFee(total * 100, gateway, paymentMethod || (method as PaymentMethod));
        const baseFeeRupees = Math.round(baseFee / 100);
        const gstRupees = Math.round(gst / 100);
        if (baseFeeRupees > 0) {
          await this.postEventLedger(tx, event.id, event.title, 'Payment gateway fee', 'expense', baseFeeRupees);
        }
        if (gstRupees > 0) {
          await this.postEventLedger(tx, event.id, event.title, 'Payment gateway GST', 'expense', gstRupees);
        }
      }
      // Rounded up to a whole rupee per message — LedgerEntry.amount has no
      // paise support like every other ₹ field in this system, and the real
      // ~₹0.145/message cost would otherwise round to ₹0 and never
      // accumulate at all. Overstates the true cost, but stays non-zero and
      // visible, which a silent ₹0 wouldn't be.
      await this.postEventLedger(tx, event.id, event.title, 'WhatsApp message charges', 'expense', Math.ceil(WHATSAPP_MSG_COST));

      // paying with a saved method sets it default
      if (input.payMethodId) {
        const method = await tx.payMethod.findUnique({ where: { id: input.payMethodId } });
        if (method && method.userId === userId && !method.isDefault) {
          await tx.payMethod.updateMany({ where: { userId }, data: { isDefault: false } });
          await tx.payMethod.update({ where: { id: input.payMethodId }, data: { isDefault: true } });
        }
      }
      return created;
    });

    await this.holds.release(input.holdId);

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    // WhatsApp can't carry the real PDF (see WhatsappService/
    // InvoicesService.resendWhatsapp for the same, already-documented
    // AiSensy constraint — no arbitrary media attachment on a campaign
    // template send; the PDF goes out on email below instead). Confirmed
    // via a real send that the approved 'booking_confirmed' template has a
    // fixed 5-variable shape — AiSensy rejects a 6th param outright
    // ("Template params does not match the campaign"), so the confirmation
    // URL replaces the plain booking-id slot rather than adding a new one.
    // Still just a substituted value, not new template wording, so no new
    // Meta approval needed — same plain-text-URL pattern guest_pass/
    // waitlist_offer already use.
    await this.wa.send(input.whatsapp, 'booking_confirmed', [input.mainGuest.trim(), event.title, String(qty), `${process.env.WEB_APP_URL ?? ''}/confirmation/${encodeURIComponent(id)}`, String(total)]).catch(() => {});
    const ticketVenue = event.venueId ? await this.prisma.venue.findUnique({ where: { id: event.venueId } }) : null;
    // A guest's profile city/state/country is often blank — never asked for
    // at signup, the same gap name used to have. The event they're actually
    // booking is real evidence of where they go out, so backfill from its
    // venue (or privateCity when there's no registered venue) rather than
    // leaving it blank forever. Never overwrites an already-set value.
    if (!buyer.city && (ticketVenue?.city || event.privateCity)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          city: ticketVenue?.city ?? event.privateCity ?? '',
          state: buyer.state ?? ticketVenue?.state ?? undefined,
          country: buyer.country ?? ticketVenue?.country ?? undefined,
        },
      }).catch(() => {});
    }
    const ticketPdf = await ticketPdfBuffer(booking, event, ticketVenue).catch(() => null);
    await this.email.sendTemplate(user.email, 'booking_confirmed', {
      name: input.mainGuest.trim(), eventTitle: event.title, qty: String(qty), bookingId: id, total: moneyOrFree(total),
    }, ticketPdf ? [{ filename: `prebooze-ticket-${id.replace(/[^\w-]/g, '')}.pdf`, content: ticketPdf.toString('base64') }] : undefined).catch(() => {});
    await this.notifyOrg(event, 'booking', `New booking: ${input.mainGuest.trim()} · ${qty} ticket${qty > 1 ? 's' : ''} · ${event.title}`, '/bookings');
    await this.maybeNudgeProfileReward(userId, event.title).catch(() => {});

    // ---- invoice: GST (real GSTIN activated 2026-09-21) on the booking fee
    // only — see priceHold()'s own doc comment. gstPct/bookingGst are both 0
    // on any booking made while PlatformSettings.gstEnabled is false, so
    // this stays a plain Invoice (never "Tax Invoice") until the switch is
    // flipped. igstAmount already resolved once, in priceHold() — reused
    // here rather than re-resolving the event's state a second time. */
    if (subtotal > 0) {
      await this.invoices.create({
        type: 'booking', refId: id, role: 'guest',
        payerName: input.mainGuest.trim(), payerEmail: user.email, payerPhone: input.whatsapp,
        city: ticketVenue?.city, description: `${qty}× ${event.title}`,
        subtotal, fee, gstPct, gstAmount: bookingGst, igstAmount: bookingIgst,
        discount, walletCredit: walletCreditUsed, total,
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

    // Server-side mirror of the browser Pixel's Purchase event (see
    // Checkout.tsx's trackMeta call) — same `id` as the event_id both sides
    // use, so Meta dedupes browser+server into one event instead of
    // double-counting. Never blocks/fails a real, already-paid booking.
    this.meta
      .sendEvent(
        'Purchase',
        id,
        `https://prebooze.com/events/${event.slug}`,
        { phone: input.whatsapp, email: user.email, clientIp: reqMeta?.ip, userAgent: reqMeta?.userAgent },
        user.marketingConsent,
        { value: total, currency: 'INR', content_type: 'product', content_ids: lines.map((l) => l.tier.id), num_items: qty },
      )
      .catch(() => {});

    // A guest who earlier visited/half-filled a role onboarding page (see
    // LeadsService.captureDraft) and then just bought a ticket instead
    // isn't a real venue/organizer/promoter/lineup lead — clear any stale
    // draft left behind so they don't sit in the sales pipeline forever
    // mislabeled as an unconverted role prospect.
    this.leads.clearDraftsForGuestConversion(user.phone).catch(() => {});

    return this.prisma.booking.findUniqueOrThrow({ where: { id }, include: { event: { include: { venue: true, organizer: true } } } });
  }

  /** Staff-recorded phone orders/walk-ups/comps — bypasses the hold/QR
   * checkout session and Razorpay entirely, unlike the guest flow above.
   * Finds-or-creates the buyer by phone the same way OTP signup does (an
   * admin-onboarded customer and a later real signup on the same number
   * resolve to one account, never two). Reuses the same fee formula as
   * guest checkout (% of subtotal, no separate GST add-on charged to the
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
    // Not enforced here the way it is for guest self-checkout — staff
    // recording a real walk-up/phone order is already the real-world
    // verification (same trust level customers.service.ts's manual create()
    // already documents for phoneVerified). Purely a backfill if given.
    age?: number;
    others?: { name: string; gender?: string; whatsapp?: string }[];
    method: string;
  }) {
    if (!input.guestName?.trim() || !input.phone?.trim()) throw new BadRequestException('Guest name and phone are required');
    if (!input.qty || input.qty < 1) throw new BadRequestException('qty must be at least 1');

    const event = await this.prisma.event.findUnique({ where: { id: input.eventId }, include: { tiers: true, organizer: true } });
    if (!event) throw new NotFoundException('Event not found');
    const tier = event.tiers.find((t) => t.id === input.tierId);
    if (!tier) throw new BadRequestException('Unknown ticket tier');
    if (tier.quantity - tier.sold < input.qty) throw new BadRequestException(`Only ${tier.quantity - tier.sold} left in "${tier.name}"`);

    const phone = normalizePhone(input.phone);
    const buyer =
      (await this.prisma.user.findUnique({ where: { phone } })) ??
      (await this.prisma.user.create({
        data: { phone, name: input.guestName.trim(), gender: input.gender, age: input.age, referralCode: await uniqueReferralCodeFor(this.prisma, phone) },
      }));

    const isComp = input.method.toLowerCase().includes('comp');
    const tierPrice = effectiveTierPrice(tier, event.date);
    const subtotal = isComp ? 0 : tierPrice * input.qty;
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
    // Same as priceHold() — % of subtotal, no booking fee on a free ticket.
    const fee = isComp || tierPrice === 0 ? 0 : Math.round((subtotal * (settings?.bookingFee ?? FALLBACK_FEE_PCT)) / 100);
    // Same GST-on-the-booking-fee-only rule as priceHold() — no Invoice PDF
    // exists for a manual/door-sale booking, so this only affects the
    // ledger and the total the guest/staff-recorded buyer is actually
    // charged, not any invoice line item.
    const bookingGstPct = settings?.gstEnabled ? (settings?.gstPct ?? 0) : 0;
    const bookingGst = Math.round((fee * bookingGstPct) / 100);
    const total = subtotal + fee + bookingGst;

    const id = '#TKT-' + randomInt(10000, 99999);
    const partySize = partySizeFromTierName(tier.name);
    const guests = [
      { name: input.guestName.trim(), checkedIn: false, gender: input.gender },
      ...(input.others ?? []).slice(0, input.qty * partySize - 1).filter((o) => o.name?.trim()).map((o) => ({ name: o.name.trim(), checkedIn: false, gender: o.gender, whatsapp: o.whatsapp })),
    ];
    const qrToken = await this.jwt.signAsync({ bookingId: id }, { expiresIn: '30d' });

    const booking = await this.prisma.$transaction(async (tx) => {
      const res = await tx.ticketTier.updateMany({
        where: { id: tier.id, sold: { lte: tier.quantity - input.qty } },
        data: { sold: { increment: input.qty } },
      });
      if (res.count === 0) throw new BadRequestException(`"${tier.name}" sold out`);

      const commission = this.commissionFor(subtotal, event.commission);
      const created = await tx.booking.create({
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
          // Same free-window gating as the guest checkout path above.
          coverCharge: (tierWindowState(tier, event.date) === 'free' ? 0 : tier.coverCharge) * input.qty,
          commission,
        },
      });

      // Same backfill as the guest checkout path (BookingsService.create) —
      // an EXISTING account found by phone (the branch above only sets a
      // name/gender for a brand-new one) can still have a blank name, e.g.
      // a guest who verified OTP but never finished a booking themselves
      // before staff recorded one for them here.
      const nameUpdate = !buyer.name?.trim() ? { name: input.guestName.trim() } : {};
      const genderUpdate = !buyer.gender?.trim() && input.gender ? { gender: input.gender } : {};
      const ageUpdate = !buyer.age && input.age !== undefined ? { age: input.age } : {};
      const newUsername = !buyer.name?.trim() && PLACEHOLDER_USERNAME.test(buyer.username)
        ? await uniqueUsernameFromName(tx, input.guestName.trim(), buyer.id)
        : undefined;
      if (Object.keys(nameUpdate).length || Object.keys(genderUpdate).length || Object.keys(ageUpdate).length || newUsername) {
        await tx.user.update({ where: { id: buyer.id }, data: { ...nameUpdate, ...genderUpdate, ...ageUpdate, ...(newUsername ? { username: newUsername } : {}) } });
      }

      if (subtotal > 0) {
        if (event.hostedByVenue && event.venueId) {
          await tx.venueLedgerTx.create({
            data: { venueId: event.venueId, type: 'sale', amount: subtotal - commission, eventId: event.id, eventTitle: event.title, note: `Booking ${id} (manual)` },
          });
        } else if (event.organizerId) {
          await tx.organizerLedgerTx.create({
            data: { organizerId: event.organizerId, type: 'sale', amount: subtotal - commission, eventId: event.id, eventTitle: event.title, note: `Booking ${id} (manual)` },
          });
        }
      }
      await this.postEventLedger(tx, event.id, event.title, 'Ticket commission', 'income', commission);
      await this.postEventLedger(tx, event.id, event.title, 'Booking fees', 'income', fee);
      // No Razorpay commission here — a manual/staff booking never touches
      // Razorpay. The WhatsApp confirmation still goes out below though.
      await this.postEventLedger(tx, event.id, event.title, 'WhatsApp message charges', 'expense', Math.ceil(WHATSAPP_MSG_COST));
      return created;
    });

    await this.wa.send(phone, 'booking_confirmed', [input.guestName.trim(), event.title, String(input.qty), `${process.env.WEB_APP_URL ?? ''}/confirmation/${encodeURIComponent(id)}`, String(total)]).catch(() => {});
    const venue = event.venueId ? await this.prisma.venue.findUnique({ where: { id: event.venueId } }) : null;
    // Same backfill as the guest checkout path (BookingsService.create) —
    // a staff-recorded walk-up/comp is just as real a signal of where this
    // guest goes out.
    if (!buyer.city && (venue?.city || event.privateCity)) {
      await this.prisma.user.update({
        where: { id: buyer.id },
        data: {
          city: venue?.city ?? event.privateCity ?? '',
          state: buyer.state ?? venue?.state ?? undefined,
          country: buyer.country ?? venue?.country ?? undefined,
        },
      }).catch(() => {});
    }
    if (buyer.email) {
      const ticketPdf = await ticketPdfBuffer(booking, event, venue).catch(() => null);
      await this.email.sendTemplate(buyer.email, 'booking_confirmed', {
        name: input.guestName.trim(), eventTitle: event.title, qty: String(input.qty), bookingId: id, total: moneyOrFree(total),
      }, ticketPdf ? [{ filename: `prebooze-ticket-${id.replace(/[^\w-]/g, '')}.pdf`, content: ticketPdf.toString('base64') }] : undefined).catch(() => {});
    }
    await this.maybeNudgeProfileReward(buyer.id, event.title).catch(() => {});
    return this.prisma.booking.findUniqueOrThrow({ where: { id }, include: { event: { include: { venue: true, organizer: true } } } });
  }

  /** Shared setup for both offline-booking modes below — resolves the
   * organizer's own access, the event/tier (must belong to that organizer,
   * never another org's), and the guest (matched by phone or created fresh,
   * same trust level as adminCreate's own comment: an organizer recording a
   * real walk-up/phone/gate inquiry IS the real-world verification). */
  private async prepareOfflineBooking(userId: string, input: {
    eventId: string; tierId: string; qty: number; guestName: string; whatsapp: string; gender?: string;
  }) {
    const org = await this.orgAccess.require(userId, 'Attendees & check-in', 'edit');
    if (!input.guestName?.trim() || !input.whatsapp?.trim()) throw new BadRequestException('Guest name and WhatsApp number are required');
    if (!input.qty || input.qty < 1) throw new BadRequestException('qty must be at least 1');

    const event = await this.prisma.event.findUnique({ where: { id: input.eventId }, include: { tiers: true } });
    if (!event || event.organizerId !== org.id) throw new NotFoundException('Event not found');
    const tier = event.tiers.find((t) => t.id === input.tierId);
    if (!tier) throw new BadRequestException('Unknown ticket tier');
    if (tier.quantity - tier.sold < input.qty) throw new BadRequestException(`Only ${tier.quantity - tier.sold} left in "${tier.name}"`);

    const phone = normalizePhone(input.whatsapp);
    const guest =
      (await this.prisma.user.findUnique({ where: { phone } })) ??
      (await this.prisma.user.create({
        data: { phone, name: input.guestName.trim(), gender: input.gender, referralCode: await uniqueReferralCodeFor(this.prisma, phone) },
      }));

    return { org, event, tier, phone, guest, subtotal: effectiveTierPrice(tier, event.date) * input.qty };
  }

  /** Mode 1: the organizer already has the guest's cash/UPI in hand (a real
   * walk-up or gate sale) — booking confirms immediately on the organizer's
   * word, same trust level as adminCreate's own staff-recorded bookings.
   * The real difference from adminCreate: Prebooze never touched this
   * money, so the organizer must NOT also get a `subtotal - commission`
   * ledger credit (that would double-pay them — once in cash, once on the
   * ledger) — only the flat 2% commission posts, as a debit against
   * whatever they can withdraw next (organizer.withdraw()'s balance is a
   * bare SUM() over this same table, so this takes effect immediately,
   * no separate "settle" step). Guest still gets a real ticket/QR/WhatsApp/
   * email confirmation, identical to any other confirmed booking. */
  async createOfflineBookingSelfCollected(userId: string, input: {
    eventId: string; tierId: string; qty: number; guestName: string; whatsapp: string; gender?: string;
    others?: { name: string; gender?: string; whatsapp?: string }[];
  }) {
    const { org, event, tier, phone, guest, subtotal } = await this.prepareOfflineBooking(userId, input);
    const commission = Math.round((subtotal * OFFLINE_BOOKING_COMMISSION_PCT) / 100);

    const id = '#TKT-' + randomInt(10000, 99999);
    const partySize = partySizeFromTierName(tier.name);
    const guests = [
      { name: input.guestName.trim(), checkedIn: false, gender: input.gender },
      ...(input.others ?? []).slice(0, input.qty * partySize - 1).filter((o) => o.name?.trim()).map((o) => ({ name: o.name.trim(), checkedIn: false, gender: o.gender, whatsapp: o.whatsapp })),
    ];
    const qrToken = await this.jwt.signAsync({ bookingId: id }, { expiresIn: '30d' });

    const booking = await this.prisma.$transaction(async (tx) => {
      const res = await tx.ticketTier.updateMany({
        where: { id: tier.id, sold: { lte: tier.quantity - input.qty } },
        data: { sold: { increment: input.qty } },
      });
      if (res.count === 0) throw new BadRequestException(`"${tier.name}" sold out`);

      const created = await tx.booking.create({
        data: {
          id, userId: guest.id, eventId: event.id,
          tierName: `${input.qty}× ${tier.name}`,
          tierBreakdown: { [tier.id]: input.qty } as Prisma.InputJsonValue,
          qty: input.qty, subtotal, fee: 0, total: subtotal,
          guests: guests as unknown as Prisma.InputJsonValue,
          mainGuest: input.guestName.trim(), whatsapp: phone,
          paymentMethod: 'Offline (self-collected)',
          bookingSource: 'offline', offlinePaymentMode: 'self_collected',
          qrToken, commission,
          coverCharge: (tierWindowState(tier, event.date) === 'free' ? 0 : tier.coverCharge) * input.qty,
        },
      });

      const nameUpdate = !guest.name?.trim() ? { name: input.guestName.trim() } : {};
      const genderUpdate = !guest.gender?.trim() && input.gender ? { gender: input.gender } : {};
      const newUsername = !guest.name?.trim() && PLACEHOLDER_USERNAME.test(guest.username)
        ? await uniqueUsernameFromName(tx, input.guestName.trim(), guest.id)
        : undefined;
      if (Object.keys(nameUpdate).length || Object.keys(genderUpdate).length || newUsername) {
        await tx.user.update({ where: { id: guest.id }, data: { ...nameUpdate, ...genderUpdate, ...(newUsername ? { username: newUsername } : {}) } });
      }

      // No `sale` ledger credit here — deliberately. The organizer already
      // has this guest's money in hand; crediting subtotal-commission on
      // top of that would double-pay them. Only what they owe Prebooze
      // posts, as a debit against their next withdrawal.
      if (commission > 0) {
        await tx.organizerLedgerTx.create({
          data: {
            organizerId: org.id, type: 'offline_commission', amount: -commission, eventId: event.id, eventTitle: event.title,
            bookingId: id, note: `Offline booking ${id} — ${input.guestName.trim()} paid ₹${subtotal} directly, Prebooze 2% = ₹${commission}`,
          },
        });
      }
      await this.postEventLedger(tx, event.id, event.title, 'Ticket commission', 'income', commission);
      return created;
    });

    await this.sendOfflineBookingConfirmation(booking, event, guest, input.guestName.trim(), input.qty, subtotal, id);
    return this.prisma.booking.findUniqueOrThrow({ where: { id }, include: { event: { include: { venue: true, organizer: true } } } });
  }

  /** Mode 2: the guest pays PhonePe directly via a link the organizer sends
   * over WhatsApp — genuinely the same money-flow as a normal online
   * booking (Prebooze's gateway receives it), so this reuses the exact
   * same hold->cart->PhonePe->webhook pipeline every guest self-checkout
   * already goes through (HoldsService.create, PhonePeService.createOrder,
   * reconcilePhonePePayment). The booking itself isn't created here — only
   * once the real payment lands, same as any other checkout; see
   * finalizeOfflineLinkBooking, invoked from reconcilePhonePePayment. */
  async createOfflineBookingPaymentLink(userId: string, input: {
    eventId: string; tierId: string; qty: number; guestName: string; whatsapp: string; gender?: string;
    others?: { name: string; gender?: string; whatsapp?: string }[];
  }) {
    const { org, event, tier, phone, guest, subtotal } = await this.prepareOfflineBooking(userId, input);
    if (subtotal <= 0) throw new BadRequestException('This tier is free — use "self-collected" instead, no payment link needed');

    const { holdId } = await this.holds.create(guest.id, event.id, { [tier.id]: input.qty });
    const merchantOrderId = `${holdId}-${randomBytes(6).toString('hex')}`;
    const returnUrl = `${process.env.WEB_APP_URL || 'https://prebooze.com'}/pay/complete?holdId=${encodeURIComponent(holdId)}`;

    await this.prisma.cart.updateMany({
      where: { holdId },
      data: {
        phonepeMerchantOrderId: merchantOrderId,
        bookingPayload: {
          mainGuest: input.guestName.trim(),
          mainGuestGender: input.gender ?? null,
          whatsapp: phone,
          guests: input.others ?? [],
          // Marks this cart for finalizeOfflineLinkBooking instead of the
          // normal create() path — see reconcilePhonePePayment's branch.
          isOfflineOrgBooking: true,
          offlineOrganizerId: org.id,
        } as Prisma.InputJsonValue,
      },
    });

    const order = await this.phonepe.createOrder(merchantOrderId, subtotal * 100, returnUrl);
    // New campaign, not yet submitted for AiSensy/Meta approval — will
    // 400 ("Campaign does not exist") until that's done, same situation
    // every previous new campaign started in (see WhatsappService's own
    // sendLeadOnboardingInvite doc comment). Swallowed, same as every other
    // WhatsApp send here — never blocks the real booking/payment flow.
    await this.wa.send(phone, 'offline_payment_link', [input.guestName.trim(), event.title, order.redirectUrl]).catch(() => {});

    return { holdId, redirectUrl: order.redirectUrl, subtotal, phone };
  }

  /** The real webhook-confirmed counterpart to createOfflineBookingPaymentLink
   * above — invoked from reconcilePhonePePayment once PhonePe reports this
   * order COMPLETED. Unlike self-collected mode, Prebooze genuinely
   * received this money, so the organizer IS credited subtotal-commission
   * on the ledger, exactly like a normal online sale — only the commission
   * rate (flat 2%, not event.commission) and the bookingSource/
   * offlinePaymentMode tags differ from an ordinary guest checkout. */
  private async finalizeOfflineLinkBooking(
    cart: { holdId: string; userId: string; eventId: string; qtyMap: unknown },
    merchantOrderId: string,
    amountPaise: number,
    payload: { mainGuest: string; mainGuestGender?: string | null; whatsapp: string; guests?: { name: string; gender?: string; whatsapp?: string }[]; offlineOrganizerId: string },
  ) {
    const event = await this.prisma.event.findUnique({ where: { id: cart.eventId }, include: { tiers: true } });
    if (!event) return;
    const qtyMap = cart.qtyMap as Record<string, number>;
    const [tierId, qty] = Object.entries(qtyMap)[0] ?? [];
    const tier = tierId ? event.tiers.find((t) => t.id === tierId) : undefined;
    if (!tier || !qty) {
      await this.staffAlerts.alert(`⚠ Offline payment-link order ${merchantOrderId} completed but its tier/qty couldn't be resolved. Needs manual recovery.`).catch(() => {});
      return;
    }

    const subtotal = Math.round(amountPaise / 100);
    const commission = Math.round((subtotal * OFFLINE_BOOKING_COMMISSION_PCT) / 100);
    const id = '#TKT-' + randomInt(10000, 99999);
    const guests = [
      { name: payload.mainGuest, checkedIn: false, gender: payload.mainGuestGender ?? undefined },
      ...(payload.guests ?? []).filter((g) => g.name?.trim()).map((g) => ({ name: g.name.trim(), checkedIn: false, gender: g.gender, whatsapp: g.whatsapp })),
    ];
    const qrToken = await this.jwt.signAsync({ bookingId: id }, { expiresIn: '30d' });
    const paymentMethodResult = await this.phonepe.getPaymentMethod(merchantOrderId).catch(() => null);

    const booking = await this.prisma.$transaction(async (tx) => {
      const res = await tx.ticketTier.updateMany({ where: { id: tier.id, sold: { lte: tier.quantity - qty } }, data: { sold: { increment: qty } } });
      if (res.count === 0) throw new Error(`"${tier.name}" sold out`);

      const created = await tx.booking.create({
        data: {
          id, userId: cart.userId, eventId: event.id,
          tierName: `${qty}× ${tier.name}`,
          tierBreakdown: { [tier.id]: qty } as Prisma.InputJsonValue,
          qty, subtotal, fee: 0, total: subtotal,
          guests: guests as unknown as Prisma.InputJsonValue,
          mainGuest: payload.mainGuest, whatsapp: payload.whatsapp,
          paymentId: merchantOrderId, paymentMethod: paymentMethodResult?.method,
          bookingSource: 'offline', offlinePaymentMode: 'payment_link',
          qrToken, commission,
          coverCharge: (tierWindowState(tier, event.date) === 'free' ? 0 : tier.coverCharge) * qty,
        },
      });
      await tx.cart.updateMany({ where: { holdId: cart.holdId }, data: { status: 'completed' } });

      // Real money this time — Prebooze received it via the gateway, so the
      // organizer is credited the normal way, just at the flat offline rate.
      await tx.organizerLedgerTx.create({
        data: {
          organizerId: payload.offlineOrganizerId, type: 'sale', amount: subtotal - commission,
          eventId: event.id, eventTitle: event.title, bookingId: id, note: `Offline booking ${id} (payment link)`,
        },
      });
      await this.postEventLedger(tx, event.id, event.title, 'Ticket commission', 'income', commission);
      return created;
    });

    const guestUser = await this.prisma.user.findUnique({ where: { id: cart.userId } });
    await this.sendOfflineBookingConfirmation(booking, event, guestUser, payload.mainGuest, qty, subtotal, id);
  }

  /** Shared confirmation send for both offline modes — identical shape to
   * create()/adminCreate()'s own WhatsApp+email+PDF send, so the guest's
   * experience is exactly the same as any other confirmed booking, per the
   * feature's own requirement. */
  private async sendOfflineBookingConfirmation(
    booking: Booking, event: { id: string; title: string; venueId: string | null; privateCity: string | null },
    guest: { id: string; email: string | null; city: string | null; state: string | null; country: string | null } | null,
    guestName: string, qty: number, total: number, id: string,
  ) {
    await this.wa.send(booking.whatsapp, 'booking_confirmed', [guestName, event.title, String(qty), `${process.env.WEB_APP_URL ?? ''}/confirmation/${encodeURIComponent(id)}`, String(total)]).catch(() => {});
    const venue = event.venueId ? await this.prisma.venue.findUnique({ where: { id: event.venueId } }) : null;
    if (guest && !guest.city && (venue?.city || event.privateCity)) {
      await this.prisma.user.update({
        where: { id: guest.id },
        data: { city: venue?.city ?? event.privateCity ?? '', state: guest.state ?? venue?.state ?? undefined, country: guest.country ?? venue?.country ?? undefined },
      }).catch(() => {});
    }
    if (guest?.email) {
      const fullEvent = await this.prisma.event.findUnique({ where: { id: event.id }, include: { venue: true } });
      const ticketPdf = fullEvent ? await ticketPdfBuffer(booking, fullEvent, venue).catch(() => null) : null;
      await this.email.sendTemplate(guest.email, 'booking_confirmed', {
        name: guestName, eventTitle: event.title, qty: String(qty), bookingId: id, total: moneyOrFree(total),
      }, ticketPdf ? [{ filename: `prebooze-ticket-${id.replace(/[^\w-]/g, '')}.pdf`, content: ticketPdf.toString('base64') }] : undefined).catch(() => {});
    }
  }

  /** "Offline booking charges" — what Prebooze has charged this organizer
   * for self-collected offline bookings, per booking (guest paid X,
   * Prebooze's 2% is Y). Payment-link bookings aren't listed here — those
   * already show as normal `sale` ledger rows, since Prebooze genuinely
   * processed that payment. */
  async offlineCharges(userId: string) {
    const org = await this.orgAccess.require(userId, 'Attendees & check-in', 'view');
    const charges = await this.prisma.organizerLedgerTx.findMany({
      where: { organizerId: org.id, type: 'offline_commission' },
      orderBy: { createdAt: 'desc' },
    });
    const bookingIds = charges.map((c) => c.bookingId).filter((id): id is string => !!id);
    const bookings = await this.prisma.booking.findMany({ where: { id: { in: bookingIds } }, select: { id: true, mainGuest: true, subtotal: true, createdAt: true } });
    const bookingById = new Map(bookings.map((b) => [b.id, b]));
    return charges.map((c) => {
      const b = c.bookingId ? bookingById.get(c.bookingId) : undefined;
      return {
        id: c.id, bookingId: c.bookingId, eventTitle: c.eventTitle,
        guestName: b?.mainGuest ?? null, guestPaid: b?.subtotal ?? null,
        commissionCharged: -c.amount, createdAt: c.createdAt,
      };
    });
  }

  /** Event + tier picker for the offline-booking modal — gated on the same
   * 'Attendees & check-in' permission as actually creating one (not 'Events
   * & wizard'), since staff who can take a walk-up booking often can't edit
   * the event itself; using organizer.events()'s stricter check here 403'd
   * for exactly that staff and surfaced as "Could not load your events". */
  async offlineBookingEvents(userId: string) {
    const org = await this.orgAccess.require(userId, 'Attendees & check-in', 'view');
    return this.prisma.event.findMany({
      where: { OR: [{ organizerId: org.id }, { collaboratorOrganizerIds: { has: org.id } }] },
      include: { tiers: true, venue: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async list(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: { event: { include: { venue: true, organizer: true } } },
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
    await this.wa.send(booking.whatsapp, 'booking_confirmed', [booking.mainGuest, booking.event.title, String(booking.qty), `${process.env.WEB_APP_URL ?? ''}/confirmation/${encodeURIComponent(booking.id)}`, String(booking.total)]);
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
      // Told upfront what they'll actually get, not the gross total —
      // matches what finalizeRefund() actually sends on approval.
      const expected = Math.max(0, booking.total - this.refundDeductionFor(booking, 'source'));
      await this.wa.send(user.phone, 'refund_requested', [id, String(expected)]).catch(() => {});
      await this.email.sendTemplate(user.email, 'refund_requested', {
        name: user.name, bookingId: id, amount: money(expected),
      }).catch(() => {});
      const event = await this.prisma.event.findUnique({ where: { id: booking.eventId }, select: { title: true } });
      if (event) await this.postEventLedger(this.prisma, booking.eventId, event.title, 'WhatsApp message charges', 'expense', Math.ceil(WHATSAPP_MSG_COST));
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
    // What the guest actually gets back — not booking.total. See
    // refundDeductionFor's doc comment for what this withholds and why.
    const deduction = this.refundDeductionFor(booking, refundTo);
    const refundAmount = Math.max(0, booking.total - deduction);
    // Fetched once, outside the transaction — reused below for the
    // post-transaction WhatsApp-charge postings, which can't reuse `tx`
    // since they only fire after the transaction has already committed
    // (the 'source' one is also conditional on the real Razorpay call
    // succeeding, which isn't known until after that point).
    const event = await this.prisma.event.findUnique({ where: { id: booking.eventId }, select: { organizerId: true, hostedByVenue: true, venueId: true, title: true } });

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id }, data: { status: 'refunded', refundedTo: refundTo } });

      // restore inventory per tier so the freed spot is real, not just cosmetic
      const breakdown = booking.tierBreakdown as Record<string, number>;
      for (const [tierId, n] of Object.entries(breakdown)) {
        await tx.ticketTier.update({ where: { id: tierId }, data: { sold: { decrement: n } } });
      }

      if (refundTo === 'wallet') {
        await tx.walletTx.create({
          data: { userId, type: 'refund', amount: refundAmount, note: `Instant refund — booking ${id}` },
        });
      }

      // reverse the organizer's (or venue's) earnings credit from the
      // original sale — same subtotal-minus-commission the original
      // booking credited them. Uses booking.commission (locked in at sale
      // time), not a fresh read of Event.commission — a later admin edit to
      // the event's commission % must never change what an already-sold,
      // already-refunded booking reverses. Real bug found 2026-08-27: this
      // used to recompute from the event's current setting, which silently
      // unbalanced the finance ledger whenever commission % changed between
      // a sale and its later refund.
      const commission = booking.commission;
      if (event) {
        if (event.hostedByVenue && event.venueId) {
          await tx.venueLedgerTx.create({
            data: { venueId: event.venueId, type: 'refund', amount: -(booking.subtotal - commission), eventId: booking.eventId, eventTitle: event.title, note: `Refund — booking ${id}` },
          });
        } else if (event.organizerId && booking.bookingSource === 'offline' && booking.offlinePaymentMode === 'self_collected') {
          // Real bug found 2026-09-24: a self-collected offline booking never
          // credited the organizer a 'sale' in the first place (they already
          // held the guest's cash/UPI directly) — only the flat 2%
          // `offline_commission` debit was posted. Reusing the generic
          // -(subtotal - commission) reversal here would phantom-debit the
          // organizer for money Prebooze never gave them. The correct
          // reversal is to give back the commission that was charged, since
          // the booking (and Prebooze's claim to that commission) is void.
          await tx.organizerLedgerTx.create({
            data: { organizerId: event.organizerId, type: 'refund', amount: commission, eventId: booking.eventId, eventTitle: event.title, bookingId: id, note: `Refund — offline booking ${id} (commission reversed)` },
          });
        } else if (event.organizerId) {
          await tx.organizerLedgerTx.create({
            data: { organizerId: event.organizerId, type: 'refund', amount: -(booking.subtotal - commission), eventId: booking.eventId, eventTitle: event.title, note: `Refund — booking ${id}` },
          });
        }
      }

      // reverse the platform's own income the same way — the refund gives
      // back the fee+commission revenue in full (gross, not netted against
      // `deduction`): the gateway-fee/WhatsApp costs `deduction` withholds
      // have their own explicit "Razorpay commission"/"WhatsApp message
      // charges" expense lines (the former only ever posted for a real
      // Razorpay sale — PhonePe UPI carries no fee to record, so a
      // PhonePe booking's deduction is WhatsApp-only) — posted at sale
      // time, and again below for the extra
      // refund-time WhatsApp sends) — netting them in here too would count
      // the same real cost twice. Recorded as a separate "Refund losses"
      // expense (aggregated per event, same as the income side) rather than
      // netted directly against the income categories, so gross income and
      // gross refunds both stay visible.
      if (event) {
        await this.postEventLedger(tx, booking.eventId, event.title, 'Refund losses', 'expense', booking.fee + commission);
      }
    });

    // Real gap (2026-09-24) — see notifyOrg's own comment. Fires right
    // after the ledger reversal above actually lands, since that's the
    // moment the organizer's real earnings decreased, not just when the
    // guest requested it.
    if (event) await this.notifyOrg(event, 'refund', `Refund processed — booking ${id} · ${money(refundAmount)}`, '/transactions');

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (refundTo === 'wallet') {
      await this.wa.send(user.phone, 'refund_wallet', [id, String(refundAmount)]).catch(() => {});
      await this.email.sendTemplate(user.email, 'refund_processed', {
        name: user.name, bookingId: id, amount: money(refundAmount),
        refundNote: 'to your Prebooze wallet — ready to use instantly.',
      }).catch(() => {});
      if (event) await this.postEventLedger(this.prisma, booking.eventId, event.title, 'WhatsApp message charges', 'expense', Math.ceil(WHATSAPP_MSG_COST));
    } else {
      // Inventory/ledger reversal above is already committed and correct
      // (the seat really is freed) regardless of what happens here — this
      // is only the actual money movement back to the guest. Real
      // 2026-08-14 incident: this used to be `.catch(() => {})`'d away
      // silently, so a real guest was told their refund was on its way
      // and it never was, for ~13 days before anyone noticed.
      let refundSucceeded = false;
      let gatewayRefundId: string | null = null;
      if (booking.paymentId) {
        try {
          gatewayRefundId = await this.refundViaGateway(booking.paymentId, refundAmount * 100);
          refundSucceeded = true;
        } catch {
          // fall through — refundSucceeded stays false
        }
      }
      if (refundSucceeded) {
        // Gateway accepted the refund call, but that's only "INITIATED" —
        // PhonePe refunds settle async, same as a payment does. The real
        // COMPLETED/FAILED terminal state comes later via the pg.refund.*
        // webhook (see PhonePeWebhookController), which is what actually
        // clears refundFailedAt / confirms to the guest. Telling the guest
        // "processed" here, before that confirmation, repeats exactly the
        // false-positive this whole flow exists to avoid — so the
        // guest-facing email/WhatsApp now wait for the webhook too.
        await this.prisma.booking.update({ where: { id }, data: { refundGatewayState: 'INITIATED', refundGatewayRefundId: gatewayRefundId } });
        if (event) await this.postEventLedger(this.prisma, booking.eventId, event.title, 'WhatsApp message charges', 'expense', Math.ceil(WHATSAPP_MSG_COST));
      } else {
        // Never tell the guest it's on its way when it isn't — flag it for
        // a human to retry (BookingsService.retryRefund) instead.
        await this.prisma.booking.update({ where: { id }, data: { refundFailedAt: new Date(), refundGatewayState: 'FAILED' } });
        await this.staffAlerts
          .alert(`⚠ Refund to original payment method FAILED for booking ${id} (₹${refundAmount}, ${user.name}) — payment ${booking.paymentId ?? 'none on file'}. The booking is marked refunded (seat already freed) but the guest has NOT actually been paid back. Retry from Booking detail.`)
          .catch(() => {});
      }
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

  /** Staff-only — re-attempts *only* the real Razorpay refund call for a
   * booking whose refundFailedAt is set (finalizeRefund already committed
   * the inventory restore and ledger reversal the first time; re-running
   * that whole flow here would double-apply both). Throws straight through
   * on a second failure — no silent catch this time, so staff sees a real
   * error immediately instead of a false "done". */
  async retryRefund(id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'refunded' || booking.refundedTo !== 'source') {
      throw new BadRequestException('This booking has no refund-to-source to retry');
    }
    if (!booking.refundFailedAt) throw new BadRequestException("This refund didn't fail — nothing to retry");
    // A real refund may already be in flight or done — either from this
    // exact flow's own prior attempt, or initiated directly on the gateway
    // dashboard outside this system entirely (see adminRecordExternalRefund
    // below) — real 2026-09-23 incident this guards against: retrying here
    // would fire a second, duplicate real refund against the same booking.
    if (booking.refundGatewayState === 'INITIATED' || booking.refundGatewayState === 'COMPLETED') {
      throw new BadRequestException(`A refund is already ${booking.refundGatewayState === 'INITIATED' ? 'in progress' : 'completed'} on the gateway — check its real status instead of retrying`);
    }
    if (!booking.paymentId) throw new BadRequestException('No payment on file for this booking — this refund must be issued manually outside Razorpay');

    // Same deduction finalizeRefund() already applied the first time —
    // recomputed here rather than stored, since it's deterministic off
    // booking.total/paymentId and this only ever retries a 'source' refund.
    const refundAmount = Math.max(0, booking.total - this.refundDeductionFor(booking, 'source'));
    const gatewayRefundId = await this.refundViaGateway(booking.paymentId, refundAmount * 100);
    // Same reasoning as finalizeRefund's own success branch — accepted by
    // the gateway is "INITIATED," not "done." refundFailedAt stays set
    // until the real pg.refund.completed webhook clears it.
    await this.prisma.booking.update({ where: { id }, data: { refundGatewayState: 'INITIATED', refundGatewayRefundId: gatewayRefundId } });
    return { ok: true };
  }

  /** Records a refund that was initiated directly on the PhonePe merchant
   * dashboard, outside this app entirely — real 2026-09-23 case: our own
   * Refund Status/Create API calls were returning 401 AUTHORIZATION_FAILED
   * (a gateway-account scoping issue, not something this app can fix), so
   * staff issued the refund manually from PhonePe's own dashboard instead.
   * This doesn't call any gateway API itself — it only tells this system
   * "treat this as in flight," which is what actually stops
   * `retryRefund` from firing a second, duplicate refund on top of it.
   * The real terminal state still only ever comes from the pg.refund.*
   * webhook, same as every other refund. */
  async adminRecordExternalRefund(id: string, refundId: string, amount?: number) {
    if (!refundId?.trim()) throw new BadRequestException('Refund ID is required');
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    return this.prisma.booking.update({
      where: { id },
      data: {
        refundGatewayState: 'INITIATED',
        refundGatewayRefundId: refundId.trim(),
        refundGatewayAmount: amount && amount > 0 ? Math.round(amount) : booking.refundGatewayAmount,
      },
    });
  }

  /** Staff-triggered live check against PhonePe's own Refund Status API —
   * "Refresh status" in the admin UI. Previously that button only re-read
   * our own DB (no-op unless a webhook had already landed), which looked
   * like it did nothing — this actually calls the gateway. Real 2026-09-23
   * account-level gap: this call currently 401s (AUTHORIZATION_FAILED) for
   * every refund on this merchant account while Order Status calls work
   * fine on the same credentials — surfaced to the caller as a real error
   * rather than swallowed, so staff see "still can't verify automatically"
   * instead of silence. If PhonePe ever resolves the account-level gap,
   * this starts working with no code change needed. */
  async adminCheckRefundStatus(id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!booking.refundGatewayRefundId) throw new BadRequestException('No gateway refund ID on file for this booking to check');

    let status: Awaited<ReturnType<typeof this.phonepe.getRefundStatus>>;
    try {
      status = await this.phonepe.getRefundStatus(booking.refundGatewayRefundId);
    } catch (e) {
      // Same lesson as the resendWhatsapp fix (2026-08-14 incident) — a raw
      // gateway SDK error isn't a NestJS HttpException, so letting it
      // propagate turns into an opaque 500 instead of a real message. Real
      // 2026-09-23 case this surfaces: PhonePe returning 401
      // AUTHORIZATION_FAILED for every Refund API call on this merchant
      // account (Order Status calls work fine on the same credentials) —
      // an account-level gap on PhonePe's side, not something retrying fixes.
      const code = (e as { code?: string })?.code;
      const message = (e as Error)?.message || 'unknown error';
      throw new BadRequestException(`PhonePe: ${code ? `${code} — ` : ''}${message}`);
    }
    if (!status) throw new BadRequestException('PhonePe has no record of this refund ID');

    const amount = Math.round(status.amount / 100);
    // Normalized to this app's own three-value vocabulary — PhonePe's real
    // API uses its own state strings (e.g. PENDING/CONFIRMED, not
    // INITIATED) that don't necessarily match what its dashboard UI shows;
    // only COMPLETED/FAILED are ever treated as terminal.
    const normalizedState = status.state === 'COMPLETED' ? 'COMPLETED' : status.state === 'FAILED' ? 'FAILED' : 'INITIATED';
    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        refundGatewayState: normalizedState,
        refundGatewayAmount: amount > 0 ? amount : booking.refundGatewayAmount,
        refundFailedAt: normalizedState === 'COMPLETED' ? null : normalizedState === 'FAILED' ? new Date() : booking.refundFailedAt,
      },
    });

    // Same confirmation the webhook path sends — a live status check that
    // reveals COMPLETED is just as real a confirmation as the webhook
    // itself, and shouldn't leave the guest without their email just
    // because staff found out first.
    if (normalizedState === 'COMPLETED' && booking.refundGatewayState !== 'COMPLETED') {
      const user = await this.prisma.user.findUnique({ where: { id: booking.userId } });
      if (user) {
        await this.wa.send(user.phone, 'refund_source', [id, String(amount)]).catch(() => {});
        await this.email.sendTemplate(user.email, 'refund_processed', {
          name: user.name, bookingId: id, amount: money(amount),
          refundNote: 'to your original payment method — usually 5–7 business days to reflect.',
        }).catch(() => {});
      }
    }
    return updated;
  }

  /** Routes a refund to whichever gateway actually processed the original
   * payment — needed during and after the PhonePe cutover, since bookings
   * made before it still carry a real Razorpay `pay_...` id in
   * `Booking.paymentId` and must keep refunding through Razorpay, while
   * every booking made after carries a PhonePe merchantOrderId (a bare hex
   * string, no prefix — see HoldsService.create) and refunds through
   * PhonePe. `merchantRefundId` is a fresh id per attempt (not reused
   * across a real refund + a later retry of a failed one), since PhonePe
   * requires a distinct id per refund attempt even against the same order. */
  private async refundViaGateway(paymentId: string, amountPaise: number): Promise<string | null> {
    if (paymentId.startsWith('pay_')) {
      await this.razorpay.refund(paymentId, amountPaise);
      return null;
    }
    const merchantRefundId = `rfnd-${randomBytes(8).toString('hex')}`;
    const res = await this.phonepe.refund(merchantRefundId, paymentId, amountPaise);
    return res.refundId;
  }

  /** Daily cron (CronService.razorpayFeeReconcileTick) — the "Razorpay
   * commission" ledger entry is posted at sale time using a flat 2.36%
   * estimate (see RAZORPAY_FEE_PCT), since the real fee isn't always known
   * yet at that exact moment. Once Razorpay's finalized it, this replaces
   * the estimate with the real number by adjusting the ledger for just the
   * difference — never re-posting the full amount, which would double it.
   * razorpayFeeReconciled gates each booking to exactly one adjustment.
   * Post-cutover bookings carry a PhonePe merchantOrderId, not a Razorpay
   * `pay_...` id — explicitly excluded here rather than let Razorpay's API
   * 404 on an id it never issued. PhonePe's own fee reconciliation (if
   * needed) is a separate follow-up, not this cron. */
  async reconcileRazorpayFees() {
    if (!this.razorpay.live) return { reconciled: 0 };
    const candidates = await this.prisma.booking.findMany({
      where: { razorpayFeeReconciled: false, paymentId: { startsWith: 'pay_' } },
      include: { event: { select: { id: true, title: true } } },
    });
    let reconciled = 0;
    for (const b of candidates) {
      if (!b.event || !b.paymentId) continue;
      const realFee = await this.razorpay.getPaymentFee(b.paymentId);
      if (realFee === null) continue; // not finalized yet, or a dev-fake payment — try again next tick
      const estimated = Math.round(b.total * (RAZORPAY_FEE_PCT / 100));
      const delta = realFee - estimated;
      if (delta !== 0) {
        await this.prisma.ledgerEntry.upsert({
          where: { eventId_category: { eventId: b.event.id, category: 'Razorpay commission' } },
          create: { kind: 'expense', category: 'Razorpay commission', amount: Math.max(0, realFee), note: b.event.title, eventId: b.event.id, auto: true },
          update: { amount: { increment: delta } },
        });
      }
      await this.prisma.booking.update({ where: { id: b.id }, data: { razorpayFeeReconciled: true } });
      reconciled++;
    }
    return { reconciled };
  }

  // ---------- admin: bookings list/detail ----------
  async adminList(status?: string, userId?: string) {
    return this.prisma.booking.findMany({
      where: { ...(status ? { status: status as never } : {}), ...(userId ? { userId } : {}) },
      include: { user: { select: { name: true, phone: true } }, event: { select: { id: true, title: true, date: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminGet(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { user: { select: { name: true, phone: true } }, event: { include: { venue: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    // promoterRef is a bare slug, not a Prisma relation (see schema.prisma —
    // Booking.promoterRef joins against Promoter.slug, same convention
    // KycService's newPromoterRow comment documents) — a second lookup, only
    // when actually set, rather than an unconditional join every other
    // booking would pay for nothing.
    const promoter = booking.promoterRef
      ? await this.prisma.promoter.findUnique({ where: { slug: booking.promoterRef }, select: { id: true, name: true, slug: true } })
      : null;
    // Only meaningful once a refund's been attempted — what retryRefund()
    // will actually send is booking.total minus refundDeductionFor's cut,
    // not the gross total. Surfaced so a failed-refund banner shows staff
    // the real pending amount instead of the pre-deduction figure.
    const pendingRefundAmount = booking.refundFailedAt ? Math.max(0, booking.total - this.refundDeductionFor(booking, 'source')) : undefined;
    return { ...booking, promoter, pendingRefundAmount };
  }

  /** Staff-triggered — the real Prebooze-branded email + PDF ticket, same
   * template create() sends at purchase time, for a guest who says they
   * never got it. Unlike the WhatsApp "resend" button on this same page
   * (a wa.me deep link staff sends from their own number), this actually
   * calls the backend send path, so it needs its own admin-only method —
   * no ownership check, since it's staff acting on the guest's behalf. */
  async adminResendEmail(id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { event: { include: { organizer: true } }, user: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!booking.user.email) throw new BadRequestException('This guest has no email on file');
    const ticketVenue = booking.event.venueId ? await this.prisma.venue.findUnique({ where: { id: booking.event.venueId } }) : null;
    const ticketPdf = await ticketPdfBuffer(booking, booking.event, ticketVenue).catch(() => null);
    await this.email.sendTemplate(booking.user.email, 'booking_confirmed', {
      name: booking.mainGuest, eventTitle: booking.event.title, qty: String(booking.qty), bookingId: id, total: moneyOrFree(booking.total),
    }, ticketPdf ? [{ filename: `prebooze-ticket-${id.replace(/[^\w-]/g, '')}.pdf`, content: ticketPdf.toString('base64') }] : undefined);
    return { ok: true };
  }

  async adminSetNote(id: string, note: string) {
    const booking = await this.prisma.booking.update({ where: { id }, data: { adminNote: note.trim() || null } }).catch(() => null);
    if (!booking) throw new NotFoundException('Booking not found');
    return { ok: true };
  }

  /** Staff-editable guest list — for a booking that only ever captured the
   * main attendee's name (e.g. a Couple/Group ticket booked before the
   * per-attendee name requirement existed, or a guest who confirmed the
   * other names on a call after the fact). The main attendee (index 0,
   * mainGuest) is never touched here; `extraGuests` fully replaces
   * everything after it. Same array a booking's QR caption, ticket PDF and
   * organizer/venue attendee lists already read `guests.length`/`guests`
   * from, so this is the one place that needs editing — nothing else to
   * "sync" separately. Existing extra guests keep their checked-in state
   * when their name is unchanged at the same position; anything genuinely
   * new starts unchecked. */
  async adminSetGuests(id: string, extraGuests: { name: string; gender?: string; whatsapp?: string }[]) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    const existing = (booking.guests as unknown as { name: string; checkedIn: boolean; gender?: string; whatsapp?: string }[]) ?? [];
    const mainEntry = existing[0] ?? { name: booking.mainGuest, checkedIn: false };
    const guests = [
      mainEntry,
      ...extraGuests
        .filter((g) => g.name?.trim())
        .map((g, i) => {
          const prev = existing[i + 1];
          const checkedIn = !!prev && prev.name.trim().toLowerCase() === g.name.trim().toLowerCase() && !!prev.checkedIn;
          return { name: g.name.trim(), checkedIn, gender: g.gender || undefined, whatsapp: g.whatsapp?.trim() || undefined };
        }),
    ];
    await this.prisma.booking.update({ where: { id }, data: { guests: guests as unknown as Prisma.InputJsonValue } });
    return { ok: true, guests };
  }

  /** `scannerUserId` is whoever is operating the scanner (the organizer's
   * own JWT — same auth mechanism as a guest's, since an approved organizer
   * is still just a User row with role='organizer'). Previously this had no
   * ownership check at all: any authenticated JWT holder who got hold of a
   * valid token could check in a booking on any organizer's event. Now it's
   * scoped the same way every other gate-ops endpoint is (see
   * OrganizerService.myEvent) — must be the organizer who owns the event, OR
   * — for a venue-hosted event (Event.hostedByVenue) — the venue that hosts
   * it, via the same User.venueId lookup VenueService.myVenue uses. */
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
    const isOrganizerOwner = !!scannerOrg && scannerOrg.id === booking.event.organizerId;
    let isVenueOwner = false;
    if (!isOrganizerOwner && booking.event.hostedByVenue && booking.event.venueId) {
      const scannerUser = await this.prisma.user.findUnique({ where: { id: scannerUserId } });
      isVenueOwner = !!scannerUser?.venueId && scannerUser.venueId === booking.event.venueId;
    }
    if (!isOrganizerOwner && !isVenueOwner) {
      await this.logCheckIn({ ok: false, reason: 'scanned by an organizer/venue who does not own this event', eventId: booking.eventId, bookingId: booking.id });
      throw new ForbiddenException('This ticket is for a different event than the one you manage');
    }
    if (booking.status !== 'confirmed') {
      await this.logCheckIn({ ok: false, reason: `ticket is ${booking.status}, not valid for entry`, eventId: booking.eventId, bookingId: booking.id, guestName: booking.mainGuest, tierName: booking.tierName });
      throw new BadRequestException(`Ticket is ${booking.status}, not valid for entry`);
    }
    // Real gap (2026-09-24, extended from Live Monitor's manual check-in to
    // this camera/QR path too — organizer explicitly asked for both): a
    // multi-day event (Event.seriesEndDate set) permanently blocked
    // re-scanning a guest's QR on day 2/3 — checkedIn was a lifetime-once
    // flag with no day awareness. checkedInAt not being from *today* now
    // means "not checked in yet today," letting the scan through instead
    // of rejecting — single-day events keep the exact original
    // always-reject behavior. Same isSameCalendarDay helper as
    // LiveMonitorService.manualCheckIn (see its own comment) — CheckInLog's
    // append-only history is what preserves each earlier day's real
    // attendance record even though checkedInAt itself only ever holds the
    // latest day's stamp.
    const alreadyToday = booking.checkedIn && (!booking.event.seriesEndDate || istDateKey(booking.checkedInAt!) === istDateKey(new Date()));
    if (alreadyToday) {
      await this.logCheckIn({ ok: false, reason: `duplicate QR — already scanned ${booking.checkedInAt?.toISOString()}`, eventId: booking.eventId, bookingId: booking.id, guestName: booking.mainGuest, tierName: booking.tierName });
      throw new BadRequestException('Already checked in — ' + booking.checkedInAt?.toISOString());
    }

    // Conditional on checkedIn:false OR checkedInAt before today's IST
    // start (not a plain update) so two near-simultaneous scans of the
    // same QR — a screenshotted ticket at two gates, a camera scan racing
    // a manual-entry confirm — can't both pass the read-then-write gap
    // above and both admit. Only one write can ever match this where
    // clause; the loser sees count 0 and is rejected below, same as the
    // fast-path check above but race-safe. The OR branch also covers the
    // multi-day re-admission case above.
    const todayIstStart = istDayStart(istDateKey(new Date()));
    const result = await this.prisma.booking.updateMany({
      where: { id: booking.id, OR: [{ checkedIn: false }, { checkedInAt: { lt: todayIstStart } }] },
      data: { checkedIn: true, checkedInAt: new Date() },
    });
    if (result.count === 0) {
      const latest = await this.prisma.booking.findUnique({ where: { id: booking.id } });
      await this.logCheckIn({ ok: false, reason: `duplicate QR — already scanned ${latest?.checkedInAt?.toISOString()}`, eventId: booking.eventId, bookingId: booking.id, guestName: booking.mainGuest, tierName: booking.tierName });
      throw new BadRequestException('Already checked in — ' + latest?.checkedInAt?.toISOString());
    }
    const updated = await this.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    await this.logCheckIn({ ok: true, reason: 'checked in', eventId: booking.eventId, bookingId: booking.id, guestName: booking.mainGuest, tierName: booking.tierName, headcount: booking.qty });
    // promoterRef is a bare slug, not a Prisma relation (see adminGet's
    // identical lookup) — resolved here so the scanner's confirmation
    // screen can show which promoter gets credit for this sale, same as
    // the promoter-guest-list flow already shows for a free-entry pass.
    const promoter = updated.promoterRef ? await this.prisma.promoter.findUnique({ where: { slug: updated.promoterRef }, select: { name: true } }) : null;
    return { ...updated, promoterName: promoter?.name };
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
      // A solo-hosted venue event (Event.hostedByVenue, no collaborating
      // organizer) has nobody to review here — this reminder is
      // organizer-review-specific by design (VenueReview is a separate,
      // already-working system guests can use directly from the venue's
      // page). A future "review the venue" nudge would be a clean addition
      // here, not a fix this change needs to make.
      if (!b.event.organizer) continue;

      const endsAt = b.event.date.getTime() + b.event.durationHrs * 60 * 60 * 1000;
      const hoursSinceEnd = (Date.now() - endsAt) / (60 * 60 * 1000);
      if (hoursSinceEnd < 24 || hoursSinceEnd > 72) continue; // ask once, a day-to-three-days after it actually ended

      const data = { name: b.user.name || b.mainGuest, eventTitle: b.event.title, organizerName: b.event.organizer.brandName, organizerId: b.event.organizer.id, eventId: b.event.id };
      await this.email.sendTemplate(b.user.email, 'review_request', data).catch(() => {});
      // Link is a 3rd body variable, not a button — AiSensy's per-message
      // dynamic URL button is a paid-plan feature; a plain URL in body text
      // renders as a tappable link on WhatsApp with no such restriction.
      // Scoped to both organizer + event so a guest who's attended several
      // of the same organizer's events gets a link to *this* one, not a
      // generic "which event do you mean" landing.
      const reviewUrl = `${process.env.WEB_APP_URL ?? ''}/organizers/${data.organizerId}?event=${encodeURIComponent(data.eventId)}`;
      await this.wa.send(b.user.phone, 'review_reminder_v2', [data.eventTitle, data.organizerName, reviewUrl]).catch(() => {});
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
