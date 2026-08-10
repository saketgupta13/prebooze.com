import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
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
  licenseDoc?: string;
  addressProofDoc?: string;
  galleryUrls?: string[];
  logoUrl?: string;
  contactPerson?: string;
  contactPersonPhone?: string;
  socialLinks?: { instagram?: string; facebook?: string; other?: string[] };
  // First-touch marketing attribution (see prebooze-web's lib/track.ts) —
  // stored on the KycSubmission payload only, purely so a reviewer in
  // Admin > Verifications can see where the lead came from; never touches
  // the real Venue catalog row.
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrerHost?: string;
}

interface HostedTierInput {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  includes?: string[];
  description?: string;
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

@Injectable()
export class VenueService {
  constructor(
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
    private notifications: NotificationsService,
    private staffAlerts: StaffAlertsService,
    private wa: WhatsappService,
    private email: EmailService,
    private meta: MetaConversionsService,
    private leads: LeadsService,
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

  /** Same guard rules as KycService.submitRole (one number one role, one
   * pending application at a time) — duplicated rather than shared because
   * this endpoint's contract takes document *references* as plain JSON
   * strings (prebooze-web/src/api/index.ts: `licenseDoc?: string`), not
   * multipart file uploads like /kyc/role, so it can't reuse that method's
   * Multer-shaped signature. Unlike organizer/promoter onboarding, the
   * Venue catalog row is created here immediately (unverified) — it shows
   * up in the directory and is pickable by organizers right away; only the
   * verified badge waits on admin approval (see KycService.approve). */
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
    if (!input.licenseDoc || !input.addressProofDoc) {
      throw new BadRequestException('Operating license and address proof are both required');
    }

    const id = await this.uniqueId(
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'venue',
    );

    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;

    const venue = await this.prisma.venue.create({
      data: {
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
      },
    });

    // Full submitted form, not just {venueId, name, city} — admin's
    // Verification detail screen renders every payload key generically
    // (VerificationDetail.tsx: Object.entries(app.payload)), so a venue
    // application used to show almost nothing there while organizer/
    // promoter/lineup applications already showed everything they
    // submitted. licenseDoc/addressProofDoc are excluded — those are
    // already shown as real document images in the Documents section below.
    await this.prisma.kycSubmission.create({
      data: {
        userId,
        kind: 'venue',
        status: 'pending',
        payload: {
          venueId: id, name: venue.name, type: venue.type, city: venue.city, address: venue.address,
          capacity: venue.capacity, amenities: venue.amenities, timings: venue.timings, about: venue.about,
          utmSource: input.utmSource, utmMedium: input.utmMedium, utmCampaign: input.utmCampaign, referrerHost: input.referrerHost,
        } as Prisma.InputJsonValue,
        documents: [
          { type: 'license', path: input.licenseDoc },
          { type: 'address_proof', path: input.addressProofDoc },
        ] as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.user.update({ where: { id: userId }, data: { venueName: venue.name, venueLogoUrl: venue.logoUrl, venueId: id, roleStatus: 'pending' } });

    // Server-side mirror of the browser Pixel's Lead event (see
    // VenueOnboarding.tsx's trackMeta call) — same `${phone}_venue`
    // event_id both sides use, matching the kyc.service.ts Lead pattern
    // for organizer/promoter/lineup.
    this.meta
      .sendEvent('Lead', `${user.phone}_venue`, 'https://prebooze.com/venue/onboarding', { phone: user.phone, email: user.email }, { content_name: 'venue_onboarding' })
      .catch(() => {});
    this.leads.resolveDraft(user.phone, 'venue').catch(() => {});

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

  private requireHostingEnabled(venue: { hostingEnabled: boolean }) {
    if (!venue.hostingEnabled) throw new ForbiddenException('Event hosting isn’t enabled for your venue yet');
  }

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
    const venue = await this.myVenue(userId);
    this.requireHostingEnabled(venue);
    return this.prisma.event.findMany({
      where: { venueId: venue.id, hostedByVenue: true },
      include: { tiers: true, organizer: { select: { id: true, brandName: true, username: true, verified: true } } },
      orderBy: { date: 'desc' },
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
    const venue = await this.myVenue(userId);
    this.requireHostingEnabled(venue);
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

  /** Real revenue for this venue's own hosted events — same shape as
   * OrganizerService's ledger read, just off VenueLedgerTx instead of
   * OrganizerLedgerTx. Only ever has rows once hostingEnabled and at least
   * one hosted event has sold a ticket (see BookingsService's ledger
   * crediting). */
  async myLedger(userId: string) {
    const venue = await this.myVenue(userId);
    this.requireHostingEnabled(venue);
    const [transactions, agg] = await Promise.all([
      this.prisma.venueLedgerTx.findMany({ where: { venueId: venue.id }, orderBy: { createdAt: 'desc' }, take: 200 }),
      this.prisma.venueLedgerTx.aggregate({ where: { venueId: venue.id }, _sum: { amount: true } }),
    ]);
    return { balance: agg._sum.amount ?? 0, transactions };
  }

  /** Self-service withdraw off the hosting ledger — same shape as
   * OrganizerService.withdraw: a debit ledger row, settled manually by our
   * team from here (no real transfer rail), owner notified on their bank
   * account on file. */
  async withdraw(userId: string, amount: number) {
    const venue = await this.myVenue(userId);
    this.requireHostingEnabled(venue);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Enter a valid amount');
    const agg = await this.prisma.venueLedgerTx.aggregate({ where: { venueId: venue.id }, _sum: { amount: true } });
    const balance = agg._sum.amount ?? 0;
    if (amount > balance) throw new BadRequestException('More than your available balance');

    await this.prisma.venueLedgerTx.create({
      data: { venueId: venue.id, type: 'withdrawal', amount: -amount, note: 'Withdrawal to bank' },
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
