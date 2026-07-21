import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';

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
  ) {}

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
   * POST /admin/events/:id/{approve,reject}, never by the organizer directly. */
  async upsertEvent(userId: string, input: EventInput) {
    const org = await this.myOrganizer(userId);
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
      if (existing.organizerId !== org.id) throw new ForbiddenException();
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
      organizerId: org.id,
      status: status as never,
      conditions: input.conditions ?? existing?.conditions ?? [],
      rules: (input.rules ?? existing?.rules ?? []) as Prisma.InputJsonValue,
      lineup: (input.lineup ?? existing?.lineup ?? []) as Prisma.InputJsonValue,
      posterHue: input.posterHue ?? existing?.posterHue ?? (input.title.length * 47) % 360,
      seo: (input.seo ?? existing?.seo) as Prisma.InputJsonValue,
      promoterConfig: (input.promoterConfig ?? existing?.promoterConfig) as Prisma.InputJsonValue,
      socialBanners: (input.socialBanners ?? existing?.socialBanners) as Prisma.InputJsonValue,
    };

    await this.prisma.event.upsert({
      where: { id: eventId },
      create: { id: eventId, slug: slug!, ...data },
      update: data,
    });

    // same merge rule as above: omitting `tiers` entirely (e.g. a status-only
    // resubmit) must leave existing tiers alone, not wipe them
    if (input.tiers) await this.syncTiers(eventId, input.tiers);
    else if (!existing) throw new BadRequestException('At least one ticket tier is required');

    return this.prisma.event.findUniqueOrThrow({ where: { id: eventId }, include: { tiers: true, venue: true } });
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
    if (user) await this.wa.send(user.phone, 'organizer_payout', [String(amount)]).catch(() => {});
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
      include: { venue: true, organizer: true },
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
