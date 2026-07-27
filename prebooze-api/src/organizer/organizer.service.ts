import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { money } from '../notifications/email-templates';
import { NotificationsService } from '../admin/notifications.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

const HOLD_TTL_MS = 8 * 60 * 1000; // matches HoldsService — a cart still `active` past this is abandoned

interface TierInput {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  includes?: string[];
  description?: string;
}

export interface EventInput {
  id?: string;
  title: string;
  slug?: string;
  description?: string;
  category?: string;
  subCategory?: string;
  ageLimit?: string;
  tags?: string[];
  date?: string;
  durationHrs?: number;
  venueId: string;
  status?: 'draft' | 'pending' | 'approved' | 'rejected';
  conditions?: string[];
  rules?: unknown;
  lineup?: unknown;
  posterHue?: number;
  seo?: unknown;
  promoterConfig?: unknown;
  galleryUrls?: string[];
  teaserVideoUrl?: string | null;
  socialBanners?: unknown;
  tiers?: TierInput[];
}

function slugifyBase(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'event';
}

@Injectable()
export class OrganizerService {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsappService,
    private email: EmailService,
    private notifications: NotificationsService,
    private subscriptions: SubscriptionsService,
  ) {}

  async me(userId: string) {
    return this.myOrganizer(userId);
  }

  /** Self-serve profile edit — the counterpart to VenueService.updateListing.
   * Didn't exist before: an approved organizer had no way to update their
   * own about/links/GSTIN/PAN/bank short of re-running onboarding, which
   * actually fails once approved (KycService.submitRole rejects a second
   * application for a role you already hold). City/brand slug stay
   * admin-only, same "changes go through support" boundary as Venue. */
  async updateMe(userId: string, patch: { about?: string; links?: string; gstin?: string; pan?: string; bankAccount?: string; contact?: string; contactPerson?: string; phone?: string; eventTypes?: string }) {
    const org = await this.myOrganizer(userId);
    return this.prisma.organizer.update({
      where: { id: org.id },
      data: {
        about: patch.about?.trim(),
        links: patch.links,
        gstin: patch.gstin?.trim().toUpperCase() || null,
        pan: patch.pan?.trim().toUpperCase(),
        contact: patch.contact?.trim(),
        contactPerson: patch.contactPerson?.trim(),
        phone: patch.phone?.trim(),
        eventTypes: patch.eventTypes,
        bankLast4: patch.bankAccount ? patch.bankAccount.trim().slice(-4) : undefined,
      },
    });
  }

  // ---------- subscription (Razorpay-billed organizer plans) ----------
  async subscriptionTiers() {
    return this.subscriptions.tiers('organizer');
  }

  async mySubscription(userId: string) {
    const org = await this.myOrganizer(userId);
    return this.subscriptions.current('organizer', org.id);
  }

  async subscribe(userId: string, tierId: string) {
    const org = await this.myOrganizer(userId);
    return this.subscriptions.subscribe('organizer', org.id, tierId);
  }

  async cancelSubscription(userId: string) {
    const org = await this.myOrganizer(userId);
    return this.subscriptions.cancel('organizer', org.id);
  }

  private async myOrganizer(userId: string) {
    const org = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!org) throw new ForbiddenException('Not an approved organizer');
    return org;
  }

  private async uniqueSlug(base: string) {
    let candidate = base;
    let n = 1;
    while (await this.prisma.event.findUnique({ where: { slug: candidate } })) {
      candidate = `${base}-${++n}`;
    }
    return candidate;
  }

  // ---------- events ----------
  async events(userId: string) {
    const org = await this.myOrganizer(userId);
    return this.prisma.event.findMany({
      where: { organizerId: org.id },
      include: { tiers: true, venue: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Create or edit. Status is client-controllable only between draft/pending
   * — approved/rejected are review outcomes and can only ever be set by
   * POST /admin/events/:id/{approve,reject}, never directly here (organizer
   * or admin path alike). Shared by both OrganizerController's self-serve
   * upsertEvent and AdminEventsController's admin "god mode" create/edit
   * (see adminUpsertEvent below) — same merge-not-replace semantics either
   * way, just a different source of truth for organizerId/ownership. */
  private async saveEvent(organizerId: string, organizerBrandName: string, input: EventInput) {
    if (!input.title?.trim()) throw new BadRequestException('title is required');
    if (!input.venueId) throw new BadRequestException('venueId is required');
    const venue = await this.prisma.venue.findUnique({ where: { id: input.venueId } });
    if (!venue) throw new BadRequestException('Unknown venue');

    const status = input.status === 'draft' ? 'draft' : 'pending';

    let eventId = input.id;
    let slug: string | undefined;
    let existing: Awaited<ReturnType<typeof this.prisma.event.findUnique>> = null;
    if (eventId) {
      existing = await this.prisma.event.findUnique({ where: { id: eventId } });
      if (!existing) throw new NotFoundException('Event not found');
      slug = existing.slug; // stable once created, even if the title changes
    } else {
      eventId = 'ev-' + randomBytes(6).toString('hex');
      slug = await this.uniqueSlug(slugifyBase(input.title));
    }

    // An edit is a merge onto the existing row, not a wholesale replace —
    // fields the client didn't send (e.g. a quick "approve my draft" resend
    // that only touches status) must not wipe out what's already saved.
    const data = {
      title: input.title.trim(),
      description: input.description ?? existing?.description ?? '',
      category: input.category ?? existing?.category ?? '',
      subCategory: input.subCategory ?? existing?.subCategory,
      ageLimit: input.ageLimit ?? existing?.ageLimit ?? '',
      tags: input.tags ?? existing?.tags ?? [],
      date: input.date ? new Date(input.date) : (existing?.date ?? new Date()),
      durationHrs: input.durationHrs ?? existing?.durationHrs ?? 0,
      venueId: input.venueId,
      organizerId,
      status: status as never,
      conditions: input.conditions ?? existing?.conditions ?? [],
      rules: (input.rules ?? existing?.rules ?? []) as Prisma.InputJsonValue,
      lineup: (input.lineup ?? existing?.lineup ?? []) as Prisma.InputJsonValue,
      posterHue: input.posterHue ?? existing?.posterHue ?? (input.title.length * 47) % 360,
      seo: (input.seo ?? existing?.seo) as Prisma.InputJsonValue,
      promoterConfig: (input.promoterConfig ?? existing?.promoterConfig) as Prisma.InputJsonValue,
      galleryUrls: input.galleryUrls ?? existing?.galleryUrls ?? [],
      teaserVideoUrl: input.teaserVideoUrl !== undefined ? input.teaserVideoUrl : (existing?.teaserVideoUrl ?? null),
      socialBanners: (input.socialBanners ?? existing?.socialBanners) as Prisma.InputJsonValue,
    };

    await this.prisma.event.upsert({
      where: { id: eventId },
      create: { id: eventId, slug: slug!, ...data },
      update: data,
    });

    // only on the transition INTO pending — an edit re-saved while already
    // pending shouldn't re-notify on every keystroke-driven autosave
    if (status === 'pending' && existing?.status !== 'pending') {
      await this.notifications.notify('⚠', `"${data.title}" submitted for approval by ${organizerBrandName}`, '/admin/events?status=pending');
    }

    // same merge rule as above: omitting `tiers` entirely (e.g. a status-only
    // resubmit) must leave existing tiers alone, not wipe them
    if (input.tiers) await this.syncTiers(eventId, input.tiers);
    else if (!existing) throw new BadRequestException('At least one ticket tier is required');

    return this.prisma.event.findUniqueOrThrow({ where: { id: eventId }, include: { tiers: true, venue: true } });
  }

  async upsertEvent(userId: string, input: EventInput) {
    const org = await this.myOrganizer(userId);
    if (input.id) {
      const existing = await this.prisma.event.findUnique({ where: { id: input.id } });
      if (existing && existing.organizerId !== org.id) throw new ForbiddenException();
    }
    return this.saveEvent(org.id, org.brandName, input);
  }

  /** Admin "god mode" create/edit — closes the gap left by slice 3's
   * directory CRUD (organizers/promoters/lineups/venues), which didn't
   * cover events: only the approve/reject queue + narrow field patches
   * (commission/paid-out/pause-sales/poster) existed before this. Unlike
   * the organizer path, there's no ownership check — admin can create or
   * edit any organizer's event directly, same "god mode" reasoning as the
   * rest of the directory CRUD slice. */
  async adminUpsertEvent(input: EventInput & { organizerId: string }) {
    if (!input.organizerId) throw new BadRequestException('organizerId is required');
    const org = await this.prisma.organizer.findUnique({ where: { id: input.organizerId } });
    if (!org) throw new BadRequestException('Unknown organizer');
    return this.saveEvent(org.id, org.brandName, input);
  }

  private async syncTiers(eventId: string, tiers: TierInput[]) {
    const existing = await this.prisma.ticketTier.findMany({ where: { eventId } });
    const keepIds = new Set(tiers.filter((t) => t.id).map((t) => t.id));

    for (const t of existing) {
      if (keepIds.has(t.id)) continue;
      if (t.sold > 0) throw new BadRequestException(`Can't remove "${t.name}" — it already has ${t.sold} sold`);
      await this.prisma.ticketTier.delete({ where: { id: t.id } });
    }

    for (const t of tiers) {
      if (!t.name?.trim()) throw new BadRequestException('Every ticket tier needs a name');
      const common = {
        name: t.name.trim(),
        price: Math.max(0, Math.round(t.price)),
        quantity: Math.max(0, Math.round(t.quantity)),
        includes: t.includes ?? [],
        description: t.description,
      };
      const found = t.id ? existing.find((e) => e.id === t.id) : undefined;
      if (found) {
        if (common.quantity < found.sold) {
          throw new BadRequestException(`"${found.name}" already sold ${found.sold} — can't reduce quantity below that`);
        }
        await this.prisma.ticketTier.update({ where: { id: found.id }, data: common });
      } else {
        await this.prisma.ticketTier.create({ data: { eventId, ...common } });
      }
    }
  }

  async attendees(userId: string, eventId: string) {
    const org = await this.myOrganizer(userId);
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.organizerId !== org.id) throw new ForbiddenException();

    const bookings = await this.prisma.booking.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } });
    return bookings.flatMap((b) => {
      const guests = b.guests as { name: string; checkedIn: boolean; gender?: string; whatsapp?: string }[];
      return guests.map((g) => ({
        bookingId: b.id,
        bookingStatus: b.status,
        tierName: b.tierName,
        name: g.name,
        gender: g.gender,
        whatsapp: g.whatsapp ?? b.whatsapp,
        checkedIn: g.checkedIn,
      }));
    });
  }

  // ---------- coupons ----------
  async coupons(userId: string) {
    const org = await this.myOrganizer(userId);
    return this.prisma.coupon.findMany({ where: { organizerId: org.id }, orderBy: { validTill: 'desc' } });
  }

  async upsertCoupon(
    userId: string,
    body: {
      id?: string;
      code?: string;
      type?: 'percent' | 'flat';
      value?: number;
      maxDiscount?: number;
      usageLimit?: number;
      perUserLimit?: number;
      eventScope?: string;
      validTill?: string;
      firstTimeOnly?: boolean;
      status?: 'active' | 'paused';
    },
  ) {
    const org = await this.myOrganizer(userId);

    if (body.eventScope && body.eventScope !== 'all') {
      const owns = await this.prisma.event.findFirst({ where: { organizerId: org.id, title: body.eventScope } });
      if (!owns) throw new BadRequestException(`You don't have an event titled "${body.eventScope}"`);
    }

    if (body.id) {
      const existing = await this.prisma.coupon.findUnique({ where: { id: body.id } });
      if (!existing) throw new NotFoundException('Coupon not found');
      if (existing.organizerId !== org.id) throw new ForbiddenException();
      return this.prisma.coupon.update({
        where: { id: body.id },
        data: {
          type: body.type,
          value: body.value,
          maxDiscount: body.maxDiscount,
          usageLimit: body.usageLimit,
          perUserLimit: body.perUserLimit,
          eventScope: body.eventScope,
          validTill: body.validTill ? new Date(body.validTill) : undefined,
          firstTimeOnly: body.firstTimeOnly,
          status: body.status,
        },
      });
    }

    if (!body.code?.trim()) throw new BadRequestException('code is required');
    const code = body.code.trim().toUpperCase();
    if (await this.prisma.coupon.findUnique({ where: { code } })) throw new BadRequestException('This code is already in use');

    return this.prisma.coupon.create({
      data: {
        code,
        type: body.type ?? 'flat',
        value: body.value ?? 0,
        maxDiscount: body.maxDiscount,
        usageLimit: body.usageLimit ?? 100,
        perUserLimit: body.perUserLimit ?? 1,
        eventScope: body.eventScope ?? 'all',
        validTill: body.validTill ? new Date(body.validTill) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        firstTimeOnly: !!body.firstTimeOnly,
        status: body.status ?? 'active',
        organizerId: org.id,
      },
    });
  }

  // ---------- payouts ----------
  async payouts(userId: string) {
    const org = await this.myOrganizer(userId);
    const [agg, ledger] = await Promise.all([
      this.prisma.organizerLedgerTx.aggregate({ where: { organizerId: org.id }, _sum: { amount: true } }),
      this.prisma.organizerLedgerTx.findMany({ where: { organizerId: org.id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { balance: agg._sum.amount ?? 0, ledger };
  }

  async withdraw(userId: string, amount: number) {
    const org = await this.myOrganizer(userId);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Enter a valid amount');
    const agg = await this.prisma.organizerLedgerTx.aggregate({ where: { organizerId: org.id }, _sum: { amount: true } });
    const balance = agg._sum.amount ?? 0;
    if (amount > balance) throw new BadRequestException('More than your available balance');

    await this.prisma.organizerLedgerTx.create({
      data: { organizerId: org.id, type: 'withdrawal', amount: -amount, note: 'Withdrawal to bank' },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await this.wa.send(user.phone, 'organizer_payout', [String(amount)]).catch(() => {});
      await this.email.sendTemplate(user.email, 'payout_processed', {
        name: user.name, amount: money(amount), role: 'organizer',
      }).catch(() => {});
    }
    return { ok: true };
  }

  // ---------- abandoned carts ----------
  /** A cart is "abandoned" if it's the *most recent* hold for that user+event,
   * still `active`, and older than the hold TTL — computed lazily here, not
   * by a background job (there's no cron infra yet — see BACKEND.md). */
  async carts(userId: string) {
    const org = await this.myOrganizer(userId);
    const eventIds = (await this.prisma.event.findMany({ where: { organizerId: org.id }, select: { id: true } })).map((e) => e.id);
    if (!eventIds.length) return [];

    const cutoff = new Date(Date.now() - HOLD_TTL_MS);
    const rows = await this.prisma.cart.findMany({
      where: { eventId: { in: eventIds } },
      include: { user: true, event: { include: { tiers: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const seen = new Set<string>();
    const abandoned: typeof rows = [];
    for (const c of rows) {
      const key = `${c.userId}:${c.eventId}`;
      if (seen.has(key)) continue; // only the latest attempt per user+event counts
      seen.add(key);
      if (c.status === 'active' && c.createdAt < cutoff) abandoned.push(c);
    }

    return abandoned.map((c) => {
      const qtyMap = c.qtyMap as Record<string, number>;
      const tierSummary = Object.entries(qtyMap)
        .map(([tierId, n]) => {
          const t = c.event.tiers.find((tier) => tier.id === tierId);
          return t ? `${n}× ${t.name}` : null;
        })
        .filter(Boolean)
        .join(', ');
      return {
        id: c.id,
        userPhone: c.user.phone,
        userName: c.user.name || 'Guest',
        eventId: c.eventId,
        eventTitle: c.event.title,
        qty: Object.values(qtyMap).reduce((a, n) => a + n, 0),
        qtyMap,
        tierSummary,
        subtotal: c.subtotal,
        total: c.total,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        status: 'abandoned' as const,
        remindedAt: c.remindedAt?.toISOString(),
      };
    });
  }

  // ---------- admin: minimal events review queue ----------
  // Just enough to close the loop opened by upsertEvent() — a full
  // events-approve console is Admin API work (see BACKEND.md), not this phase.
  async listForAdmin(status?: string) {
    return this.prisma.event.findMany({
      where: status ? { status: status as never } : undefined,
      include: { venue: true, organizer: true, tiers: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async adminApprove(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.event.update({ where: { id: eventId }, data: { status: 'approved', rejectionReason: null } });
  }

  async adminReject(eventId: string, reason: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.event.update({ where: { id: eventId }, data: { status: 'rejected', rejectionReason: reason ?? '' } });
  }

  // ---------- admin: per-event commission + payout flag (Reports slice) ----------
  async adminSetCommission(eventId: string, commission: number | null) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (commission != null && (commission < 0 || commission > 100)) throw new BadRequestException('commission must be between 0 and 100');
    return this.prisma.event.update({ where: { id: eventId }, data: { commission } });
  }

  async adminSetPaidOut(eventId: string, paidOut: boolean) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.event.update({ where: { id: eventId }, data: { paidOut } });
  }

  // ---------- admin: pause gate sales (Live Monitor slice) ----------
  async adminSetSalesPaused(eventId: string, paused: boolean) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.event.update({ where: { id: eventId }, data: { salesPaused: paused } });
  }

  // ---------- admin: poster image (Payments/media-upload slice) ----------
  // Narrow and deliberate — NOT full admin event CRUD (EventEditor.tsx's
  // addEvent/updateEvent cover title/tiers/venue/lineup/rules/etc., a much
  // bigger surface mirroring the whole organizer upsertEvent; see
  // BACKEND.md for why that's flagged as a separate, undecided gap).
  async adminSetPoster(eventId: string, posterUrl: string | null) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.event.update({ where: { id: eventId }, data: { posterUrl } });
  }

  async remindCart(userId: string, id: string) {
    const org = await this.myOrganizer(userId);
    const cart = await this.prisma.cart.findUnique({ where: { id }, include: { user: true, event: true } });
    if (!cart) throw new NotFoundException('Cart not found');
    if (cart.event.organizerId !== org.id) throw new ForbiddenException();

    await this.prisma.cart.update({ where: { id }, data: { remindedAt: new Date() } });
    await this.wa
      .send(cart.user.phone, 'cart_reminder', [cart.user.name || 'there', cart.event.title, `${process.env.WEB_APP_URL ?? ''}/events/${cart.event.slug}`])
      .catch(() => {});
    return { ok: true };
  }
}
