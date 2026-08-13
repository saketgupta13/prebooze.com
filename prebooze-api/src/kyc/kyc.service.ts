import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { StorageService } from './storage.service';
import { KycProviderService } from './kyc-provider.service';
import { toApiUser, normalizePhone } from '../auth/auth.service';
import { NotificationsService } from '../admin/notifications.service';
import { EmailService } from '../notifications/email';
import { KYC_ROLE_LABEL } from '../notifications/email-templates';
import { StaffAlertsService } from '../notifications/staff-alerts';
import { MetaConversionsService } from '../meta/meta-conversions.service';
import { LeadsService } from '../admin/leads.service';

const ROLE_KINDS = ['organizer', 'promoter', 'lineup', 'venue'] as const;
type RoleKind = (typeof ROLE_KINDS)[number];

@Injectable()
export class KycService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private provider: KycProviderService,
    private notifications: NotificationsService,
    private email: EmailService,
    private staffAlerts: StaffAlertsService,
    private meta: MetaConversionsService,
    private leads: LeadsService,
  ) {}

  // ---------- guest: automatic ----------
  async submitGuest(userId: string, idDoc?: Express.Multer.File, selfie?: Express.Multer.File) {
    if (!idDoc || !selfie) throw new BadRequestException('Both an ID document and a selfie are required');

    const result = await this.provider.checkGuest(idDoc, selfie);
    const documents = [
      { type: 'id_doc', path: await this.storage.save(idDoc) },
      { type: 'selfie', path: await this.storage.save(selfie) },
    ];

    const submission = await this.prisma.kycSubmission.create({
      data: {
        userId,
        kind: 'guest',
        status: result.passed ? 'approved' : 'rejected',
        documents: documents as unknown as Prisma.InputJsonValue,
        autoScore: result.score,
        reviewNote: result.reason,
      },
    });

    if (result.passed) {
      await this.prisma.user.update({ where: { id: userId }, data: { idVerified: true, profilePct: 100 } });
    }
    return { status: submission.status, score: result.score, reason: result.reason };
  }

  // ---------- elevated roles: manual only ----------
  async submitRole(userId: string, kind: RoleKind, payload: Record<string, unknown>, files: Express.Multer.File[]) {
    if (!ROLE_KINDS.includes(kind)) throw new BadRequestException('Unknown role');
    // Venue has its own dedicated submission path (POST /venue/onboard),
    // which actually creates the Venue catalog row and requires the
    // license/address-proof documents this generic endpoint doesn't
    // validate. Blocking it here closes a real gap: this endpoint would
    // otherwise happily set User.venueId to any client-supplied string with
    // no corresponding Venue row and no ownership check at all.
    if (kind === 'venue') throw new BadRequestException('Venue applications go through POST /venue/onboard');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException();
    if (user.role) {
      throw new BadRequestException(
        user.role === kind
          ? `You're already an approved ${kind}`
          : 'This number already holds a role — one number, one role',
      );
    }
    // `role` stays null until admin approval, so the in-review state has to
    // be checked via roleStatus, not role — a pending application (for this
    // kind or a different one — you can't apply for two roles at once either)
    // blocks resubmission. A 'rejected' status is left open to reapply.
    if (user.roleStatus === 'pending') {
      throw new BadRequestException('Your application is already under review');
    }
    // Line-ups are a content/booking directory listing, not a payments
    // counterparty (no bank/payout fields on the Lineup model at all,
    // unlike organizer/promoter) — the guest-style ID-doc + selfie step
    // doesn't apply to them, so they're the one kind allowed to submit with
    // no documents.
    if (!files.length && kind !== 'lineup') throw new BadRequestException('At least one document is required');

    const documents = await Promise.all(files.map(async (f, i) => ({
      type: (payload.docLabels as string[] | undefined)?.[i] ?? `doc_${i + 1}`,
      path: await this.storage.save(f),
    })));

    await this.prisma.kycSubmission.create({
      data: {
        userId,
        kind,
        status: 'pending',
        payload: payload as Prisma.InputJsonValue,
        documents: documents as unknown as Prisma.InputJsonValue,
      },
    });

    const displayName = (payload.brandName as string) || (payload.name as string) || user.name || user.phone;
    await this.notifications.notify('🛡', `${displayName} submitted ${kind} KYC docs for review`, '/admin/kyc');
    await this.staffAlerts.alert(`🛡 ${displayName} submitted ${kind} KYC docs for review`).catch(() => {});
    await this.email.sendTemplate(user.email, 'kyc_pending', {
      name: user.name, roleLabel: KYC_ROLE_LABEL[kind] ?? kind,
    }).catch(() => {});

    // store the self-reported profile fields immediately (display only — the
    // elevated `role` itself stays unset until a human approves)
    const profilePatch: Record<string, unknown> = { roleStatus: 'pending' };
    if (kind === 'organizer') Object.assign(profilePatch, { orgBrand: payload.brand, orgUsername: payload.username });
    if (kind === 'promoter') Object.assign(profilePatch, { promoterBrand: payload.brand, promoterUsername: payload.username });
    if (kind === 'lineup') Object.assign(profilePatch, { lineupName: payload.name, lineupCategory: payload.category, lineupUsername: payload.username, lineupLogoUrl: payload.logoUrl });
    // no venue case here — kind === 'venue' is rejected above, before this point

    const updated = await this.prisma.user.update({ where: { id: userId }, data: profilePatch });

    // Server-side mirror of the browser Pixel's Lead event (see the
    // relevant *Onboarding.tsx's trackMeta call) — same `${phone}_${kind}`
    // event_id both sides use (phone, not the DB id, since toApiUser()
    // doesn't expose the id to the frontend; roleStatus blocks
    // resubmission, so this is naturally a once-per-user-per-kind id).
    this.meta
      .sendEvent('Lead', `${user.phone}_${kind}`, `https://prebooze.com/${kind}/onboarding`, { phone: user.phone, email: user.email }, { content_name: `${kind}_onboarding` })
      .catch(() => {});
    // An untouched draft lead for this same person+role (see
    // LeadsService.captureDraft) is now a real application — mark it
    // converted instead of leaving it to look abandoned.
    this.leads.resolveDraft(user.phone, kind).catch(() => {});

    return { status: 'pending', user: toApiUser(updated) };
  }

  /** Self-serve organizer signup, minimal — brand/location/event-types
   * only, no admin review. Unlike submitRole, this creates the live
   * Organizer row and approves the role immediately, so an organizer can
   * start building draft events the moment they submit this — the
   * per-event admin approval queue is the real safety net before anything
   * they build reaches a guest, unchanged by any of this. `verified` stays
   * false until they separately complete financial/identity verification
   * (submitOrganizerVerification below) and it's reviewed — that's now the
   * only thing `verified` means for organizer, decoupled from "has an
   * account they can use." */
  async quickSignupOrganizer(
    userId: string,
    payload: {
      brand?: string; username?: string;
      city?: string; state?: string; country?: string; pincode?: string;
      types?: string[]; about?: string;
      socialLinks?: { instagram?: string; facebook?: string; other?: string[] };
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException();
    if (user.role) {
      throw new BadRequestException(
        user.role === 'organizer' ? "You're already an approved organizer" : 'This number already holds a role — one number, one role',
      );
    }
    if (user.roleStatus === 'pending') throw new BadRequestException('Your application is already under review');
    if (!payload.brand?.trim()) throw new BadRequestException('Brand name is required');
    if (!payload.username?.trim()) throw new BadRequestException('Username is required');
    if (!payload.city?.trim()) throw new BadRequestException('City is required');
    if (!payload.types?.length) throw new BadRequestException('At least one event type is required');

    const row = await this.newOrganizerRow(user, payload, false);
    await this.prisma.$transaction([
      this.prisma.organizer.create({ data: row }),
      this.prisma.user.update({
        where: { id: userId },
        data: { role: 'organizer', roleStatus: 'approved', orgBrand: row.brandName, orgUsername: row.username },
      }),
    ]);

    this.meta
      .sendEvent('Lead', `${user.phone}_organizer`, 'https://prebooze.com/organizer/onboarding', { phone: user.phone, email: user.email }, { content_name: 'organizer_onboarding' })
      .catch(() => {});
    this.leads.resolveDraft(user.phone, 'organizer').catch(() => {});
    await this.notifications.notify('🎪', `${row.brandName} signed up as a new organizer`, '/organizers').catch(() => {});

    const updated = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { status: 'approved', user: toApiUser(updated) };
  }

  /** Self-serve financial + identity verification — submitted whenever the
   * organizer is ready (typically right before their first withdrawal, but
   * nothing forces that timing), the counterpart to the verification team
   * proactively collecting the same fields via addOrganizerVerificationDetails/
   * addOrganizerDocuments below. Both paths land in the exact same admin
   * Verifications queue and go through the same approve()/reject() — one
   * review process regardless of who initiated it. */
  async submitOrganizerVerification(
    userId: string,
    payload: { gstin?: string; noGst?: boolean; pan?: string; bankName?: string; bankAccount?: string; accountHolderName?: string; bankIfsc?: string; aadhaar?: string },
    files: Express.Multer.File[],
  ) {
    const org = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!org) throw new BadRequestException('Complete your organizer signup first');
    if (org.verified) throw new BadRequestException("You're already verified");
    const alreadyPending = await this.prisma.kycSubmission.findFirst({ where: { userId, kind: 'organizer', status: 'pending' } });
    if (alreadyPending) throw new BadRequestException('Your verification is already under review');

    if (!payload.pan?.trim()) throw new BadRequestException('PAN is required');
    if (!payload.noGst && !payload.gstin?.trim()) throw new BadRequestException('GSTIN is required, or tick "I don\'t have a GSTIN"');
    if (!payload.bankName?.trim() || !payload.bankAccount?.trim() || !payload.accountHolderName?.trim() || !payload.bankIfsc?.trim()) {
      throw new BadRequestException('Full bank account details are required');
    }
    if (!payload.aadhaar?.trim()) throw new BadRequestException('Aadhaar number is required');
    if (!files.length) throw new BadRequestException('A selfie is required');

    const documents = await Promise.all(files.map(async (f, i) => ({
      type: i === 0 ? 'selfie' : `doc_${i + 1}`,
      path: await this.storage.save(f),
    })));

    const submission = await this.prisma.kycSubmission.create({
      data: {
        userId,
        kind: 'organizer',
        status: 'pending',
        payload: {
          verificationUpgrade: true,
          noGst: !!payload.noGst,
          gstin: payload.noGst ? undefined : payload.gstin!.trim().toUpperCase(),
          pan: payload.pan.trim().toUpperCase(),
          bankName: payload.bankName!.trim(),
          bankAccount: payload.bankAccount!.trim(),
          accountHolderName: payload.accountHolderName!.trim(),
          bankIfsc: payload.bankIfsc!.trim().toUpperCase(),
          aadhaar: payload.aadhaar.trim(),
        } as Prisma.InputJsonValue,
        documents: documents as unknown as Prisma.InputJsonValue,
      },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    await this.notifications.notify('🛡', `${org.brandName} submitted verification details for review`, '/admin/kyc').catch(() => {});
    await this.staffAlerts.alert(`🛡 ${org.brandName} submitted verification details for review`).catch(() => {});
    if (user) await this.email.sendTemplate(user.email, 'kyc_pending', { name: user.name, roleLabel: 'organizer' }).catch(() => {});
    return submission;
  }

  async myStatus(userId: string) {
    const submissions = await this.prisma.kycSubmission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    return submissions;
  }

  // ---------- admin: manual review queue ----------
  async listForAdmin(status?: string) {
    return this.prisma.kycSubmission.findMany({
      where: status ? { status: status as never } : { kind: { in: ROLE_KINDS as unknown as string[] } as never },
      include: { user: { select: { phone: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approve(id: string, reviewedBy: string) {
    const sub = await this.prisma.kycSubmission.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException();
    if (sub.kind === 'guest') throw new BadRequestException('Guest verification is automatic, nothing to approve');

    // Two kinds of organizer submission never collect GSTIN/PAN/bank/docs up
    // front and need this stricter gate before approval: sales-assisted
    // applications (payload.leadId — lead team only gathers the basics, the
    // verification team fills the rest via addOrganizerVerificationDetails/
    // addOrganizerDocuments below) and self-serve verification-upgrade
    // submissions (payload.verificationUpgrade — quickSignupOrganizer
    // already created the account with none of this; this submission *is*
    // the compliance data, submitOrganizerVerification already required all
    // of it before creating the row, but re-checking here means a future
    // caller of this same submission-creation path can't accidentally skip
    // it). Plain self-serve submissions (the old all-in-one Onboarding.tsx
    // flow, if still reachable) already require all of this at submission
    // time, so this never blocks them either way. `noGst` lets a
    // legitimately GST-exempt applicant through either path without a
    // GSTIN on file — same "no GST" checkbox self-serve always had.
    if (sub.kind === 'organizer') {
      const payload = sub.payload as Record<string, unknown> | null;
      if (payload?.leadId || payload?.verificationUpgrade) {
        const documents = Array.isArray(sub.documents) ? sub.documents : [];
        const missing: string[] = [];
        if (!payload.gstin && !payload.noGst) missing.push('GSTIN');
        if (!payload.pan) missing.push('PAN');
        if (!payload.bankAccount) missing.push('bank account number');
        if (!payload.bankIfsc) missing.push('IFSC code');
        if (!payload.bankName) missing.push('bank name');
        if (!payload.accountHolderName) missing.push('account holder name');
        if (!documents.length) missing.push('at least one KYC document');
        if (missing.length) throw new BadRequestException(`Can't approve yet — still missing: ${missing.join(', ')}`);
      }
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.kycSubmission.update({
        where: { id },
        data: { status: 'approved', reviewedBy, reviewedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: sub.userId },
        data: { role: sub.kind as never, roleStatus: 'approved' },
      }),
    ];

    // approving an organizer needs a live Organizer catalog row to exist —
    // Event.organizerId is a hard FK into Organizer, not User, so without
    // this an approved organizer couldn't create their first event.
    let newOrganizerId: string | undefined;
    if (sub.kind === 'organizer') {
      const [user, existing] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: sub.userId } }),
        this.prisma.organizer.findUnique({ where: { userId: sub.userId } }),
      ]);
      if (user && !existing) {
        const row = await this.newOrganizerRow(user, sub.payload as Record<string, unknown> | null);
        newOrganizerId = row.id;
        ops.push(this.prisma.organizer.create({ data: row }));
        // Organizer.username is normalized (lowercased, collision-suffixed);
        // User.orgUsername was captured raw at submission time and never
        // touched again — sync it now so any exact-match comparison against
        // the real catalog username (e.g. the public-profile "is this my
        // own page" check) doesn't silently mismatch on casing forever.
        ops.push(this.prisma.user.update({ where: { id: sub.userId }, data: { orgUsername: row.username } }));
      } else if (existing) {
        // Verification-upgrade submission for an organizer who already
        // exists (quickSignupOrganizer already created the row, unverified)
        // — patch the financial/compliance fields onto it and flip the
        // badge, rather than trying to create a second row for the same
        // person (organizerId is unique per userId).
        const payload = sub.payload as Record<string, unknown> | null;
        const str = (k: string) => (typeof payload?.[k] === 'string' ? (payload[k] as string).trim() : '') || undefined;
        const bankAccount = str('bankAccount');
        ops.push(
          this.prisma.organizer.update({
            where: { id: existing.id },
            data: {
              verified: true,
              gstin: str('gstin'),
              pan: str('pan'),
              bankAccountNumber: bankAccount,
              bankLast4: bankAccount ? bankAccount.slice(-4) : undefined,
              bankName: str('bankName'),
              accountHolderName: str('accountHolderName'),
              ifsc: str('bankIfsc')?.toUpperCase(),
            },
          }),
        );
      }
    }

    // same reasoning for promoter — PromoterGuest.promoterSlug and
    // Booking.promoterRef both join against Promoter.slug, and a fresh
    // approval has no row to be found by that slug yet.
    if (sub.kind === 'promoter') {
      const [user, existing] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: sub.userId } }),
        this.prisma.promoter.findUnique({ where: { userId: sub.userId } }),
      ]);
      if (user && !existing) {
        const row = await this.newPromoterRow(user, sub.payload as Record<string, unknown> | null);
        ops.push(this.prisma.promoter.create({ data: row }));
        ops.push(this.prisma.user.update({ where: { id: sub.userId }, data: { promoterUsername: row.slug } }));
      }
    }

    // Unlike organizer/promoter, the Venue catalog row already exists —
    // VenueService.onboard creates it (unverified) at submission time, not
    // at approval time, so it shows up in the directory (and is pickable by
    // organizers creating events) immediately. Approval just flips the
    // verified badge on. venueId comes from the submission payload rather
    // than a fresh user lookup, since it was captured there at onboard time.
    if (sub.kind === 'venue') {
      const venueId = (sub.payload as { venueId?: string } | null)?.venueId;
      if (venueId) ops.push(this.prisma.venue.update({ where: { id: venueId }, data: { verified: true } }));
    }

    // same reasoning as organizer/promoter — GET /lineups and the public
    // /lineup/:slug profile both read from the Lineup catalog table, so a
    // freshly-approved artist/DJ needs a row there to actually show up
    // anywhere. Everything else about their console (dashboard, profile
    // edits) already rides on existing generic endpoints — see BACKEND.md
    // "Identity & KYC" for why Lineup never needed its own console section.
    if (sub.kind === 'lineup') {
      const [user, existing] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: sub.userId } }),
        this.prisma.lineup.findUnique({ where: { userId: sub.userId } }),
      ]);
      if (user && !existing) {
        const row = await this.newLineupRow(user, sub.payload as Record<string, unknown> | null);
        ops.push(this.prisma.lineup.create({ data: row }));
        ops.push(this.prisma.user.update({ where: { id: sub.userId }, data: { lineupUsername: row.slug } }));
      }
    }

    await this.prisma.$transaction(ops);

    // Sales-assisted organizer approval — see the leadId gate above. Now
    // that the real Organizer row exists, close the loop back on the Lead
    // it started from: same "link + mark Signed up" atomic update the
    // manual "Link to organizer" admin action already does.
    if (newOrganizerId) {
      const leadId = (sub.payload as { leadId?: string } | null)?.leadId;
      if (leadId) await this.leads.linkOrganizer(leadId, newOrganizerId).catch(() => {});
    }

    const applicant = await this.prisma.user.findUnique({ where: { id: sub.userId } });
    if (applicant) {
      await this.email.sendTemplate(applicant.email, 'kyc_approved', {
        name: applicant.name, roleLabel: KYC_ROLE_LABEL[sub.kind] ?? sub.kind,
      }).catch(() => {});
    }
    return { ok: true };
  }

  /** Picks a free slug-style id/username for a newly-approved organizer,
   * falling back to a numeric suffix on collision (e.g. two organizers both
   * picking "nightowl" at KYC time — the seeded catalog isn't reserved).
   * `payload` is the raw onboarding submission (Onboarding.tsx) — without
   * pulling from it, every business-profile field the applicant actually
   * filled in (about/links/gstin/pan/bank) landed nowhere, leaving admin's
   * "Edit organizer" page blank after approval despite the applicant having
   * entered all of it. Bank account is truncated to last-4 on the way in —
   * the full number lives only in the KycSubmission payload, never on the
   * readable Organizer row. */
  private async newOrganizerRow(
    user: { id: string; orgBrand: string | null; orgUsername: string | null; name: string; city: string },
    payload: Record<string, unknown> | null,
    verified = true,
  ) {
    const payloadBrand = (typeof payload?.brand === 'string' && payload.brand.trim()) || (typeof payload?.brandName === 'string' && payload.brandName.trim()) || '';
    const base = (user.orgUsername || payloadBrand || user.orgBrand || user.name || 'organizer')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'organizer';

    const unique = async (field: 'id' | 'username') => {
      let candidate = base;
      let n = 1;
      while (await this.prisma.organizer.findUnique({ where: { [field]: candidate } as never })) {
        candidate = `${base}-${++n}`;
      }
      return candidate;
    };

    let h = 0;
    for (const c of user.id) h = (h * 31 + c.charCodeAt(0)) % 360;

    const str = (k: string) => (typeof payload?.[k] === 'string' ? (payload[k] as string).trim() : '') || undefined;
    const types = Array.isArray(payload?.types) ? (payload!.types as string[]).join(', ') : str('types');
    const bankAccount = str('bankAccount');
    const social = payload?.socialLinks as { instagram?: string; facebook?: string; other?: string[] } | undefined;

    return {
      id: await unique('id'),
      brandName: payloadBrand || user.orgBrand || user.name || 'Organizer',
      username: await unique('username'),
      verified,
      city: str('city') || user.city || '',
      country: str('country'),
      state: str('state'),
      pincode: str('pincode'),
      since: String(new Date().getFullYear()),
      about: str('about') ?? '',
      logoHue: h,
      userId: user.id,
      eventTypes: types,
      socialLinks: social ?? undefined,
      gstin: str('gstin'),
      pan: str('pan'),
      contact: str('contact'),
      contactPerson: str('contactPerson'),
      phone: str('phone'),
      bankLast4: bankAccount ? bankAccount.slice(-4) : undefined,
      bankAccountNumber: bankAccount,
      bankName: str('bankName'),
      accountHolderName: str('accountHolderName'),
      ifsc: str('bankIfsc')?.toUpperCase(),
    };
  }

  /** Same slug-collision-safe scheme as newOrganizerRow, but keyed off
   * promoterUsername/promoterBrand — Promoter.id and .slug are both
   * slug-style but distinct fields (seeded promoters use short ids like
   * "pr1" with a separate human slug), so both need picking. `payload` is
   * the raw onboarding submission (PromoterOnboarding.tsx) — without pulling
   * from it, bio/links/city/country/state/pincode the applicant actually
   * entered landed nowhere, same gap newOrganizerRow/newLineupRow close for
   * their roles. */
  private async newPromoterRow(
    user: { id: string; promoterBrand: string | null; promoterUsername: string | null; name: string; city: string },
    payload: Record<string, unknown> | null,
  ) {
    const base = (user.promoterUsername || user.promoterBrand || user.name || 'promoter')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'promoter';

    const uniqueSlug = async () => {
      let candidate = base;
      let n = 1;
      while (await this.prisma.promoter.findUnique({ where: { slug: candidate } })) {
        candidate = `${base}-${++n}`;
      }
      return candidate;
    };
    const uniqueId = async () => {
      let candidate = 'pr-' + base;
      let n = 1;
      while (await this.prisma.promoter.findUnique({ where: { id: candidate } })) {
        candidate = `pr-${base}-${++n}`;
      }
      return candidate;
    };

    const str = (k: string) => (typeof payload?.[k] === 'string' ? (payload[k] as string).trim() : '') || undefined;
    const links = (typeof payload?.links === 'string' ? (payload.links as string).split(',') : Array.isArray(payload?.links) ? (payload!.links as string[]) : [])
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      id: await uniqueId(),
      slug: await uniqueSlug(),
      name: user.promoterBrand || user.name || 'Promoter',
      verified: true, // this row is only ever created at the moment KYC is approved
      city: str('city') || user.city || '',
      country: str('country'),
      state: str('state'),
      pincode: str('pincode'),
      bio: str('bio') || '',
      links,
      audienceReach: str('audience'),
      userId: user.id,
    };
  }

  /** Same slug-collision-safe scheme again, keyed off lineupUsername/lineupName.
   * `payload` is the raw onboarding submission (LineupOnboarding.tsx) —
   * without pulling from it, the city/bio/links the applicant actually
   * entered landed nowhere, same gap newOrganizerRow closes for organizer.
   * Falls back to the plain User fields (which submitRole already mirrors
   * name/category/username/logoUrl onto) when a field is missing from an
   * older-shaped payload. */
  private async newLineupRow(
    user: {
      id: string;
      lineupName: string | null;
      lineupCategory: string | null;
      lineupUsername: string | null;
      lineupLogoUrl: string | null;
      name: string;
      city: string;
      bio: string;
    },
    payload: Record<string, unknown> | null,
  ) {
    const base = (user.lineupUsername || user.lineupName || user.name || 'lineup')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'lineup';

    const uniqueSlug = async () => {
      let candidate = base;
      let n = 1;
      while (await this.prisma.lineup.findUnique({ where: { slug: candidate } })) {
        candidate = `${base}-${++n}`;
      }
      return candidate;
    };
    const uniqueId = async () => {
      let candidate = 'lu-' + base;
      let n = 1;
      while (await this.prisma.lineup.findUnique({ where: { id: candidate } })) {
        candidate = `lu-${base}-${++n}`;
      }
      return candidate;
    };

    const category = user.lineupCategory || 'Artist';
    const emoji: Record<string, string> = { DJ: '🎧', Band: '🎸', Comedian: '🎤', Artist: '🎨', Sponsor: '⭐', Promoter: '📣', Host: '🎙' };

    let h = 0;
    for (const c of user.id) h = (h * 31 + c.charCodeAt(0)) % 360;

    const str = (k: string) => (typeof payload?.[k] === 'string' ? (payload[k] as string).trim() : '') || undefined;
    const links = Array.isArray(payload?.links) ? (payload!.links as string[]).map((s) => s.trim()).filter(Boolean) : [];

    return {
      id: await uniqueId(),
      slug: await uniqueSlug(),
      name: user.lineupName || user.name || 'Lineup',
      verified: true, // this row is only ever created at the moment KYC is approved
      category,
      city: str('city') || user.city || '',
      state: str('state'),
      country: str('country'),
      pincode: str('pincode'),
      bio: str('bio') || user.bio || '',
      logoUrl: user.lineupLogoUrl ?? undefined,
      links,
      hue: h,
      emoji: emoji[category] ?? '🎤',
      userId: user.id,
    };
  }

  async reject(id: string, reviewedBy: string, reason: string) {
    const sub = await this.prisma.kycSubmission.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException();
    if (sub.kind === 'guest') throw new BadRequestException('Guest verification is automatic, nothing to reject');

    await this.prisma.$transaction([
      this.prisma.kycSubmission.update({
        where: { id },
        data: { status: 'rejected', reviewedBy, reviewedAt: new Date(), reviewNote: reason },
      }),
      this.prisma.user.update({ where: { id: sub.userId }, data: { roleStatus: 'rejected' } }),
    ]);

    const applicant = await this.prisma.user.findUnique({ where: { id: sub.userId } });
    if (applicant) {
      const reasonBlock = reason
        ? `<p style="background:rgba(255,107,94,.08);border:1px solid rgba(255,107,94,.25);border-radius:8px;padding:10px 12px;">${reason}</p>`
        : '';
      await this.email.sendTemplate(applicant.email, 'kyc_rejected', {
        name: applicant.name, roleLabel: KYC_ROLE_LABEL[sub.kind] ?? sub.kind, reasonBlock,
      }).catch(() => {});
    }
    return { ok: true };
  }

  // ---------- sales-assisted organizer onboarding (Admin > Leads) ----------

  /** Lead team's half — "Start Onboarding" on a Lead. Deliberately collects
   * only what a sales call would realistically produce (brand/contact/
   * location/event types) — no GSTIN/PAN/bank/documents here at all; the
   * verification team owns all of that (see addOrganizerVerificationDetails/
   * addOrganizerDocuments below), never the lead team. Provisions a real
   * User for the lead's phone if one doesn't exist yet (same "create by
   * phone, they reconcile on first real login" pattern already used for
   * organizer team invites) and drops a real, empty-of-compliance-data
   * KycSubmission into the same Verifications queue every self-serve
   * application already goes through — no separate review UI needed. */
  async startOrganizerOnboarding(
    leadId: string,
    staffEmail: string,
    body: {
      brandName?: string; contactPerson?: string;
      city?: string; state?: string; country?: string; pincode?: string;
      eventTypes?: string; about?: string;
      socialLinks?: { instagram?: string; facebook?: string; other?: string[] };
      confirmExistingUser?: boolean;
    },
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.role !== 'organizer') throw new BadRequestException(`This is a "${lead.role}" lead — can't start organizer onboarding for it`);
    if (!lead.contact?.trim()) throw new BadRequestException('This lead has no phone number on file');
    if (!body.brandName?.trim()) throw new BadRequestException('Brand name is required');
    if (!body.contactPerson?.trim()) throw new BadRequestException('Contact person is required');
    if (!body.city?.trim() || !body.state?.trim() || !body.country?.trim()) throw new BadRequestException('City, state and country are required');
    if (!body.eventTypes?.trim()) throw new BadRequestException('Event types are required');

    const phone = normalizePhone(lead.contact);
    let user = await this.prisma.user.findUnique({ where: { phone } });
    // A lead's phone number can coincidentally match a real, unrelated
    // Prebooze account (a genuine guest, or someone who signed up some
    // other way) — the lead team typing in a phone number is not the same
    // thing as that person actually being that account holder. Silently
    // repurposing a stranger's account (flipping their roleStatus to
    // 'pending' as if they'd personally applied) is exactly the bug this
    // guard exists to prevent — confirmed for real 2026-08-11 when a lead's
    // phone matched an existing guest with no relation to the application.
    // Only a genuinely brand-new phone (no prior account at all) skips this.
    if (user && !body.confirmExistingUser) {
      throw new BadRequestException(
        `EXISTING_ACCOUNT: This phone number already belongs to an existing Prebooze account${user.name ? ` (${user.name})` : ''} — confirm this is the same person before continuing.`,
      );
    }
    if (!user) {
      user = await this.prisma.user.create({ data: { phone, name: body.contactPerson.trim(), email: lead.email?.trim() || '' } });
    }
    if (user.role) throw new BadRequestException(`This phone number already holds the "${user.role}" role`);
    if (user.roleStatus === 'pending') throw new BadRequestException('This phone number already has an application under review');

    const submission = await this.prisma.kycSubmission.create({
      data: {
        userId: user.id,
        kind: 'organizer',
        status: 'pending',
        payload: {
          brand: body.brandName.trim(),
          brandName: body.brandName.trim(),
          contactPerson: body.contactPerson.trim(),
          contact: lead.email?.trim() || undefined,
          phone,
          city: body.city.trim(),
          state: body.state.trim(),
          country: body.country.trim(),
          pincode: body.pincode?.trim() || undefined,
          types: body.eventTypes.trim(),
          about: body.about?.trim() || undefined,
          socialLinks: body.socialLinks ?? undefined,
          leadId,
        } as Prisma.InputJsonValue,
        documents: [],
      },
    });

    await this.prisma.user.update({ where: { id: user.id }, data: { roleStatus: 'pending' } });
    await this.prisma.leadActivity.create({ data: { leadId, text: `Onboarding started by ${staffEmail} — sent for verification` } });
    await this.notifications.notify('🛡', `${body.brandName.trim()} sent for verification (via Leads)`, '/admin/kyc').catch(() => {});

    return submission;
  }

  /** Verification team's half, part 1 — GSTIN/PAN/bank details, filled in
   * once they've actually called the applicant and collected them. Only
   * touches these specific keys in the payload, leaving everything the lead
   * team already filled in untouched. Blocked once the submission's already
   * been decided — nothing left to update. */
  async addOrganizerVerificationDetails(
    id: string,
    body: { gstin?: string; pan?: string; bankName?: string; bankAccount?: string; accountHolderName?: string; bankIfsc?: string },
  ) {
    const sub = await this.prisma.kycSubmission.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Submission not found');
    if (sub.kind !== 'organizer') throw new BadRequestException('Only organizer applications take verification details this way');
    if (sub.status !== 'pending') throw new BadRequestException('This application has already been reviewed');

    const payload = { ...(sub.payload as Record<string, unknown>) };
    if (body.gstin !== undefined) payload.gstin = body.gstin.trim().toUpperCase() || undefined;
    if (body.pan !== undefined) payload.pan = body.pan.trim().toUpperCase() || undefined;
    if (body.bankName !== undefined) payload.bankName = body.bankName.trim() || undefined;
    if (body.bankAccount !== undefined) payload.bankAccount = body.bankAccount.trim() || undefined;
    if (body.accountHolderName !== undefined) payload.accountHolderName = body.accountHolderName.trim() || undefined;
    if (body.bankIfsc !== undefined) payload.bankIfsc = body.bankIfsc.trim().toUpperCase() || undefined;

    return this.prisma.kycSubmission.update({ where: { id }, data: { payload: payload as Prisma.InputJsonValue } });
  }

  /** Verification team's half, part 2 — real KYC documents, uploaded once
   * received (GST certificate, PAN card, etc. — whatever the verifier asks
   * for; each entry names what it is (GST certificate, PAN card, ...), same
   * free-form `documents[].type` shape self-serve submissions already use.
   * Takes already-uploaded URLs rather than raw files — the admin panel
   * already has a generic upload endpoint (POST /admin/media/upload, no
   * mutation of its own, any staff can call it) for exactly this, so this
   * method just records the result instead of handling multipart itself.
   * Appends rather than replaces, so multiple upload rounds don't clobber
   * earlier ones. */
  async addOrganizerDocuments(id: string, docs: { type: string; path: string }[]) {
    const sub = await this.prisma.kycSubmission.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Submission not found');
    if (sub.status !== 'pending') throw new BadRequestException('This application has already been reviewed');
    if (!docs.length) throw new BadRequestException('At least one document is required');

    const existing = Array.isArray(sub.documents) ? sub.documents : [];
    return this.prisma.kycSubmission.update({
      where: { id },
      data: { documents: [...existing, ...docs] as unknown as Prisma.InputJsonValue },
    });
  }
}
