import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { toCitySlug } from '../common/city-slug';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../admin/notifications.service';
import { StaffAlertsService } from '../notifications/staff-alerts';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { money } from '../notifications/email-templates';
import { MetaConversionsService } from '../meta/meta-conversions.service';
import { LeadsService } from '../admin/leads.service';
import { GuestListService } from '../admin/guestlist.service';
import { LiveMonitorService } from '../admin/live-monitor.service';
import { VenueAccessService } from './venue-access.service';

interface OnboardInput {
  name?: string;
  type?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  address?: string;
  capacity?: number;
  amenities?: string[];
  timings?: string;
  about?: string;
  galleryUrls?: string[];
  logoUrl?: string;
  contactPerson?: string;
  contactPersonPhone?: string;
  socialLinks?: { instagram?: string; facebook?: string; other?: string[] };
}

interface HostedTierInput {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  includes?: string[];
  description?: string;
  coverCharge?: number;
  coverChargeNote?: string;
}

/** A venue's own event — same shape as organizer.service.ts's EventInput,
 * minus venueId/privateCity/privateLocality (a venue always hosts at its
 * own address, there's no picking), plus an optional collaborating
 * organizer. Deliberately a parallel type + parallel saveHostedEvent
 * implementation rather than a shared one with OrganizerService — the
 * live organizer event-creation path stays completely untouched by this
 * feature; duplicating ~80 lines here is a better trade than adding any
 * risk to the flow every existing organizer depends on right now. */
export interface VenueEventInput {
  id?: string;
  title: string;
  description?: string;
  category?: string;
  subCategory?: string;
  ageLimit?: string;
  tags?: string[];
  date?: string;
  durationHrs?: number;
  // undefined = leave whatever collaborator this event already has
  // (or none, on create); null/'' = explicitly solo, no organizer.
  organizerId?: string | null;
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
  tiers?: HostedTierInput[];
}

function slugifyBase(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'event';
}

const HOLD_TTL_MS = 8 * 60 * 1000; // matches OrganizerService/HoldsService — a cart still `active` past this is abandoned

@Injectable()
export class VenueService {
  private readonly log = new Logger('Venue');

  constructor(
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
    private notifications: NotificationsService,
    private staffAlerts: StaffAlertsService,
    private wa: WhatsappService,
    private email: EmailService,
    private meta: MetaConversionsService,
    private leads: LeadsService,
    private guestListSvc: GuestListService,
    private liveMonitorSvc: LiveMonitorService,
    private venueAccess: VenueAccessService,
  ) {}

  // ---------- subscription (Razorpay-billed venue plans) ----------
  async subscriptionTiers() {
    return this.subscriptions.tiers('venue');
  }

  async mySubscription(userId: string) {
    const venue = await this.myVenue(userId);
    return this.subscriptions.current('venue', venue.id);
  }

  async subscribe(userId: string, tierId: string) {
    const venue = await this.myVenue(userId);
    return this.subscriptions.subscribe('venue', venue.id, tierId);
  }

  async cancelSubscription(userId: string) {
    const venue = await this.myVenue(userId);
    return this.subscriptions.cancel('venue', venue.id);
  }

  private async myVenue(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.venueId) throw new ForbiddenException('Not an approved venue partner');
    const venue = await this.prisma.venue.findUnique({ where: { id: user.venueId } });
    if (!venue) throw new NotFoundException('Venue listing not found');
    return venue;
  }

  private async uniqueId(base: string) {
    let candidate = base;
    let n = 1;
    while (await this.prisma.venue.findUnique({ where: { id: candidate } })) {
      candidate = `${base}-${++n}`;
    }
    return candidate;
  }

  /** Self-serve venue signup, minimal — same shape as
   * KycService.quickSignupOrganizer: listing details only, no documents, no
   * admin review. The Venue catalog row is created immediately (unverified)
   * — it shows up in the directory and is pickable by organizers right
   * away, and `role`/`roleStatus` are approved in the same transaction, so
   * a venue owner can start using their console the moment they submit
   * this. `verified` now means only "identity verification passed"
   * (KycService.submitVenueVerification), same decoupling as organizer —
   * entirely separate from being live/usable. */
  async onboard(userId: string, input: OnboardInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException();
    if (user.role) {
      throw new BadRequestException(
        user.role === 'venue' ? "You're already an approved venue partner" : 'This number already holds a role — one number, one role',
      );
    }
    if (user.roleStatus === 'pending') throw new BadRequestException('Your application is already under review');

    if (!input.name?.trim() || !input.city?.trim() || !input.address?.trim() || !(Number(input.capacity) > 0) || !input.about?.trim()) {
      throw new BadRequestException('name, city, address, capacity and about are required');
    }

    const id = await this.uniqueId(
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'venue',
    );

    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;

    const venueData = {
      id,
      name: input.name.trim(),
      verified: false,
      type: input.type ?? '',
      city: input.city.trim(),
      state: input.state?.trim(),
      country: input.country?.trim(),
      pincode: input.pincode?.trim(),
      address: input.address.trim(),
      capacity: Number(input.capacity),
      amenities: input.amenities ?? [],
      about: input.about.trim(),
      timings: input.timings,
      photoHue: h,
      logoUrl: input.logoUrl,
      contactPerson: input.contactPerson?.trim(),
      contactPersonPhone: input.contactPersonPhone?.trim(),
      socialLinks: input.socialLinks as Prisma.InputJsonValue,
      userId,
    };

    const [venue] = await this.prisma.$transaction([
      this.prisma.venue.create({ data: venueData }),
      this.prisma.user.update({
        where: { id: userId },
        data: { venueName: venueData.name, venueLogoUrl: venueData.logoUrl, venueId: id, role: 'venue', roleStatus: 'approved' },
      }),
    ]);

    // Server-side mirror of the browser Pixel's Lead event (see
    // VenueOnboarding.tsx's trackMeta call) — same `${phone}_venue`
    // event_id both sides use, matching the kyc.service.ts Lead pattern
    // for organizer/promoter/lineup.
    this.meta
      .sendEvent('Lead', `${user.phone}_venue`, 'https://prebooze.com/venue/onboarding', { phone: user.phone, email: user.email }, user.marketingConsent, { content_name: 'venue_onboarding' })
      .catch(() => {});
    this.leads.resolveDraft(user.phone, 'venue').catch(() => {});
    await this.notifications.notify('🏛', `${venue.name} signed up as a new venue`, '/venues').catch(() => {});

    return venue;
  }

  /** `favourites` is computed here, not stored — VenueFavourite rows exist
   * (guests can favourite a venue) but nothing ever aggregated them onto a
   * field the dashboard could read; VenueDashboard.tsx's "Followers &
   * favourites" stat was silently only ever showing the Follow-table count. */
  async myListing(userId: string) {
    const venue = await this.myVenue(userId);
    const favourites = await this.prisma.venueFavourite.count({ where: { venueId: venue.id } });
    return { ...venue, favourites };
  }

  /** City changes are admin-gated — everything else an owner can edit freely.
   * A city patch never touches `city` directly; it lands in `pendingCity`
   * for an admin to approve/reject (DirectoryService.approveVenueCityChange/
   * rejectVenueCityChange) — a guest's city filter and every directory
   * listing depend on `city` matching admin's real enabled-cities list, so
   * a typo or an unlisted city here would make the venue invisible to
   * everyone until someone noticed. State/country/pincode carry no such
   * consequence and stay freely self-editable. name/logoUrl are also
   * mirrored onto User.venueName/venueLogoUrl — same reasoning as
   * OrganizerService.updateMe's orgBrand/orgLogoUrl sync: those are read
   * straight off the JWT-fetched user for the global header, so a rename or
   * logo change here used to go stale there until this synced it back
   * (venueLogoUrl didn't even exist as a column before this fix, so the
   * header never had a venue logo to show at all). */
  async updateListing(userId: string, patch: Partial<OnboardInput>) {
    const venue = await this.myVenue(userId);
    const cityChangeRequested = patch.city !== undefined && patch.city.trim() !== venue.city;

    const updated = await this.prisma.venue.update({
      where: { id: venue.id },
      data: {
        name: patch.name?.trim(),
        type: patch.type,
        state: patch.state?.trim(),
        country: patch.country?.trim(),
        pincode: patch.pincode?.trim(),
        pendingCity: cityChangeRequested ? patch.city!.trim() : undefined,
        address: patch.address?.trim(),
        capacity: patch.capacity !== undefined ? Number(patch.capacity) : undefined,
        amenities: patch.amenities,
        timings: patch.timings,
        about: patch.about?.trim(),
        galleryUrls: patch.galleryUrls,
        logoUrl: patch.logoUrl,
        contactPerson: patch.contactPerson?.trim(),
        contactPersonPhone: patch.contactPersonPhone?.trim(),
        socialLinks: patch.socialLinks as Prisma.InputJsonValue,
      },
    });

    if (cityChangeRequested) {
      await this.notifications.notify('🏙', `City change requested — ${venue.name} wants to move from ${venue.city} to ${patch.city!.trim()}`, '/admin/venues');
      await this.staffAlerts.alert(`🏙 City change requested — ${venue.name}: ${venue.city} → ${patch.city!.trim()}`).catch(() => {});
    }

    if (patch.name !== undefined || patch.logoUrl !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          venueName: patch.name !== undefined ? updated.name : undefined,
          venueLogoUrl: patch.logoUrl !== undefined ? updated.logoUrl : undefined,
        },
      });
    }

    return updated;
  }

  async events(userId: string) {
    const venue = await this.myVenue(userId);
    return this.prisma.event.findMany({
      where: { venueId: venue.id, status: 'approved' },
      // a venue partner isn't the organizer's staff — never expose the
      // organizer's contact/GSTIN/PAN/bank fields (Admin API directory
      // slice) through this console, same reasoning as the public catalog.
      include: {
        tiers: true,
        organizer: { select: { id: true, brandName: true, username: true, verified: true, city: true, about: true, logoHue: true, contact: true } },
      },
      orderBy: { date: 'asc' },
    });
  }

  // ============================================================
  // Venue hosting — opt-in, admin-gated. Every method below is a no-op for
  // the overwhelming majority of venues (hostingEnabled stays false
  // forever unless they explicitly ask and admin approves) — nothing here
  // changes what events()/myListing()/onboard() above already do.
  // ============================================================

  /** What the venue's own dashboard needs to decide what to show: nothing
   * (never asked), a pending/rejected request, or fully enabled. */
  async hostingStatus(userId: string) {
    const venue = await this.myVenue(userId);
    const latest = await this.prisma.venueHostingRequest.findFirst({
      where: { venueId: venue.id },
      orderBy: { createdAt: 'desc' },
    });
    return { hostingEnabled: venue.hostingEnabled, request: latest };
  }

  /** The opt-in itself — creates a request, does NOT enable anything.
   * Notifies admin the same way a city-change request does (bell +
   * WhatsApp alert to staff), since this needs a real human review, not
   * an automatic approval. */
  async requestHosting(userId: string) {
    const venue = await this.myVenue(userId);
    if (venue.hostingEnabled) throw new BadRequestException('Event hosting is already enabled for your venue');
    const pending = await this.prisma.venueHostingRequest.findFirst({ where: { venueId: venue.id, status: 'pending' } });
    if (pending) throw new BadRequestException('You already have a hosting request under review');

    const request = await this.prisma.venueHostingRequest.create({ data: { venueId: venue.id } });
    await this.prisma.venue.update({ where: { id: venue.id }, data: { hostingRequestedAt: new Date() } });

    await this.notifications.notify('🎪', `${venue.name} wants to host their own events — review before approving`, '/admin/venues');
    await this.staffAlerts.alert(`🎪 Venue hosting request — ${venue.name} (${venue.city})`).catch(() => {});
    return request;
  }

  /** All events this venue itself hosts (Event.hostedByVenue), any
   * status — unlike events() above (approved events booked by *any*
   * organizer), this is the venue managing its own drafts/pending/live
   * events, the same visibility an organizer has over their own events. */
  async hostedEvents(userId: string) {
    const venue = await this.venueAccess.require(userId, 'Events & wizard', 'view');
    return this.prisma.event.findMany({
      where: { venueId: venue.id, hostedByVenue: true },
      include: { tiers: true, organizer: { select: { id: true, brandName: true, username: true, verified: true } } },
      orderBy: { date: 'desc' },
    });
  }

  /** Same "is this my event" gate organizer.service.ts's private myEvent()
   * does, mirrored for venue-hosted events instead of organizer-owned ones
   * — every gate-ops method below (attendees, guest list, live monitor)
   * needs it before touching an event. Takes an already-resolved venue
   * (from venueAccess.require, which already asserted hostingEnabled + the
   * right permission) rather than resolving one itself. */
  private async myHostedEvent(venue: { id: string }, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.venueId !== venue.id || !event.hostedByVenue) throw new ForbiddenException('Not your event');
    return event;
  }

  /** Mirrors OrganizerService.attendees() exactly, scoped to this venue's
   * own hosted events instead of an organizer's. */
  async attendees(userId: string, eventId: string) {
    const venue = await this.venueAccess.require(userId, 'Attendees & check-in', 'view');
    await this.myHostedEvent(venue, eventId);
    const bookings = await this.prisma.booking.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } });
    return bookings.flatMap((b) => {
      const guests = b.guests as { name: string; checkedIn: boolean; gender?: string; whatsapp?: string }[];
      return guests.map((g, i) => ({
        bookingId: b.id,
        bookingStatus: b.status,
        tierName: b.tierName,
        name: g.name,
        isMainGuest: i === 0,
        gender: g.gender,
        whatsapp: g.whatsapp ?? b.whatsapp,
        checkedIn: b.checkedIn,
        coverCharge: b.coverCharge,
        total: b.total,
        paymentMethod: b.paymentId ? 'Online' : b.paymentMethod ?? '—',
      }));
    });
  }

  // ---------- gate ops: guest list (mirrors OrganizerService, reuses the
  // same AdminGuestListService — GuestListEntry has no organizer/venue FK
  // at all, just eventId, so the shared CRUD needs no changes) ----------
  async guestList(userId: string, eventId: string) {
    const venue = await this.venueAccess.require(userId, 'Guest list', 'view');
    await this.myHostedEvent(venue, eventId);
    return this.guestListSvc.list(eventId);
  }

  async addGuestListEntry(userId: string, eventId: string, body: Parameters<GuestListService['add']>[2]) {
    const venue = await this.venueAccess.require(userId, 'Guest list', 'edit');
    await this.myHostedEvent(venue, eventId);
    return this.guestListSvc.add(eventId, venue.name, body);
  }

  async toggleGuestArrived(userId: string, entryId: string) {
    const venue = await this.venueAccess.require(userId, 'Guest list', 'edit');
    const entry = await this.prisma.guestListEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundException('Guest list entry not found');
    await this.myHostedEvent(venue, entry.eventId);
    return this.guestListSvc.toggleArrived(entryId);
  }

  async removeGuestListEntry(userId: string, entryId: string) {
    const venue = await this.venueAccess.require(userId, 'Guest list', 'edit');
    const entry = await this.prisma.guestListEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundException('Guest list entry not found');
    await this.myHostedEvent(venue, entry.eventId);
    return this.guestListSvc.remove(entryId);
  }

  async promoterGuests(userId: string, eventId: string) {
    const venue = await this.venueAccess.require(userId, 'Guest list', 'view');
    await this.myHostedEvent(venue, eventId);
    return this.prisma.promoterGuest.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } });
  }

  // ---------- gate ops: live monitor (mirrors OrganizerService, reuses
  // the same AdminLiveMonitorService) ----------
  async live(userId: string, eventId: string) {
    const venue = await this.venueAccess.require(userId, 'Attendees & check-in', 'view');
    await this.myHostedEvent(venue, eventId);
    return this.liveMonitorSvc.live(eventId);
  }

  async manualCheckIn(userId: string, eventId: string, name: string, count?: number) {
    const venue = await this.venueAccess.require(userId, 'Attendees & check-in', 'edit');
    await this.myHostedEvent(venue, eventId);
    return this.liveMonitorSvc.manualCheckIn(eventId, name, count);
  }

  async setHostedSalesPaused(userId: string, eventId: string, paused: boolean) {
    const venue = await this.venueAccess.require(userId, 'Events & wizard', 'edit');
    await this.myHostedEvent(venue, eventId);
    return this.prisma.event.update({ where: { id: eventId }, data: { salesPaused: paused } });
  }

  /** Mirrors OrganizerService.carts() exactly — Cart has no organizer/venue
   * FK either, purely event-derived, same "only the latest attempt per
   * user+event counts" dedup and abandoned-if-still-active-past-cutoff
   * logic. */
  async carts(userId: string) {
    const venue = await this.venueAccess.require(userId, 'Events & wizard', 'view');
    const eventIds = (await this.prisma.event.findMany({ where: { venueId: venue.id, hostedByVenue: true }, select: { id: true } })).map((e) => e.id);
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
      if (seen.has(key)) continue;
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

  /** Mirrors OrganizerService.remindCart() exactly, including the
   * city-prefixed event link and the same "log rather than silently
   * swallow" failure handling. */
  async remindCart(userId: string, id: string) {
    const venue = await this.venueAccess.require(userId, 'Events & wizard', 'edit');
    const cart = await this.prisma.cart.findUnique({ where: { id }, include: { user: true, event: { include: { venue: true } } } });
    if (!cart) throw new NotFoundException('Cart not found');
    if (cart.event.venueId !== venue.id || !cart.event.hostedByVenue) throw new ForbiddenException();

    await this.prisma.cart.update({ where: { id }, data: { remindedAt: new Date() } });
    const city = cart.event.venue?.city ?? cart.event.privateCity;
    const eventUrl = `${process.env.WEB_APP_URL ?? ''}${city ? `/${toCitySlug(city)}` : ''}/events/${cart.event.slug}`;
    await this.wa
      .send(cart.user.phone, 'cart_reminder', [cart.user.name || 'there', cart.event.title, eventUrl])
      .catch((err) => this.log.warn(`Cart reminder WhatsApp to cart ${id} failed: ${(err as Error).message}`));
    return { ok: true };
  }

  /** Venue-hosted equivalent of OrganizerService.promoters() — same
   * per-head + commission roll-up per promoter, scoped to events this venue
   * hosts itself instead of an organizer's own. */
  async promoters(userId: string) {
    const venue = await this.venueAccess.require(userId, 'Payouts & withdrawals', 'view');
    const events = await this.prisma.event.findMany({
      where: { venueId: venue.id, hostedByVenue: true },
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

  // ---------- coupons (venue-hosted events only) ----------
  /** Venue-hosted equivalent of OrganizerService.coupons()/upsertCoupon() —
   * same shape, scoped by Coupon.venueId instead of organizerId. eventScope
   * validation checks against this venue's own hosted events. */
  async coupons(userId: string) {
    const venue = await this.venueAccess.require(userId, 'Coupons', 'view');
    return this.prisma.coupon.findMany({ where: { venueId: venue.id }, orderBy: { validTill: 'desc' } });
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
    const venue = await this.venueAccess.require(userId, 'Coupons', 'edit');

    if (body.eventScope && body.eventScope !== 'all') {
      const owns = await this.prisma.event.findFirst({ where: { venueId: venue.id, hostedByVenue: true, title: body.eventScope } });
      if (!owns) throw new BadRequestException(`You don't have a hosted event titled "${body.eventScope}"`);
    }

    if (body.id) {
      const existing = await this.prisma.coupon.findUnique({ where: { id: body.id } });
      if (!existing) throw new NotFoundException('Coupon not found');
      if (existing.venueId !== venue.id) throw new ForbiddenException();
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
        venueId: venue.id,
      },
    });
  }

  private async uniqueHostedSlug(base: string) {
    let candidate = base;
    let n = 1;
    while (await this.prisma.event.findUnique({ where: { slug: candidate } })) {
      candidate = `${base}-${++n}`;
    }
    return candidate;
  }

  /** Create/edit a venue-hosted event — mirrors OrganizerService's own
   * saveEvent as closely as the different inputs allow (see VenueEventInput
   * doc comment for why this is a deliberate duplicate, not a shared
   * helper). venueId is always this venue's own id — there's no picking,
   * a venue hosts at itself. organizerId is optional: set it to
   * collaborate with a real organizer, leave it unset/null to host solo.
   * No consent is required from the picked organizer (matches how an
   * organizer already tags any venue today, now symmetric). */
  async saveHostedEvent(userId: string, input: VenueEventInput) {
    const venue = await this.venueAccess.require(userId, 'Events & wizard', 'edit');
    if (!input.title?.trim()) throw new BadRequestException('title is required');

    let eventId = input.id;
    let slug: string | undefined;
    let existing: Awaited<ReturnType<typeof this.prisma.event.findUnique>> = null;
    if (eventId) {
      existing = await this.prisma.event.findUnique({ where: { id: eventId } });
      if (!existing) throw new NotFoundException('Event not found');
      if (existing.venueId !== venue.id || !existing.hostedByVenue) throw new ForbiddenException();
      slug = existing.slug;
    } else {
      eventId = 'ev-' + randomBytes(6).toString('hex');
      slug = await this.uniqueHostedSlug(slugifyBase(input.title));
    }

    const status = input.status === 'draft' ? 'draft' : 'pending';

    let organizerId: string | null;
    if (input.organizerId !== undefined) {
      if (!input.organizerId) {
        organizerId = null;
      } else {
        const org = await this.prisma.organizer.findUnique({ where: { id: input.organizerId } });
        if (!org) throw new BadRequestException('Unknown organizer');
        organizerId = org.id;
      }
    } else {
      organizerId = existing?.organizerId ?? null;
    }

    const data = {
      title: input.title.trim(),
      description: input.description ?? existing?.description ?? '',
      category: input.category ?? existing?.category ?? '',
      subCategory: input.subCategory ?? existing?.subCategory,
      ageLimit: input.ageLimit ?? existing?.ageLimit ?? '',
      tags: input.tags ?? existing?.tags ?? [],
      date: input.date ? new Date(input.date) : (existing?.date ?? new Date()),
      durationHrs: input.durationHrs ?? existing?.durationHrs ?? 0,
      venueId: venue.id,
      privateCity: null,
      privateLocality: null,
      organizerId,
      hostedByVenue: true,
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

    if (status === 'pending' && existing?.status !== 'pending') {
      await this.notifications.notify('⚠', `"${data.title}" submitted for approval by ${venue.name} (venue-hosted)`, '/admin/events?status=pending');
    }

    if (input.tiers) await this.syncHostedTiers(eventId, input.tiers);
    else if (!existing) throw new BadRequestException('At least one ticket tier is required');

    return this.prisma.event.findUniqueOrThrow({ where: { id: eventId }, include: { tiers: true, venue: true, organizer: true } });
  }

  private async syncHostedTiers(eventId: string, tiers: HostedTierInput[]) {
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

  /** Real revenue for this venue's own hosted events — same shape as
   * OrganizerService's ledger read, just off VenueLedgerTx instead of
   * OrganizerLedgerTx. Only ever has rows once hostingEnabled and at least
   * one hosted event has sold a ticket (see BookingsService's ledger
   * crediting). */
  async myLedger(userId: string) {
    const venue = await this.venueAccess.require(userId, 'Payouts & withdrawals', 'view');
    const [transactions, agg] = await Promise.all([
      this.prisma.venueLedgerTx.findMany({ where: { venueId: venue.id }, orderBy: { createdAt: 'desc' }, take: 200 }),
      this.prisma.venueLedgerTx.aggregate({ where: { venueId: venue.id }, _sum: { amount: true } }),
    ]);
    return { balance: agg._sum.amount ?? 0, transactions };
  }

  /** Self-service withdraw off the hosting ledger — same shape as
   * OrganizerService.withdraw: requires a default VenuePaymentProfile
   * (nowhere real to send the money without one), a debit ledger row
   * snapshotting exactly which account it went to, settled manually by our
   * team from here (no real transfer rail), owner notified on file. */
  async withdraw(userId: string, amount: number) {
    const venue = await this.venueAccess.require(userId, 'Payouts & withdrawals', 'edit');
    const profile = await this.prisma.venuePaymentProfile.findFirst({ where: { venueId: venue.id, isDefault: true } });
    if (!profile) throw new BadRequestException('Add a payment profile (Settings → Payment profiles) before withdrawing');
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Enter a valid amount');
    const agg = await this.prisma.venueLedgerTx.aggregate({ where: { venueId: venue.id }, _sum: { amount: true } });
    const balance = agg._sum.amount ?? 0;
    if (amount > balance) throw new BadRequestException('More than your available balance');

    await this.prisma.venueLedgerTx.create({
      data: {
        venueId: venue.id, type: 'withdrawal', amount: -amount, note: 'Withdrawal to bank',
        paymentProfileId: profile.id, payoutBankLast4: profile.bankLast4,
        payoutAccountHolderName: profile.accountHolderName, payoutIfsc: profile.ifsc,
      },
    });

    const user = venue.userId ? await this.prisma.user.findUnique({ where: { id: venue.userId } }) : null;
    if (user) {
      if (user.phone) await this.wa.send(user.phone, 'organizer_payout', [String(amount)]).catch(() => {});
      if (user.email) await this.email.sendTemplate(user.email, 'payout_processed', {
        name: user.name, amount: money(amount), role: 'venue',
      }).catch(() => {});
    }
    return { ok: true };
  }

  // ---------- payment profiles (bank accounts to withdraw hosting revenue
  // to) — exact mirror of OrganizerService's own, venueId-scoped ----------
  async listPaymentProfiles(userId: string) {
    const venue = await this.venueAccess.require(userId, 'Payouts & withdrawals', 'view');
    return this.prisma.venuePaymentProfile.findMany({ where: { venueId: venue.id }, orderBy: { createdAt: 'asc' } });
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
    const venue = await this.venueAccess.require(userId, 'Payouts & withdrawals', 'edit');
    this.validatePaymentProfileInput(data);
    const bankAccountNumber = data.bankAccountNumber.trim();
    const isFirst = (await this.prisma.venuePaymentProfile.count({ where: { venueId: venue.id } })) === 0;
    return this.prisma.venuePaymentProfile.create({
      data: {
        venueId: venue.id,
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

  private async ownedPaymentProfile(venueId: string, id: string) {
    const profile = await this.prisma.venuePaymentProfile.findUnique({ where: { id } });
    if (!profile || profile.venueId !== venueId) throw new NotFoundException('Payment profile not found');
    return profile;
  }

  async updatePaymentProfile(userId: string, id: string, data: {
    legalName?: string; businessAddress?: string; country?: string; state?: string; city?: string; pincode?: string;
    bankAccountNumber?: string; accountHolderName?: string; ifsc?: string; branch?: string;
    pan?: string; gstin?: string; noGst?: boolean;
  }) {
    const venue = await this.venueAccess.require(userId, 'Payouts & withdrawals', 'edit');
    const existing = await this.ownedPaymentProfile(venue.id, id);
    const merged = { ...existing, ...data };
    this.validatePaymentProfileInput(merged);
    const bankAccountNumber = data.bankAccountNumber?.trim() ?? existing.bankAccountNumber;
    return this.prisma.venuePaymentProfile.update({
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
   * deleted" — same precedent as OrganizerService.deletePaymentProfile. */
  async deletePaymentProfile(userId: string, id: string) {
    const venue = await this.venueAccess.require(userId, 'Payouts & withdrawals', 'edit');
    const target = await this.ownedPaymentProfile(venue.id, id);
    await this.prisma.venuePaymentProfile.delete({ where: { id } });
    if (target.isDefault) {
      const next = await this.prisma.venuePaymentProfile.findFirst({ where: { venueId: venue.id }, orderBy: { createdAt: 'asc' } });
      if (next) await this.prisma.venuePaymentProfile.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { ok: true };
  }

  async setDefaultPaymentProfile(userId: string, id: string) {
    const venue = await this.venueAccess.require(userId, 'Payouts & withdrawals', 'edit');
    await this.ownedPaymentProfile(venue.id, id);
    await this.prisma.$transaction([
      this.prisma.venuePaymentProfile.updateMany({ where: { venueId: venue.id, isDefault: true }, data: { isDefault: false } }),
      this.prisma.venuePaymentProfile.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return { ok: true };
  }

  /** Real, verified organizers a venue can pick as a collaborator — same
   * "no consent needed" reasoning as an organizer picking any venue today. */
  async collaboratorOptions() {
    return this.prisma.organizer.findMany({
      where: { verified: true },
      select: { id: true, brandName: true, username: true, city: true },
      orderBy: { brandName: 'asc' },
    });
  }

  // ---------- admin: hosting request review (Contacted ✓ gates Approve) ----------

  async listHostingRequests(status?: string) {
    return this.prisma.venueHostingRequest.findMany({
      where: status ? { status } : undefined,
      include: { venue: { select: { id: true, name: true, city: true, verified: true, contactPerson: true, contactPersonPhone: true, contact: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markHostingRequestContacted(id: string) {
    const req = await this.prisma.venueHostingRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== 'pending') throw new BadRequestException('This request has already been reviewed');
    return this.prisma.venueHostingRequest.update({ where: { id }, data: { contactedAt: new Date() } });
  }

  async approveHostingRequest(id: string, reviewedBy?: string) {
    const req = await this.prisma.venueHostingRequest.findUnique({ where: { id }, include: { venue: true } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== 'pending') throw new BadRequestException('This request has already been reviewed');
    if (!req.contactedAt) throw new BadRequestException('Mark this venue as contacted before approving');

    await this.prisma.venue.update({ where: { id: req.venueId }, data: { hostingEnabled: true } });
    const updated = await this.prisma.venueHostingRequest.update({
      where: { id },
      data: { status: 'approved', reviewedBy, reviewedAt: new Date() },
    });

    if (req.venue.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: req.venue.userId } });
      if (user?.email) await this.email.sendTemplate(user.email, 'venue_hosting_approved', { name: req.venue.name }).catch(() => {});
      if (user?.phone) await this.wa.send(user.phone, 'venue_hosting_approved', [req.venue.name]).catch(() => {});
    }
    return updated;
  }

  async rejectHostingRequest(id: string, reviewNote: string | undefined, reviewedBy?: string) {
    const req = await this.prisma.venueHostingRequest.findUnique({ where: { id }, include: { venue: true } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== 'pending') throw new BadRequestException('This request has already been reviewed');

    const updated = await this.prisma.venueHostingRequest.update({
      where: { id },
      data: { status: 'rejected', reviewNote, reviewedBy, reviewedAt: new Date() },
    });

    if (req.venue.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: req.venue.userId } });
      if (user?.email) await this.email.sendTemplate(user.email, 'venue_hosting_rejected', { name: req.venue.name, reviewNote: reviewNote || 'No reason given.' }).catch(() => {});
    }
    return updated;
  }
}
