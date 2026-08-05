import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { money } from '../notifications/email-templates';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../admin/notifications.service';

/** Mirrors prebooze-web's SUB_TIERS (src/data/mock.ts) — -1 = unlimited. */
const PLAN_QUOTA: Record<string, number> = { free: 100, starter: 150, pro: 500, elite: -1 };
const MIN_WITHDRAW = 500; // ₹, matches prebooze-web's PromoterEarnings.tsx
const NO_SHOW_BLOCK_THRESHOLD = 3; // matches promoterFraud.ts

interface PromoterConfig {
  enabled: boolean;
  cap: number;
  cutoff: string; // "HH:MM"
  allowedPromoters: string[];
  perHeadPayout: boolean;
  perHeadAmount: number;
  allowTeams: boolean;
  revenueShare?: Record<string, number>; // slug -> % of base ticket price, added on top as guest-funded markup (see BookingsService.priceHold)
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
    private notifications: NotificationsService,
  ) {}

  private async myPromoter(userId: string) {
    const promoter = await this.prisma.promoter.findUnique({ where: { userId } });
    if (!promoter) throw new ForbiddenException('Not an approved promoter');
    return promoter;
  }

  /** Full "my profile" read — mirrors LineupService.me/myLineup. Console
   * pages (dashboard, settings) read this instead of stitching together
   * User.promoter* mirror fields + separate usage()/subscription calls. */
  async me(userId: string) {
    return this.myPromoter(userId);
  }

  /** Self-serve profile edit — same pattern as OrganizerService.updateMe:
   * username changes are collision-checked and rejected (not auto-suffixed),
   * and brandName/username are mirrored onto User.promoterBrand/promoterUsername
   * so the global header + self-follow check (case-normalized on both sides)
   * stay in sync. PromoterSettings.tsx only edits brand/username/city today,
   * hence the narrow patch shape — Promoter.bio/links exist on the model but
   * have no editor UI yet. */
  async updateMe(userId: string, patch: { brandName?: string; username?: string; city?: string }) {
    const promoter = await this.myPromoter(userId);

    const slug = patch.username?.trim().toLowerCase();
    if (slug && slug !== promoter.slug) {
      if (!/^[a-z0-9-]{3,30}$/.test(slug)) throw new BadRequestException('Username must be 3-30 characters — letters, numbers and hyphens only');
      const taken = await this.prisma.promoter.findUnique({ where: { slug } });
      if (taken) throw new BadRequestException('That username is already taken');
    }

    const updated = await this.prisma.promoter.update({
      where: { id: promoter.id },
      data: {
        name: patch.brandName?.trim(),
        slug,
        city: patch.city?.trim(),
      },
    });

    if (promoter.userId && (patch.brandName !== undefined || slug)) {
      await this.prisma.user.update({
        where: { id: promoter.userId },
        data: {
          promoterBrand: patch.brandName !== undefined ? updated.name : undefined,
          promoterUsername: slug ? updated.slug : undefined,
        },
      });
    }

    return updated;
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
  // perHead is computed live from PromoterGuest (check-ins keep happening
  // for the life of the event, so there's no single moment to "lock" it).
  // commission sums Booking.promoterCommission, which — unlike perHead — IS
  // locked in at sale time (see BookingsService.priceHold), so summing it
  // live here never re-derives a number that could drift from what was
  // actually promised at the moment of that specific sale.
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

    const bookings = await this.prisma.booking.findMany({ where: { promoterRef: promoter.slug, status: 'confirmed' } });
    const commission = bookings.reduce((a, b) => a + b.promoterCommission, 0);

    const withdrawnAgg = await this.prisma.promoterWithdrawal.aggregate({ where: { promoterId: promoter.id }, _sum: { amount: true } });

    return { perHead, commission, withdrawn: withdrawnAgg._sum.amount ?? 0 };
  }

  /** Per-event breakdown — the granularity PromoterEarnings.tsx's totals
   * card can't show (it only has flat all-time sums). One row per event
   * this promoter has EITHER a paid-booking commission OR an arrived
   * free-list guest on, combined with that event's payment-confirmation
   * status (see PromoterEventSettlement — organizer pays outside Prebooze,
   * this is the promoter's own attestation of whether that happened). */
  async perEventEarnings(userId: string) {
    const promoter = await this.myPromoter(userId);

    const [arrivedGuests, bookings, settlements] = await Promise.all([
      this.prisma.promoterGuest.findMany({
        where: { promoterSlug: promoter.slug, arrived: true },
        select: { event: { select: { id: true, title: true, date: true, promoterConfig: true } } },
      }),
      this.prisma.booking.findMany({
        where: { promoterRef: promoter.slug, status: 'confirmed', promoterCommission: { gt: 0 } },
        select: { eventId: true, promoterCommission: true, event: { select: { id: true, title: true, date: true } } },
      }),
      this.prisma.promoterEventSettlement.findMany({ where: { promoterId: promoter.id } }),
    ]);

    const settlementByEvent = new Map(settlements.map((s) => [s.eventId, s]));
    const byEvent = new Map<string, { eventId: string; title: string; date: Date; perHead: number; commission: number }>();
    const ensure = (id: string, title: string, date: Date) => {
      let row = byEvent.get(id);
      if (!row) {
        row = { eventId: id, title, date, perHead: 0, commission: 0 };
        byEvent.set(id, row);
      }
      return row;
    };

    for (const g of arrivedGuests) {
      const cfg = g.event.promoterConfig as unknown as PromoterConfig | null;
      if (!cfg?.enabled || !cfg.perHeadPayout) continue;
      ensure(g.event.id, g.event.title, g.event.date).perHead += cfg.perHeadAmount;
    }
    for (const b of bookings) {
      ensure(b.event.id, b.event.title, b.event.date).commission += b.promoterCommission;
    }

    return [...byEvent.values()]
      .map((e) => ({
        ...e,
        total: e.perHead + e.commission,
        status: settlementByEvent.get(e.eventId)?.status ?? 'pending',
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /** Promoter's own attestation that the organizer actually paid them for
   * this event — there's no payment rail behind this (see schema comment
   * on PromoterEventSettlement), it's bookkeeping, same honesty-based
   * pattern as the self-serve withdraw() below. */
  async markEventReceived(userId: string, eventId: string) {
    const promoter = await this.myPromoter(userId);
    await this.prisma.promoterEventSettlement.upsert({
      where: { promoterId_eventId: { promoterId: promoter.id, eventId } },
      create: { promoterId: promoter.id, eventId, status: 'received', receivedAt: new Date() },
      update: { status: 'received', receivedAt: new Date() },
    });
    return { ok: true };
  }

  /** Nudges the organizer via a real WhatsApp/email — recipient is the
   * organizer's own account (Organizer.userId), same lookup pattern
   * BookingsService uses for guest notifications. WhatsApp send is
   * best-effort (new template needs its own AiSensy approval before it
   * actually delivers — see org-team.service.ts's addStaff for the same
   * documented constraint); email has no such gate and works immediately. */
  async remindOrganizerToPay(userId: string, eventId: string) {
    const promoter = await this.myPromoter(userId);
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: { organizer: { include: { user: true } } } });
    if (!event) throw new NotFoundException('Event not found');

    await this.prisma.promoterEventSettlement.upsert({
      where: { promoterId_eventId: { promoterId: promoter.id, eventId } },
      create: { promoterId: promoter.id, eventId, status: 'reminder_sent', reminderSentAt: new Date() },
      update: { status: 'reminder_sent', reminderSentAt: new Date() },
    });

    const orgUser = event.organizer.user;
    if (orgUser) {
      await this.wa.send(orgUser.phone, 'promoter_payout_reminder', [promoter.name, event.title]).catch(() => {});
      await this.email
        .sendTemplate(orgUser.email, 'promoter_payout_reminder', { promoterName: promoter.name, eventTitle: event.title, orgBrand: event.organizer.brandName })
        .catch(() => {});
    }
    await this.notifications.notify('💸', `${promoter.name} says you still owe them for "${event.title}"`, `/promoter-payouts`);
    return { ok: true };
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

  /** Simple real payout log — PromoterWithdrawal has no status field (see
   * schema comment: "no pending/paid states, unlike the mock's Withdrawal.
   * status"), so this lists real requested amounts/dates, nothing fabricated. */
  async withdrawals(userId: string) {
    const promoter = await this.myPromoter(userId);
    return this.prisma.promoterWithdrawal.findMany({ where: { promoterId: promoter.id }, orderBy: { createdAt: 'desc' } });
  }

  // ---------- leaderboard ----------
  /** Reputation ranking — live show-rate (arrived / decided) per promoter,
   * same "decided" definition as the mock's liveShowRate: a guest counts
   * once they've arrived, or once their event's free-entry cutoff has
   * passed without them showing. Computed live off PromoterGuest, not the
   * stored Promoter.showRate column (nothing updates that column today, so
   * trusting it would mean trusting a number that's permanently 0). */
  async leaderboard() {
    const [promoters, guests] = await Promise.all([
      this.prisma.promoter.findMany({ where: { verified: true } }),
      this.prisma.promoterGuest.findMany({ include: { event: true } }),
    ]);
    const now = Date.now();
    return promoters
      .map((p) => {
        const mine = guests.filter((g) => g.promoterSlug === p.slug);
        const decided = mine.filter((g) => {
          if (g.arrived) return true;
          const c = cutoffDate(g.event);
          return c ? now >= c.getTime() : false;
        });
        const rate = decided.length ? Math.round((decided.filter((g) => g.arrived).length / decided.length) * 100) : null;
        return { id: p.id, slug: p.slug, name: p.name, verified: p.verified, followers: p.followers, brought: mine.length, rate };
      })
      .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  }

  // ---------- public pass lookup (no auth — guest's own QR page) ----------
  async getPass(id: string) {
    // tiers included so the post-cutoff "get a ticket" CTA (minPrice()) has
    // real pricing to show, not just the guest/venue fields the QR itself needs.
    const guest = await this.prisma.promoterGuest.findUnique({ where: { id }, include: { event: { include: { venue: true, tiers: true } } } });
    if (!guest) throw new NotFoundException('Pass not found');
    return guest;
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

  async removeTeamMember(userId: string, memberId: string) {
    const promoter = await this.myPromoter(userId);
    const member = await this.prisma.promoterTeamMember.findUnique({ where: { id: memberId } });
    if (!member || member.promoterId !== promoter.id) throw new NotFoundException('Team member not found');
    await this.prisma.promoterTeamMember.delete({ where: { id: memberId } });
    return { ok: true };
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

  /** Same monthCount/quota computation as the real gate in captureGuest()
   * above — surfaced read-only so the promoter's own Subscription page can
   * show real usage instead of a client-guessed number. */
  async usage(userId: string) {
    const promoter = await this.myPromoter(userId);
    const quota = await this.planQuota(promoter.planId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const used = await this.prisma.promoterGuest.count({
      where: { promoterSlug: promoter.slug, createdAt: { gte: monthStart, lt: nextMonth } },
    });
    return { used, quota };
  }
}
