import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { money } from '../notifications/email-templates';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/** Mirrors prebooze-web's SUB_TIERS (src/data/mock.ts) — -1 = unlimited. */
const PLAN_QUOTA: Record<string, number> = { free: 25, starter: 150, pro: 500, elite: -1 };
const MIN_WITHDRAW = 500; // ₹, matches prebooze-web's PromoterEarnings.tsx
const NO_SHOW_BLOCK_THRESHOLD = 3; // matches promoterFraud.ts
export const PROMOTER_COMMISSION_RATE = 0.08; // matches promoterEarnings.ts

interface PromoterConfig {
  enabled: boolean;
  cap: number;
  cutoff: string; // "HH:MM"
  allowedPromoters: string[];
  perHeadPayout: boolean;
  perHeadAmount: number;
  allowTeams: boolean;
}

const norm = (p: string) => (p || '').replace(/\D/g, '').slice(-10);

/** Free-entry cutoff as an absolute datetime — same formula as
 * prebooze-web's lib/promoterPass.ts cutoffDate(). */
function cutoffDate(event: { date: Date; promoterConfig: unknown }): Date | null {
  const cfg = event.promoterConfig as PromoterConfig | null;
  if (!cfg?.enabled || !cfg.cutoff) return null;
  const [h, m] = cfg.cutoff.split(':').map(Number);
  const c = new Date(event.date);
  c.setHours(h, m, 0, 0);
  if (c.getTime() < event.date.getTime()) c.setDate(c.getDate() + 1);
  return c;
}

@Injectable()
export class PromoterService {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsappService,
    private email: EmailService,
    private subscriptions: SubscriptionsService,
  ) {}

  private async myPromoter(userId: string) {
    const promoter = await this.prisma.promoter.findUnique({ where: { userId } });
    if (!promoter) throw new ForbiddenException('Not an approved promoter');
    return promoter;
  }

  // ---------- promotions & guest lists ----------
  async promotions(userId: string) {
    const promoter = await this.myPromoter(userId);
    const events = await this.prisma.event.findMany({ where: { status: 'approved' }, include: { tiers: true, venue: true } });
    return events.filter((e) => {
      const cfg = e.promoterConfig as unknown as PromoterConfig | null;
      return !!cfg?.enabled && cfg.allowedPromoters?.includes(promoter.slug);
    });
  }

  async guests(userId: string, eventId: string) {
    const promoter = await this.myPromoter(userId);
    return this.prisma.promoterGuest.findMany({ where: { eventId, promoterSlug: promoter.slug }, orderBy: { createdAt: 'desc' } });
  }

  // ---------- public guest capture (no auth — reached via affiliate link) ----------
  async captureGuest(
    eventSlug: string,
    promoterSlug: string,
    body: { name?: string; phone?: string; age?: string; gender?: string; subPromoter?: string },
  ) {
    const event = await this.prisma.event.findUnique({ where: { slug: eventSlug } });
    if (!event || event.status !== 'approved') throw new NotFoundException("This guest-list link isn't active");

    const cfg = event.promoterConfig as unknown as PromoterConfig | null;
    if (!cfg?.enabled || !cfg.allowedPromoters?.includes(promoterSlug)) {
      throw new BadRequestException("This guest-list link isn't active");
    }
    if (!body.name?.trim() || !body.phone?.trim() || !body.age?.trim() || !body.gender) {
      throw new BadRequestException('All fields are required — the gate checks these against your ID');
    }
    const minAge = event.ageLimit?.includes('21') ? 21 : event.ageLimit?.includes('18') ? 18 : 0;
    if (minAge && (parseInt(body.age, 10) || 0) < minAge) {
      throw new BadRequestException(`This is a ${event.ageLimit} event — you must be ${minAge}+ to join the list`);
    }

    const listCount = await this.prisma.promoterGuest.count({ where: { eventId: event.id } });
    if (listCount >= cfg.cap) throw new BadRequestException('Sorry — this free-entry list is full');

    const promoter = await this.prisma.promoter.findUnique({ where: { slug: promoterSlug } });
    const quota = await this.planQuota(promoter?.planId ?? 'free');
    if (quota >= 0) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const monthCount = await this.prisma.promoterGuest.count({
        where: { promoterSlug, createdAt: { gte: monthStart, lt: nextMonth } },
      });
      if (monthCount >= quota) throw new BadRequestException(`Sorry — ${promoter?.name ?? 'this promoter'} has reached their guest limit for this month`);
    }

    // fraud checks need every past guest row for this phone, across all events
    const last10 = norm(body.phone);
    const samePhoneGuests = last10
      ? (await this.prisma.promoterGuest.findMany({ where: { phone: { contains: last10 } }, include: { event: true } })).filter(
          (g) => norm(g.phone) === last10,
        )
      : [];

    // one free pass per phone per event — send them back to the pass they already have
    const dupe = samePhoneGuests.find((g) => g.eventId === event.id);
    if (dupe) {
      const { event: _event, ...guest } = dupe;
      return guest;
    }

    // block phones with 3+ past no-shows (list joined, cutoff passed, never arrived)
    const noShows = samePhoneGuests.filter((g) => {
      if (g.arrived) return false;
      const c = cutoffDate(g.event);
      return c ? Date.now() >= c.getTime() : false;
    }).length;
    if (noShows >= NO_SHOW_BLOCK_THRESHOLD) {
      throw new BadRequestException('This number has missed too many free-entry lists. Grab a ticket to come in.');
    }

    const id = 'pass-' + randomBytes(8).toString('hex');
    const guest = await this.prisma.promoterGuest.create({
      data: {
        id,
        eventId: event.id,
        promoterSlug,
        name: body.name.trim(),
        phone: body.phone.trim(),
        age: body.age.trim(),
        gender: body.gender,
        subPromoter: body.subPromoter,
      },
    });

    await this.wa.send(guest.phone, 'guest_pass', [guest.name, event.title, `${process.env.WEB_APP_URL ?? ''}/pass/${guest.id}`]).catch(() => {});
    return guest;
  }

  /** No rotation-token param exists in the real endpoint contract (see
   * prebooze-web/src/api/index.ts checkInGuest(id)) — the QR's 5s-rotating
   * seed is purely a client-side screenshot deterrent, nothing for the
   * server to validate. Idempotent one-way mark, matching how ticket
   * check-in works (BookingsService.checkIn) — deliberately *not* the
   * mock's toggle-based "undo", since a public-facing check-in action
   * shouldn't be reversible by tapping twice at the gate. */
  async checkIn(userId: string, guestId: string) {
    const guest = await this.prisma.promoterGuest.findUnique({ where: { id: guestId }, include: { event: true } });
    if (!guest) throw new NotFoundException('Guest not found');

    const [myPromoter, myOrganizer] = await Promise.all([
      this.prisma.promoter.findUnique({ where: { userId } }),
      this.prisma.organizer.findUnique({ where: { userId } }),
    ]);
    const allowed = myPromoter?.slug === guest.promoterSlug || myOrganizer?.id === guest.event.organizerId;
    if (!allowed) throw new ForbiddenException();

    if (guest.arrived) return guest;
    return this.prisma.promoterGuest.update({ where: { id: guestId }, data: { arrived: true, arrivedAt: new Date() } });
  }

  // ---------- earnings & withdraw ----------
  // Computed live from PromoterGuest/Booking, not a stored ledger — there's
  // nothing here that isn't already reconstructible from those two tables.
  async earnings(userId: string) {
    const promoter = await this.myPromoter(userId);

    const arrivedGuests = await this.prisma.promoterGuest.findMany({
      where: { promoterSlug: promoter.slug, arrived: true },
      include: { event: true },
    });
    const perHead = arrivedGuests.reduce((sum, g) => {
      const cfg = g.event.promoterConfig as unknown as PromoterConfig | null;
      if (!cfg?.enabled || !cfg.perHeadPayout) return sum;
      return sum + cfg.perHeadAmount;
    }, 0);

    const bookings = await this.prisma.booking.findMany({ where: { promoterRef: promoter.slug, status: { not: 'cancelled' } } });
    const commission = bookings.reduce((a, b) => a + Math.round(b.subtotal * PROMOTER_COMMISSION_RATE), 0);

    const withdrawnAgg = await this.prisma.promoterWithdrawal.aggregate({ where: { promoterId: promoter.id }, _sum: { amount: true } });

    return { perHead, commission, withdrawn: withdrawnAgg._sum.amount ?? 0 };
  }

  async withdraw(userId: string, amount: number) {
    const promoter = await this.myPromoter(userId);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAW) throw new BadRequestException(`Minimum withdrawal is ₹${MIN_WITHDRAW}`);

    const { perHead, commission, withdrawn } = await this.earnings(userId);
    const available = perHead + commission - withdrawn;
    if (amount > available) throw new BadRequestException('More than your available balance');

    await this.prisma.promoterWithdrawal.create({ data: { promoterId: promoter.id, amount } });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await this.wa.send(user.phone, 'organizer_payout', [String(amount)]).catch(() => {});
      await this.email.sendTemplate(user.email, 'payout_processed', {
        name: user.name, amount: money(amount), role: 'promoter',
      }).catch(() => {});
    }
    return { ok: true };
  }

  // ---------- team ----------
  async team(userId: string) {
    const promoter = await this.myPromoter(userId);
    return this.prisma.promoterTeamMember.findMany({ where: { promoterId: promoter.id }, orderBy: { createdAt: 'asc' } });
  }

  async addTeamMember(userId: string, m: { handle?: string; name?: string; hue?: number }) {
    const promoter = await this.myPromoter(userId);
    if (!m.handle?.trim()) throw new BadRequestException('handle is required');

    const existing = await this.prisma.promoterTeamMember.findUnique({
      where: { promoterId_handle: { promoterId: promoter.id, handle: m.handle.trim() } },
    });
    if (existing) return existing; // matches the mock's silent no-op on a duplicate handle

    return this.prisma.promoterTeamMember.create({
      data: { promoterId: promoter.id, handle: m.handle.trim(), name: m.name?.trim() || m.handle.trim(), hue: m.hue ?? 0 },
    });
  }

  /** DB-first, PLAN_QUOTA as fallback only if the SubTier row is somehow
   * missing — admin's PromoterTiers.tsx (Admin API "sub-tiers" slice) edits
   * SubTier.guests for real now instead of this being a fixed constant. */
  private async planQuota(planId: string): Promise<number> {
    const tier = await this.prisma.subTier.findUnique({ where: { id: planId } });
    return tier?.guests ?? PLAN_QUOTA[planId] ?? PLAN_QUOTA.free;
  }

  // ---------- subscription ----------
  // Real Razorpay Subscriptions billing now — SubscriptionsService owns the
  // actual plan/payment mechanics, this just resolves "my promoter" the same
  // way every other method here does and delegates.
  async subscriptionTiers() {
    return this.subscriptions.tiers('promoter');
  }

  async mySubscription(userId: string) {
    const promoter = await this.myPromoter(userId);
    return this.subscriptions.current('promoter', promoter.id);
  }

  async subscribe(userId: string, tierId: string) {
    const promoter = await this.myPromoter(userId);
    return this.subscriptions.subscribe('promoter', promoter.id, tierId);
  }

  async cancelSubscription(userId: string) {
    const promoter = await this.myPromoter(userId);
    return this.subscriptions.cancel('promoter', promoter.id);
  }
}
