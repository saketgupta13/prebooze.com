import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { money } from '../notifications/email-templates';
import { NotificationsService } from '../admin/notifications.service';
import { GuestListService } from '../admin/guestlist.service';
import { LiveMonitorService } from '../admin/live-monitor.service';
import { OrgAccessService } from './org-access.service';

const HOLD_TTL_MS = 8 * 60 * 1000; // matches HoldsService — a cart still `active` past this is abandoned

interface TierInput {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  includes?: string[];
  description?: string;
  coverCharge?: number;
  coverChargeNote?: string;
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
  // Exactly one of venueId or privateCity+privateLocality should be sent —
  // whichever is present (checked via `!== undefined`, so the other mode's
  // fields must be entirely omitted, not sent as ''/null) decides the mode.
  // Omitting both on an edit leaves the event's existing mode untouched.
  venueId?: string;
  privateCity?: string;
  privateLocality?: string;
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
  posterUrl?: string | null;
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
    private guestListSvc: GuestListService,
    private liveMonitorSvc: LiveMonitorService,
    private orgAccess: OrgAccessService,
  ) {}

  /** Any team member (any role) can call this for basic org display context
   * (brand/logo/city — several dashboard pages need it just to show "who am
   * I working for"). PAN/GSTIN/bank details no longer live on this row at
   * all (see PaymentProfile) — they're fetched separately via
   * listPaymentProfiles, gated on "Payouts & withdrawals" there. */
  async me(userId: string) {
    return (await this.orgAccess.resolve(userId)).org;
  }

  /** Every gate-ops endpoint below (guest list, live monitor, manual
   * check-in, promoter guests) needs the same "is this my event" check
   * before touching it — factored out once rather than repeated five times. */
  private async myEvent(userId: string, eventId: string) {
    const org = await this.myOrganizer(userId);
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.organizerId !== org.id) throw new ForbiddenException("Not your event");
    return event;
  }

  // ---------- gate ops: guest list (reuses AdminGuestListService — same
  // GuestListEntry model, just organizer-owned instead of staff-operated) ----------
  async guestList(userId: string, eventId: string) {
    await this.orgAccess.require(userId, 'Guest list', 'view');
    await this.myEvent(userId, eventId);
    return this.guestListSvc.list(eventId);
  }

  async addGuestListEntry(userId: string, eventId: string, body: Parameters<GuestListService['add']>[2]) {
    const org = await this.orgAccess.require(userId, 'Guest list', 'edit');
    await this.myEvent(userId, eventId);
    return this.guestListSvc.add(eventId, org.brandName, body);
  }

  async toggleGuestArrived(userId: string, entryId: string) {
    await this.orgAccess.require(userId, 'Guest list', 'edit');
    const entry = await this.prisma.guestListEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundException('Guest list entry not found');
    await this.myEvent(userId, entry.eventId);
    return this.guestListSvc.toggleArrived(entryId);
  }

  async removeGuestListEntry(userId: string, entryId: string) {
    await this.orgAccess.require(userId, 'Guest list', 'edit');
    const entry = await this.prisma.guestListEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundException('Guest list entry not found');
    await this.myEvent(userId, entry.eventId);
    return this.guestListSvc.remove(entryId);
  }

  /** All promoter-brought guests for this event, across every promoter —
   * unlike PromoterService.guests() (scoped to one promoter's own slug),
   * the organizer needs the full door list for their own event. */
  async promoterGuests(userId: string, eventId: string) {
    await this.orgAccess.require(userId, 'Guest list', 'view');
    await this.myEvent(userId, eventId);
    return this.prisma.promoterGuest.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } });
  }

  // ---------- gate ops: live monitor (reuses AdminLiveMonitorService) ----------
  async live(userId: string, eventId: string) {
    await this.orgAccess.require(userId, 'Attendees & check-in', 'view');
    await this.myEvent(userId, eventId);
    return this.liveMonitorSvc.live(eventId);
  }

  async manualCheckIn(userId: string, eventId: string, name: string, count?: number) {
    await this.orgAccess.require(userId, 'Attendees & check-in', 'edit');
    await this.myEvent(userId, eventId);
    return this.liveMonitorSvc.manualCheckIn(eventId, name, count);
  }

  /** Organizer-owned counterpart to AdminEventsController's pause-sales
   * (staff can already do this for any event; this lets the organizer do it
   * for their own without needing to call support). Same Event.salesPaused
   * field, enforced in the same place (priceHold()). */
  async setSalesPaused(userId: string, eventId: string, paused: boolean) {
    await this.orgAccess.require(userId, 'Events & wizard', 'edit');
    await this.myEvent(userId, eventId);
    return this.prisma.event.update({ where: { id: eventId }, data: { salesPaused: paused } });
  }

  /** Self-serve profile edit — the counterpart to VenueService.updateListing.
   * Covers every field the onboarding form itself captures, so there's no
   * "changes go through support" gap for organizers — unlike Venue (whose
   * city stays admin-gated for directory integrity), an organizer's own
   * brand/username/city are theirs to correct or rebrand. Username changes
   * are checked for collision the same way KycService.newOrganizerRow picks
   * one at creation time, just rejecting instead of auto-suffixing since
   * this is a deliberate rename, not a first-pick. brandName/logoUrl are
   * also mirrored onto User.orgBrand/orgLogoUrl — those are read straight
   * off the JWT-fetched user for the global header, so a rename here used
   * to go stale there until this synced it back. */
  async updateMe(userId: string, patch: { brandName?: string; username?: string; city?: string; country?: string; state?: string; pincode?: string; logoUrl?: string; about?: string; socialLinks?: { instagram?: string; facebook?: string; other?: string[] }; contact?: string; contactPerson?: string; phone?: string; eventTypes?: string }) {
    const org = await this.orgAccess.require(userId, 'Settings & team', 'edit');

    const username = patch.username?.trim().toLowerCase();
    if (username && username !== org.username) {
      if (!/^[a-z0-9-]{3,30}$/.test(username)) throw new BadRequestException('Username must be 3-30 characters — letters, numbers and hyphens only');
      const taken = await this.prisma.organizer.findUnique({ where: { username } });
      if (taken) throw new BadRequestException('That username is already taken');
    }

    const updated = await this.prisma.organizer.update({
      where: { id: org.id },
      data: {
        brandName: patch.brandName?.trim(),
        username,
        city: patch.city?.trim(),
        country: patch.country?.trim(),
        state: patch.state?.trim(),
        pincode: patch.pincode?.trim(),
        logoUrl: patch.logoUrl,
        about: patch.about?.trim(),
        socialLinks: patch.socialLinks as Prisma.InputJsonValue,
        contact: patch.contact?.trim(),
        contactPerson: patch.contactPerson?.trim(),
        phone: patch.phone?.trim(),
        eventTypes: patch.eventTypes,
      },
    });

    if (org.userId && (patch.brandName !== undefined || patch.logoUrl !== undefined || username)) {
      await this.prisma.user.update({
        where: { id: org.userId },
        data: {
          orgBrand: patch.brandName !== undefined ? updated.brandName : undefined,
          orgLogoUrl: patch.logoUrl !== undefined ? updated.logoUrl : undefined,
          orgUsername: username ? updated.username : undefined,
        },
      });
    }

    return updated;
  }


  /** Resolves the org row for the real owner OR an invited team member —
   * plain resolution only, no permission check (callers that need one call
   * orgAccess.require directly; this is for internal ownership lookups like
   * myEvent, and for spots where any team member should pass regardless of
   * role, same as before team members existed at all). */
  private async myOrganizer(userId: string) {
    return (await this.orgAccess.resolve(userId)).org;
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
    const org = await this.orgAccess.require(userId, 'Events & wizard', 'view');
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

    const status = input.status === 'draft' ? 'draft' : 'pending';

    // Mode is decided by which the client actually sent, not by truthiness —
    // omitting both keys entirely (e.g. a status-only resubmit) leaves
    // whichever mode the event already had. A private-address event has no
    // real Venue row at all; guests only ever see privateLocality/privateCity.
    let venueId: string | null;
    let privateCity: string | null;
    let privateLocality: string | null;
    if (input.venueId !== undefined) {
      const venue = input.venueId ? await this.prisma.venue.findUnique({ where: { id: input.venueId } }) : null;
      if (!venue) throw new BadRequestException('Unknown venue');
      venueId = venue.id;
      privateCity = null;
      privateLocality = null;
    } else if (input.privateCity !== undefined || input.privateLocality !== undefined) {
      privateCity = input.privateCity?.trim() || null;
      privateLocality = input.privateLocality?.trim() || null;
      if (!privateCity || !privateLocality) throw new BadRequestException('Both city and locality are required for a private-address event');
      venueId = null;
    } else if (existing) {
      venueId = existing.venueId;
      privateCity = existing.privateCity;
      privateLocality = existing.privateLocality;
    } else {
      throw new BadRequestException('Pick a venue, or set both a city and locality for a private-address event');
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
      venueId,
      privateCity,
      privateLocality,
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
      posterUrl: input.posterUrl !== undefined ? input.posterUrl : (existing?.posterUrl ?? null),
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
    const org = await this.orgAccess.require(userId, 'Events & wizard', 'edit');
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
      const price = Math.max(0, Math.round(t.price));
      const coverCharge = Math.max(0, Math.round(t.coverCharge ?? 0));
      if (coverCharge > price) throw new BadRequestException(`"${t.name}"'s cover charge can't exceed its ticket price`);
      const common = {
        name: t.name.trim(),
        price,
        quantity: Math.max(0, Math.round(t.quantity)),
        includes: t.includes ?? [],
        description: t.description,
        coverCharge,
        coverChargeNote: t.coverChargeNote,
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
    const org = await this.orgAccess.require(userId, 'Attendees & check-in', 'view');
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.organizerId !== org.id) throw new ForbiddenException();

    const bookings = await this.prisma.booking.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } });
    return bookings.flatMap((b) => {
      // Check-in happens once per booking (one QR, scanned at the gate for
      // the whole party) — the real BookingsService.checkIn only ever flips
      // Booking.checkedIn, never the per-guest `g.checkedIn` in this JSON
      // (that field is initialized false at creation and never written to
      // again). Reading b.checkedIn here means every guest in the party
      // reflects the real scan instead of always showing "not checked in".
      const guests = b.guests as { name: string; checkedIn: boolean; gender?: string; whatsapp?: string }[];
      return guests.map((g, i) => ({
        bookingId: b.id,
        bookingStatus: b.status,
        tierName: b.tierName,
        name: g.name,
        // guests[0] is always the buyer (see BookingsService.create/adminCreate
        // — mainGuest is unshifted onto the front of the array at creation,
        // never reordered after) — lets the scanner group a multi-guest
        // booking's search results under the buyer's name regardless of
        // which guest's name actually matched the search.
        isMainGuest: i === 0,
        gender: g.gender,
        whatsapp: g.whatsapp ?? b.whatsapp,
        checkedIn: b.checkedIn,
        coverCharge: b.coverCharge,
        total: b.total,
        // Self-checkout (guest paid via Razorpay) sets paymentId, never
        // paymentMethod; staff-recorded manual/comp bookings are the
        // reverse (BookingsService.create vs .adminCreate) — the two
        // fields are mutually exclusive, so this always resolves to
        // exactly one real answer, not a guess.
        paymentMethod: b.paymentId ? 'Online' : b.paymentMethod ?? '—',
      }));
    });
  }

  // ---------- coupons ----------
  async coupons(userId: string) {
    const org = await this.orgAccess.require(userId, 'Coupons', 'view');
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
      gender?: string;
      description?: string;
    },
  ) {
    const org = await this.orgAccess.require(userId, 'Coupons', 'edit');

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
          gender: body.gender,
          description: body.description,
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
        gender: body.gender ?? 'all',
        description: body.description,
        organizerId: org.id,
      },
    });
  }

  // ---------- payouts ----------
  async payouts(userId: string) {
    const org = await this.orgAccess.require(userId, 'Payouts & withdrawals', 'view');
    const [agg, ledger] = await Promise.all([
      this.prisma.organizerLedgerTx.aggregate({ where: { organizerId: org.id }, _sum: { amount: true } }),
      this.prisma.organizerLedgerTx.findMany({ where: { organizerId: org.id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { balance: agg._sum.amount ?? 0, ledger };
  }

  /** Per-event, per-promoter breakdown of what this organizer owes each
   * promoter — the mirror image of PromoterService.perEventEarnings, same
   * two components (live per-head off arrivals, locked-in commission off
   * Booking.promoterCommission) and same settlement-status source, just
   * grouped by promoter instead of assumed to be "me". */
  async promoterPayouts(userId: string) {
    const org = await this.orgAccess.require(userId, 'Payouts & withdrawals', 'view');
    const events = await this.prisma.event.findMany({
      where: { organizerId: org.id },
      select: { id: true, title: true, date: true, promoterConfig: true },
    });
    const eventIds = events.map((e) => e.id);
    const eventById = new Map(events.map((e) => [e.id, e]));
    if (!eventIds.length) return [];

    const [arrivedGuests, bookings] = await Promise.all([
      this.prisma.promoterGuest.findMany({ where: { eventId: { in: eventIds }, arrived: true }, select: { eventId: true, promoterSlug: true } }),
      this.prisma.booking.findMany({ where: { eventId: { in: eventIds }, status: 'confirmed', promoterCommission: { gt: 0 } }, select: { eventId: true, promoterRef: true, promoterCommission: true } }),
    ]);

    const slugs = new Set<string>([...arrivedGuests.map((g) => g.promoterSlug), ...bookings.map((b) => b.promoterRef).filter((s): s is string => !!s)]);
    const promoters = await this.prisma.promoter.findMany({ where: { slug: { in: [...slugs] } }, select: { id: true, slug: true, name: true } });
    const promoterBySlug = new Map(promoters.map((p) => [p.slug, p]));

    const settlements = await this.prisma.promoterEventSettlement.findMany({
      where: { eventId: { in: eventIds }, promoterId: { in: promoters.map((p) => p.id) } },
    });
    const settlementByKey = new Map(settlements.map((s) => [`${s.eventId}::${s.promoterId}`, s]));

    const rows = new Map<string, { eventId: string; eventTitle: string; eventDate: Date; promoterId: string; promoterName: string; perHead: number; commission: number }>();
    const ensure = (eventId: string, slug: string) => {
      const promoter = promoterBySlug.get(slug);
      if (!promoter) return null;
      const key = `${eventId}::${promoter.id}`;
      let row = rows.get(key);
      if (!row) {
        const event = eventById.get(eventId)!;
        row = { eventId, eventTitle: event.title, eventDate: event.date, promoterId: promoter.id, promoterName: promoter.name, perHead: 0, commission: 0 };
        rows.set(key, row);
      }
      return row;
    };

    for (const g of arrivedGuests) {
      const cfg = eventById.get(g.eventId)?.promoterConfig as unknown as
        { enabled?: boolean; perHeadPayout?: boolean; perHeadAmount?: number; allowedPromoters?: string[]; guestListPromoters?: string[] } | null;
      const glp = cfg?.guestListPromoters ?? cfg?.allowedPromoters ?? [];
      if (!cfg?.enabled || !cfg.perHeadPayout || !glp.includes(g.promoterSlug)) continue;
      const row = ensure(g.eventId, g.promoterSlug);
      if (row) row.perHead += cfg.perHeadAmount ?? 0;
    }
    for (const b of bookings) {
      if (!b.promoterRef) continue;
      const row = ensure(b.eventId, b.promoterRef);
      if (row) row.commission += b.promoterCommission;
    }

    return [...rows.values()]
      .map((r) => ({ ...r, total: r.perHead + r.commission, status: settlementByKey.get(`${r.eventId}::${r.promoterId}`)?.status ?? 'pending' }))
      .sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
  }

  /** Promoter-centric roster for the organizer's own "Promoters" page — same
   * numbers promoterPayouts() computes per event, rolled up per promoter
   * with their profile + FULL bank details attached (bankAccountNumber, not
   * just bankLast4 — the organizer is the one who actually has to wire this
   * money, same "give whoever executes the payout the real number"
   * precedent as admin/organizer's own bank details). Includes promoters
   * allowed on an event with zero earnings yet too, since the organizer
   * still wants their contact on file the moment they're added. */
  async promoters(userId: string) {
    const org = await this.orgAccess.require(userId, 'Payouts & withdrawals', 'view');
    const events = await this.prisma.event.findMany({
      where: { organizerId: org.id },
      select: { id: true, title: true, date: true, promoterConfig: true },
    });
    const eventIds = events.map((e) => e.id);
    const eventById = new Map(events.map((e) => [e.id, e]));
    if (!eventIds.length) return [];

    const allowedSlugs = new Set<string>();
    for (const e of events) {
      const cfg = e.promoterConfig as unknown as { allowedPromoters?: string[] } | null;
      (cfg?.allowedPromoters ?? []).forEach((s) => allowedSlugs.add(s));
    }
    if (!allowedSlugs.size) return [];

    const [arrivedGuests, bookings, promoters] = await Promise.all([
      this.prisma.promoterGuest.findMany({ where: { eventId: { in: eventIds }, arrived: true }, select: { eventId: true, promoterSlug: true } }),
      this.prisma.booking.findMany({ where: { eventId: { in: eventIds }, status: 'confirmed', promoterCommission: { gt: 0 } }, select: { eventId: true, promoterRef: true, promoterCommission: true } }),
      this.prisma.promoter.findMany({
        where: { slug: { in: [...allowedSlugs] } },
        select: {
          id: true, slug: true, name: true, city: true, bio: true, contact: true, verified: true,
          bankName: true, bankAccountNumber: true, bankLast4: true, accountHolderName: true, ifsc: true,
        },
      }),
    ]);
    const promoterBySlug = new Map(promoters.map((p) => [p.slug, p]));

    const settlements = await this.prisma.promoterEventSettlement.findMany({
      where: { eventId: { in: eventIds }, promoterId: { in: promoters.map((p) => p.id) } },
    });

    const perPromoter = new Map<string, { perHead: number; commission: number; events: Set<string> }>();
    const ensure = (promoterId: string) => {
      let row = perPromoter.get(promoterId);
      if (!row) {
        row = { perHead: 0, commission: 0, events: new Set() };
        perPromoter.set(promoterId, row);
      }
      return row;
    };

    for (const g of arrivedGuests) {
      const cfg = eventById.get(g.eventId)?.promoterConfig as unknown as
        { enabled?: boolean; perHeadPayout?: boolean; perHeadAmount?: number; allowedPromoters?: string[]; guestListPromoters?: string[] } | null;
      const glp = cfg?.guestListPromoters ?? cfg?.allowedPromoters ?? [];
      if (!cfg?.enabled || !cfg.perHeadPayout || !glp.includes(g.promoterSlug)) continue;
      const promoter = promoterBySlug.get(g.promoterSlug);
      if (!promoter) continue;
      const row = ensure(promoter.id);
      row.perHead += cfg.perHeadAmount ?? 0;
      row.events.add(g.eventId);
    }
    for (const b of bookings) {
      if (!b.promoterRef) continue;
      const promoter = promoterBySlug.get(b.promoterRef);
      if (!promoter) continue;
      const row = ensure(promoter.id);
      row.commission += b.promoterCommission;
      row.events.add(b.eventId);
    }

    return promoters
      .map((p) => {
        const agg = perPromoter.get(p.id) ?? { perHead: 0, commission: 0, events: new Set<string>() };
        const receivedEventIds = new Set(settlements.filter((s) => s.promoterId === p.id && s.status === 'received').map((s) => s.eventId));
        const pendingEvents = [...agg.events].filter((id) => !receivedEventIds.has(id)).length;
        return {
          promoterId: p.id, promoterSlug: p.slug, promoterName: p.name, city: p.city, bio: p.bio, contact: p.contact, verified: p.verified,
          bankName: p.bankName, bankAccountNumber: p.bankAccountNumber, bankLast4: p.bankLast4, accountHolderName: p.accountHolderName, ifsc: p.ifsc,
          eventCount: agg.events.size, totalOwed: agg.perHead + agg.commission, pendingEvents,
        };
      })
      .sort((a, b) => b.totalOwed - a.totalOwed);
  }

  // ---------- payment profiles (bank accounts to withdraw to) ----------
  /** Self-serve, no admin review — decoupled from identity verification
   * (Organizer.verified) entirely. An organizer can hold several of these
   * (different legal entities/accounts); withdraw() always pays out to
   * whichever is isDefault. Same "Payouts & withdrawals" gate withdraw()
   * itself uses, since this is exactly as sensitive as withdrawing. */
  async listPaymentProfiles(userId: string) {
    const org = await this.orgAccess.require(userId, 'Payouts & withdrawals', 'view');
    return this.prisma.paymentProfile.findMany({ where: { organizerId: org.id }, orderBy: { createdAt: 'asc' } });
  }

  private validatePaymentProfileInput(data: {
    legalName?: string | null; businessAddress?: string | null; country?: string | null; state?: string | null; city?: string | null; pincode?: string | null;
    bankAccountNumber?: string | null; accountHolderName?: string | null; ifsc?: string | null; branch?: string | null;
    pan?: string | null; gstin?: string | null; noGst?: boolean | null;
  }) {
    if (!data.legalName?.trim()) throw new BadRequestException('Company/Firm/LLP/Individual name is required');
    if (!data.businessAddress?.trim()) throw new BadRequestException('Business address is required');
    if (!data.bankAccountNumber?.trim() || !data.accountHolderName?.trim() || !data.ifsc?.trim()) {
      throw new BadRequestException('Full bank account details are required');
    }
    if (!data.pan?.trim()) throw new BadRequestException('PAN is required');
    if (!data.noGst && !data.gstin?.trim()) throw new BadRequestException('GSTIN is required, or tick "I don\'t have a GSTIN"');
  }

  async createPaymentProfile(userId: string, data: {
    legalName: string; businessAddress: string; country?: string; state?: string; city?: string; pincode?: string;
    bankAccountNumber: string; accountHolderName: string; ifsc: string; branch?: string;
    pan: string; gstin?: string; noGst?: boolean;
  }) {
    const org = await this.orgAccess.require(userId, 'Payouts & withdrawals', 'edit');
    this.validatePaymentProfileInput(data);
    const bankAccountNumber = data.bankAccountNumber.trim();
    const isFirst = (await this.prisma.paymentProfile.count({ where: { organizerId: org.id } })) === 0;
    return this.prisma.paymentProfile.create({
      data: {
        organizerId: org.id,
        isDefault: isFirst,
        legalName: data.legalName.trim(),
        businessAddress: data.businessAddress.trim(),
        country: data.country?.trim(),
        state: data.state?.trim(),
        city: data.city?.trim(),
        pincode: data.pincode?.trim(),
        bankAccountNumber,
        bankLast4: bankAccountNumber.slice(-4),
        accountHolderName: data.accountHolderName.trim(),
        ifsc: data.ifsc.trim().toUpperCase(),
        branch: data.branch?.trim(),
        pan: data.pan.trim().toUpperCase(),
        gstin: data.noGst ? null : data.gstin?.trim().toUpperCase(),
        noGst: !!data.noGst,
      },
    });
  }

  private async ownedPaymentProfile(orgId: string, id: string) {
    const profile = await this.prisma.paymentProfile.findUnique({ where: { id } });
    if (!profile || profile.organizerId !== orgId) throw new NotFoundException('Payment profile not found');
    return profile;
  }

  async updatePaymentProfile(userId: string, id: string, data: {
    legalName?: string; businessAddress?: string; country?: string; state?: string; city?: string; pincode?: string;
    bankAccountNumber?: string; accountHolderName?: string; ifsc?: string; branch?: string;
    pan?: string; gstin?: string; noGst?: boolean;
  }) {
    const org = await this.orgAccess.require(userId, 'Payouts & withdrawals', 'edit');
    const existing = await this.ownedPaymentProfile(org.id, id);
    const merged = { ...existing, ...data };
    this.validatePaymentProfileInput(merged);
    const bankAccountNumber = data.bankAccountNumber?.trim() ?? existing.bankAccountNumber;
    return this.prisma.paymentProfile.update({
      where: { id },
      data: {
        legalName: data.legalName?.trim(),
        businessAddress: data.businessAddress?.trim(),
        country: data.country?.trim(),
        state: data.state?.trim(),
        city: data.city?.trim(),
        pincode: data.pincode?.trim(),
        bankAccountNumber,
        bankLast4: bankAccountNumber.slice(-4),
        accountHolderName: data.accountHolderName?.trim(),
        ifsc: data.ifsc?.trim().toUpperCase(),
        branch: data.branch?.trim(),
        pan: data.pan?.trim().toUpperCase(),
        gstin: data.noGst ? null : data.gstin?.trim().toUpperCase(),
        noGst: data.noGst,
      },
    });
  }

  /** Deleting the current default auto-promotes the next-oldest remaining
   * profile, so withdraw() never has to special-case "default just got
   * deleted" — it always either finds exactly one default or none at all. */
  async deletePaymentProfile(userId: string, id: string) {
    const org = await this.orgAccess.require(userId, 'Payouts & withdrawals', 'edit');
    const target = await this.ownedPaymentProfile(org.id, id);
    await this.prisma.paymentProfile.delete({ where: { id } });
    if (target.isDefault) {
      const next = await this.prisma.paymentProfile.findFirst({ where: { organizerId: org.id }, orderBy: { createdAt: 'asc' } });
      if (next) await this.prisma.paymentProfile.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { ok: true };
  }

  async setDefaultPaymentProfile(userId: string, id: string) {
    const org = await this.orgAccess.require(userId, 'Payouts & withdrawals', 'edit');
    await this.ownedPaymentProfile(org.id, id);
    await this.prisma.$transaction([
      this.prisma.paymentProfile.updateMany({ where: { organizerId: org.id, isDefault: true }, data: { isDefault: false } }),
      this.prisma.paymentProfile.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return { ok: true };
  }

  async withdraw(userId: string, amount: number) {
    const org = await this.orgAccess.require(userId, 'Payouts & withdrawals', 'edit');
    // Identity verification (Organizer.verified) is a badge only — it never
    // blocks a withdrawal. The real requirement is having somewhere to send
    // the money: a default PaymentProfile. Signup no longer collects bank
    // details at all (see KycService.quickSignupOrganizer), so without this
    // guard an organizer with zero payment profiles could debit their own
    // ledger with nowhere to actually wire the money.
    const profile = await this.prisma.paymentProfile.findFirst({ where: { organizerId: org.id, isDefault: true } });
    if (!profile) throw new BadRequestException('Add a payment profile (Settings → Payment profiles) before withdrawing');
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Enter a valid amount');
    const agg = await this.prisma.organizerLedgerTx.aggregate({ where: { organizerId: org.id }, _sum: { amount: true } });
    const balance = agg._sum.amount ?? 0;
    if (amount > balance) throw new BadRequestException('More than your available balance');

    // Snapshot which account this specific payout went to — a later edit or
    // deletion of the profile must never change the historical record of
    // where this withdrawal actually landed.
    await this.prisma.organizerLedgerTx.create({
      data: {
        organizerId: org.id, type: 'withdrawal', amount: -amount, note: 'Withdrawal to bank',
        paymentProfileId: profile.id, payoutBankLast4: profile.bankLast4,
        payoutAccountHolderName: profile.accountHolderName, payoutIfsc: profile.ifsc,
      },
    });

    // Notify the account owner, not whoever triggered it — the payout lands
    // in the owner's bank account regardless of which team member with
    // "Payouts & withdrawals" edit access clicked withdraw, so that's who
    // needs to know it happened.
    const user = org.userId ? await this.prisma.user.findUnique({ where: { id: org.userId } }) : null;
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
    const org = await this.orgAccess.require(userId, 'Events & wizard', 'view');
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

  /** Notifies the real event owner regardless of who actually clicked
   * approve/reject at the org (a real team member with "Events & wizard"
   * edit could be the one who submitted it) — same reasoning as
   * OrganizerService.withdraw notifying org.userId, not the caller. A
   * solo venue-hosted event (Event.hostedByVenue, no organizer) has no
   * Organizer row to look up at all — falls back to the venue's own
   * owning user in that case. */
  private async notifyEventOwner(event: { organizerId: string | null; hostedByVenue: boolean; venueId: string | null }): Promise<{ email: string; name: string } | null> {
    if (!event.organizerId) {
      if (!event.hostedByVenue || !event.venueId) return null;
      const venue = await this.prisma.venue.findUnique({ where: { id: event.venueId } });
      if (!venue?.userId) return null;
      const user = await this.prisma.user.findUnique({ where: { id: venue.userId } });
      return user?.email ? { email: user.email, name: user.name } : null;
    }
    const org = await this.prisma.organizer.findUnique({ where: { id: event.organizerId } });
    if (!org?.userId) return null;
    const user = await this.prisma.user.findUnique({ where: { id: org.userId } });
    return user?.email ? { email: user.email, name: user.name } : null;
  }

  async adminApprove(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const updated = await this.prisma.event.update({ where: { id: eventId }, data: { status: 'approved', rejectionReason: null } });
    const owner = await this.notifyEventOwner(event);
    if (owner) {
      await this.email.sendTemplate(owner.email, 'event_approved', {
        name: owner.name, eventTitle: updated.title, eventSlug: updated.slug,
      }).catch(() => {});
    }
    return updated;
  }

  async adminReject(eventId: string, reason: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const updated = await this.prisma.event.update({ where: { id: eventId }, data: { status: 'rejected', rejectionReason: reason ?? '' } });
    const owner = await this.notifyEventOwner(event);
    if (owner) {
      const reasonBlock = reason
        ? `<p style="background:rgba(255,107,94,.08);border:1px solid rgba(255,107,94,.25);border-radius:8px;padding:10px 12px;">${reason}</p>`
        : '';
      await this.email.sendTemplate(owner.email, 'event_rejected', {
        name: owner.name, eventTitle: updated.title, reasonBlock,
      }).catch(() => {});
    }
    return updated;
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
  // A narrow one-field patch, kept even though full admin event CRUD exists
  // too (adminUpsertEvent, above) — EventEditorReal.tsx's own poster upload
  // step calls this directly rather than round-tripping the whole event
  // payload just to change one image.
  async adminSetPoster(eventId: string, posterUrl: string | null) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.event.update({ where: { id: eventId }, data: { posterUrl } });
  }

  async remindCart(userId: string, id: string) {
    const org = await this.orgAccess.require(userId, 'Events & wizard', 'edit');
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
