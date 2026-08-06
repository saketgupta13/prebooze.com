import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
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
  // Subset of allowedPromoters with Guest list mode on. Missing (events
  // saved before this field existed) defaults to every allowedPromoters
  // entry, so already-live events keep earning exactly as they did before.
  guestListPromoters?: string[];
  perHeadPayout: boolean;
  perHeadAmount: number;
  allowTeams: boolean;
  revenueShare?: Record<string, number>; // slug -> % of base ticket price, added on top as guest-funded markup (see BookingsService.priceHold)
}

/** Whether `slug` has Guest list mode on for this event's config — the gate
 * for both joining the free-entry list (captureGuest) and earning a
 * per-head payout on arrivals (earnings/perEventEarnings). */
function guestListEnabled(cfg: PromoterConfig | null | undefined, slug: string): boolean {
  if (!cfg?.enabled) return false;
  const glp = cfg.guestListPromoters ?? cfg.allowedPromoters ?? [];
  return glp.includes(slug);
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
   * brandName/username are mirrored onto User.promoterBrand/promoterUsername
   * so the global header + self-follow check (case-normalized on both sides)
   * stay in sync, and bank details follow the exact same
   * bankLast4-is-masked/bankAccountNumber-is-real split Organizer.updateMe
   * uses (see schema comment on Promoter.bankAccountNumber). */
  async updateMe(
    userId: string,
    patch: {
      brandName?: string; username?: string; city?: string; country?: string; state?: string; pincode?: string;
      bio?: string; links?: string[]; audienceReach?: string;
      bankName?: string; bankAccount?: string; accountHolderName?: string; ifsc?: string; logoUrl?: string;
    },
  ) {
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
        country: patch.country?.trim(),
        state: patch.state?.trim(),
        pincode: patch.pincode?.trim(),
        bio: patch.bio,
        links: patch.links,
        audienceReach: patch.audienceReach?.trim(),
        bankName: patch.bankName?.trim(),
        bankAccountNumber: patch.bankAccount?.trim(),
        bankLast4: patch.bankAccount ? patch.bankAccount.trim().slice(-4) : undefined,
        accountHolderName: patch.accountHolderName?.trim(),
        ifsc: patch.ifsc?.trim().toUpperCase(),
        logoUrl: patch.logoUrl,
      },
    });

    if (promoter.userId && (patch.brandName !== undefined || slug || patch.logoUrl !== undefined)) {
      await this.prisma.user.update({
        where: { id: promoter.userId },
        data: {
          promoterBrand: patch.brandName !== undefined ? updated.name : undefined,
          promoterUsername: slug ? updated.slug : undefined,
          promoterLogoUrl: patch.logoUrl !== undefined ? updated.logoUrl : undefined,
        },
      });
    }

    return updated;
  }

  // ---------- promotions & guest lists ----------
  async promotions(userId: string) {
    const promoter = await this.myPromoter(userId);
    const events = await this.prisma.event.findMany({ where: { status: 'approved' }, include: { tiers: true, venue: true, organizer: true } });
    return events.filter((e) => {
      const cfg = e.promoterConfig as unknown as PromoterConfig | null;
      return !!cfg?.enabled && cfg.allowedPromoters?.includes(promoter.slug);
    });
  }

  async guests(userId: string, eventId: string) {
    const promoter = await this.myPromoter(userId);
    return this.prisma.promoterGuest.findMany({ where: { eventId, promoterSlug: promoter.slug }, orderBy: { createdAt: 'desc' } });
  }

  /** Paid-commission side of the same event's guest list — who actually
   * bought a ticket through this promoter's ?ref= link. A different data
   * source (Booking, not PromoterGuest) and deliberately a narrower shape:
   * no phone number here — the free-entry list's phone is something the
   * guest handed the promoter directly for gate operations, but a paid
   * booking's contact details were given to Prebooze at checkout, not to
   * the promoter, so this only surfaces what's needed to reconcile earnings
   * (who, how many tickets, how much they were worth, what was earned). */
  async paidGuests(userId: string, eventId: string) {
    const promoter = await this.myPromoter(userId);
    return this.prisma.booking.findMany({
      where: { eventId, promoterRef: promoter.slug, status: 'confirmed' },
      select: { id: true, mainGuest: true, qty: true, subtotal: true, promoterCommission: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** cap/quota both mean total headcount ("Free-entry cap (total passes)",
   * "N guests / month") — a party's companions count toward both the same
   * as the main signer, otherwise a promoter could blow past either limit
   * for free by always attaching companions to one submission instead of
   * separate ones. */
  private partySize(rows: { companions: unknown }[]): number {
    return rows.reduce((sum, r) => sum + 1 + (Array.isArray(r.companions) ? r.companions.length : 0), 0);
  }

  // ---------- public guest capture (no auth — reached via affiliate link) ----------
  async captureGuest(
    eventSlug: string,
    promoterSlug: string,
    body: { name?: string; phone?: string; age?: string; gender?: string; subPromoter?: string; companions?: { name?: string }[] },
  ) {
    const event = await this.prisma.event.findUnique({ where: { slug: eventSlug } });
    if (!event || event.status !== 'approved') throw new NotFoundException("This guest-list link isn't active");

    const cfg = event.promoterConfig as unknown as PromoterConfig | null;
    if (!cfg || !guestListEnabled(cfg, promoterSlug)) {
      throw new BadRequestException("This guest-list link isn't active");
    }
    if (!body.name?.trim() || !body.phone?.trim() || !body.age?.trim() || !body.gender) {
      throw new BadRequestException('All fields are required — the gate checks these against your ID');
    }
    const minAge = event.ageLimit?.includes('21') ? 21 : event.ageLimit?.includes('18') ? 18 : 0;
    if (minAge && (parseInt(body.age, 10) || 0) < minAge) {
      throw new BadRequestException(`This is a ${event.ageLimit} event — you must be ${minAge}+ to join the list`);
    }
    // one combined QR per party — a sane cap on how many companions a single
    // signer can bundle in, not meant for a busload under one name
    const companions = (body.companions ?? [])
      .map((c) => ({ name: (c?.name || '').trim() }))
      .filter((c) => c.name)
      .slice(0, 9);
    const partySize = 1 + companions.length;

    const listRows = await this.prisma.promoterGuest.findMany({ where: { eventId: event.id }, select: { companions: true } });
    if (this.partySize(listRows) + partySize > cfg.cap) throw new BadRequestException('Sorry — this free-entry list is full');

    const promoter = await this.prisma.promoter.findUnique({ where: { slug: promoterSlug } });
    const quota = await this.planQuota(promoter?.planId ?? 'free');
    if (quota >= 0) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const monthRows = await this.prisma.promoterGuest.findMany({
        where: { promoterSlug, createdAt: { gte: monthStart, lt: nextMonth } },
        select: { companions: true },
      });
      if (this.partySize(monthRows) + partySize > quota) throw new BadRequestException(`Sorry — ${promoter?.name ?? 'this promoter'} has reached their guest limit for this month`);
    }

    // optional per-sub-promoter slice of the lead's own quota — enforced in
    // addition to the lead-wide check above, not instead of it
    if (body.subPromoter && promoter) {
      const member = await this.prisma.promoterTeamMember.findUnique({
        where: { promoterId_handle: { promoterId: promoter.id, handle: body.subPromoter } },
      });
      if (member?.monthlyQuotaShare) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const memberMonthRows = await this.prisma.promoterGuest.findMany({
          where: { promoterSlug, subPromoter: body.subPromoter, createdAt: { gte: monthStart, lt: nextMonth } },
          select: { companions: true },
        });
        if (this.partySize(memberMonthRows) + partySize > member.monthlyQuotaShare) {
          throw new BadRequestException(`Sorry — ${member.name} has reached their guest limit for this month`);
        }
      }
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
        companions: companions as Prisma.InputJsonValue,
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
      if (!cfg?.perHeadPayout || !guestListEnabled(cfg, promoter.slug)) return sum;
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
        select: { event: { select: { id: true, title: true, date: true, promoterConfig: true, organizerId: true, organizer: { select: { brandName: true } } } } },
      }),
      this.prisma.booking.findMany({
        where: { promoterRef: promoter.slug, status: 'confirmed', promoterCommission: { gt: 0 } },
        select: {
          eventId: true, promoterCommission: true,
          event: { select: { id: true, title: true, date: true, organizerId: true, organizer: { select: { brandName: true } } } },
        },
      }),
      this.prisma.promoterEventSettlement.findMany({ where: { promoterId: promoter.id } }),
    ]);

    const settlementByEvent = new Map(settlements.map((s) => [s.eventId, s]));
    const byEvent = new Map<
      string,
      { eventId: string; title: string; date: Date; organizerId: string; organizerName: string; perHead: number; perHeadRate: number; perHeadCount: number; commission: number }
    >();
    const ensure = (id: string, title: string, date: Date, organizerId: string, organizerName: string) => {
      let row = byEvent.get(id);
      if (!row) {
        row = { eventId: id, title, date, organizerId, organizerName, perHead: 0, perHeadRate: 0, perHeadCount: 0, commission: 0 };
        byEvent.set(id, row);
      }
      return row;
    };

    for (const g of arrivedGuests) {
      const cfg = g.event.promoterConfig as unknown as PromoterConfig | null;
      if (!cfg?.perHeadPayout || !guestListEnabled(cfg, promoter.slug)) continue;
      const row = ensure(g.event.id, g.event.title, g.event.date, g.event.organizerId, g.event.organizer.brandName);
      row.perHead += cfg.perHeadAmount;
      row.perHeadRate = cfg.perHeadAmount;
      row.perHeadCount += 1;
    }
    for (const b of bookings) {
      ensure(b.event.id, b.event.title, b.event.date, b.event.organizerId, b.event.organizer.brandName).commission += b.promoterCommission;
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

  async addTeamMember(userId: string, m: { handle?: string; name?: string; hue?: number; payoutSplitPct?: number; monthlyQuotaShare?: number | null }) {
    const promoter = await this.myPromoter(userId);
    if (!m.handle?.trim()) throw new BadRequestException('handle is required');

    const existing = await this.prisma.promoterTeamMember.findUnique({
      where: { promoterId_handle: { promoterId: promoter.id, handle: m.handle.trim() } },
    });
    if (existing) return existing; // matches the mock's silent no-op on a duplicate handle

    return this.prisma.promoterTeamMember.create({
      data: {
        promoterId: promoter.id, handle: m.handle.trim(), name: m.name?.trim() || m.handle.trim(), hue: m.hue ?? 0,
        payoutSplitPct: Math.min(100, Math.max(0, m.payoutSplitPct ?? 0)),
        monthlyQuotaShare: m.monthlyQuotaShare && m.monthlyQuotaShare > 0 ? m.monthlyQuotaShare : null,
      },
    });
  }

  /** Split %/quota share are the only fields a lead edits after adding
   * someone — handle/name are set once at creation (changing a handle would
   * orphan every already-tagged PromoterGuest/Booking row from before). */
  async updateTeamMember(userId: string, memberId: string, patch: { payoutSplitPct?: number; monthlyQuotaShare?: number | null }) {
    const promoter = await this.myPromoter(userId);
    const member = await this.prisma.promoterTeamMember.findUnique({ where: { id: memberId } });
    if (!member || member.promoterId !== promoter.id) throw new NotFoundException('Team member not found');
    return this.prisma.promoterTeamMember.update({
      where: { id: memberId },
      data: {
        payoutSplitPct: patch.payoutSplitPct !== undefined ? Math.min(100, Math.max(0, patch.payoutSplitPct)) : undefined,
        monthlyQuotaShare: patch.monthlyQuotaShare !== undefined ? (patch.monthlyQuotaShare && patch.monthlyQuotaShare > 0 ? patch.monthlyQuotaShare : null) : undefined,
      },
    });
  }

  async removeTeamMember(userId: string, memberId: string) {
    const promoter = await this.myPromoter(userId);
    const member = await this.prisma.promoterTeamMember.findUnique({ where: { id: memberId } });
    if (!member || member.promoterId !== promoter.id) throw new NotFoundException('Team member not found');
    await this.prisma.promoterTeamMember.delete({ where: { id: memberId } });
    return { ok: true };
  }

  /** What the lead owes each team member, per event — same "brought/arrived"
   * numbers the Team page's live stats already show, now carried through to
   * money: perHead for arrived guests tagged with a member's handle (same
   * gating as the lead's own earnings — perHeadPayout + guestListEnabled),
   * plus that member's split of any promoterCommission tagged with their
   * handle on the ticket-link side. The split is applied to the RAW total
   * (100% of what was earned through that handle) — a member with 0%
   * configured still shows their raw numbers, just nothing "owed" yet. */
  async teamEarnings(userId: string) {
    const promoter = await this.myPromoter(userId);
    const members = await this.prisma.promoterTeamMember.findMany({ where: { promoterId: promoter.id } });
    if (!members.length) return [];

    const [arrivedGuests, bookings, allSettlements] = await Promise.all([
      this.prisma.promoterGuest.findMany({
        where: { promoterSlug: promoter.slug, arrived: true, subPromoter: { not: null } },
        select: { subPromoter: true, event: { select: { id: true, title: true, date: true, promoterConfig: true } } },
      }),
      this.prisma.booking.findMany({
        where: { promoterRef: promoter.slug, status: 'confirmed', promoterVia: { not: null }, promoterCommission: { gt: 0 } },
        select: { promoterVia: true, promoterCommission: true, event: { select: { id: true, title: true, date: true } } },
      }),
      this.prisma.promoterTeamSettlement.findMany({ where: { teamMemberId: { in: members.map((m) => m.id) } } }),
    ]);
    const memberByHandle = new Map(members.map((m) => [m.handle, m]));

    const rows = new Map<
      string,
      { teamMemberId: string; memberName: string; eventId: string; eventTitle: string; eventDate: Date; perHead: number; commission: number }
    >();
    const ensure = (memberId: string, memberName: string, eventId: string, eventTitle: string, eventDate: Date) => {
      const key = `${memberId}::${eventId}`;
      let row = rows.get(key);
      if (!row) {
        row = { teamMemberId: memberId, memberName, eventId, eventTitle, eventDate, perHead: 0, commission: 0 };
        rows.set(key, row);
      }
      return row;
    };

    for (const g of arrivedGuests) {
      const member = memberByHandle.get(g.subPromoter!);
      if (!member) continue;
      const cfg = g.event.promoterConfig as unknown as PromoterConfig | null;
      if (!cfg?.perHeadPayout || !guestListEnabled(cfg, promoter.slug)) continue;
      ensure(member.id, member.name, g.event.id, g.event.title, g.event.date).perHead += cfg.perHeadAmount;
    }
    for (const b of bookings) {
      const member = memberByHandle.get(b.promoterVia!);
      if (!member) continue;
      ensure(member.id, member.name, b.event.id, b.event.title, b.event.date).commission += b.promoterCommission;
    }

    const settlementByKey = new Map(allSettlements.map((s) => [`${s.teamMemberId}::${s.eventId}`, s]));
    return [...rows.values()]
      .map((r) => {
        const member = members.find((m) => m.id === r.teamMemberId)!;
        const rawTotal = r.perHead + r.commission;
        return {
          ...r,
          splitPct: member.payoutSplitPct,
          rawTotal,
          owed: Math.round((rawTotal * member.payoutSplitPct) / 100),
          status: settlementByKey.get(`${r.teamMemberId}::${r.eventId}`)?.status ?? 'pending',
        };
      })
      .sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
  }

  /** Lead-only action — a team member has no login here to self-attest
   * anything, so this is purely the lead's own bookkeeping ("I paid Aisha
   * for this event"), same self-attested-by-whoever-actually-pays pattern
   * as everything else in this payout chain. */
  async markTeamMemberPaid(userId: string, teamMemberId: string, eventId: string) {
    const promoter = await this.myPromoter(userId);
    const member = await this.prisma.promoterTeamMember.findUnique({ where: { id: teamMemberId } });
    if (!member || member.promoterId !== promoter.id) throw new NotFoundException('Team member not found');
    await this.prisma.promoterTeamSettlement.upsert({
      where: { teamMemberId_eventId: { teamMemberId, eventId } },
      create: { teamMemberId, eventId, status: 'paid', paidAt: new Date() },
      update: { status: 'paid', paidAt: new Date() },
    });
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
