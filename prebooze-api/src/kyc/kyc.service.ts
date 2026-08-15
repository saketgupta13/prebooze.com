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
   * only, no admin review. Username is auto-derived from the brand name
   * (newOrganizerRow's collision-suffixed slug, same scheme Promoter/Lineup
   * already use) rather than typed — one less thing to fill in, and it's
   * editable later via updateMe anyway. Unlike submitRole, this creates the
   * live Organizer row and approves the role immediately, so an organizer
   * can start building draft events the moment they submit this — the
   * per-event admin approval queue is the real safety net before anything
   * they build reaches a guest, unchanged by any of this. `verified` stays
   * false until identity verification (submitOrganizerVerification below)
   * is reviewed and approved — that's now the *only* thing `verified` means
   * for organizer, entirely decoupled from payout ability (PaymentProfile,
   * see OrganizerService) and from "has an account they can use." */
  async quickSignupOrganizer(
    userId: string,
    payload: {
      brand?: string;
      city?: string; state?: string; country?: string; pincode?: string;
      types?: string[];
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

  /** Self-serve *identity* verification only — badge-only, entirely
   * separate from payout ability (PaymentProfile, self-serve, no review —
   * see OrganizerService). There's no API to validate an Aadhaar number
   * against, so this collects actual documents for a human reviewer instead
   * of a typed number: an individual uploads their own Aadhaar card; a firm
   * uploads its registration document plus the owner's Aadhaar card. A
   * selfie is required either way. Since the person submitting this may not
   * be the account owner (any team member could be doing the actual KYC
   * call), it also records who's vouching for it — name/phone/email/role —
   * so a reviewer knows who they're dealing with and in what capacity. */
  async submitOrganizerVerification(
    userId: string,
    payload: {
      entityType?: 'individual' | 'firm';
      contactName?: string; contactPhone?: string; contactEmail?: string;
      contactRole?: 'Owner' | 'Manager' | 'Accountant' | 'Other'; contactRoleOther?: string;
      docLabels?: string[];
    },
    files: Express.Multer.File[],
  ) {
    const org = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!org) throw new BadRequestException('Complete your organizer signup first');
    if (org.verified) throw new BadRequestException("You're already verified");
    const alreadyPending = await this.prisma.kycSubmission.findFirst({ where: { userId, kind: 'organizer', status: 'pending' } });
    if (alreadyPending) throw new BadRequestException('Your verification is already under review');

    if (payload.entityType !== 'individual' && payload.entityType !== 'firm') {
      throw new BadRequestException('Select whether this is an individual or a firm/company');
    }
    if (!payload.contactName?.trim() || !payload.contactPhone?.trim() || !payload.contactEmail?.trim()) {
      throw new BadRequestException('Contact person name, phone and email are required');
    }
    if (!payload.contactRole) throw new BadRequestException('Contact person role is required');
    if (payload.contactRole === 'Other' && !payload.contactRoleOther?.trim()) {
      throw new BadRequestException('Describe the contact person\'s role');
    }

    const documents = await Promise.all(files.map(async (f, i) => ({
      type: payload.docLabels?.[i] ?? `doc_${i + 1}`,
      path: await this.storage.save(f),
    })));
    const types = new Set(documents.map((d) => d.type));
    const required = payload.entityType === 'individual' ? ['aadhaar', 'selfie'] : ['registration', 'ownerAadhaar', 'selfie'];
    const missing = required.filter((t) => !types.has(t));
    if (missing.length) throw new BadRequestException(`Missing required document(s): ${missing.join(', ')}`);

    const submission = await this.prisma.kycSubmission.create({
      data: {
        userId,
        kind: 'organizer',
        status: 'pending',
        payload: {
          verificationUpgrade: true,
          entityType: payload.entityType,
          contactName: payload.contactName.trim(),
          contactPhone: payload.contactPhone.trim(),
          contactEmail: payload.contactEmail.trim(),
          contactRole: payload.contactRole,
          contactRoleOther: payload.contactRole === 'Other' ? payload.contactRoleOther!.trim() : undefined,
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

  /** Self-serve promoter signup, minimal — same shape as
   * quickSignupOrganizer: brand/location/bio only, no admin review, no
   * documents. Creates the live Promoter row immediately (unverified) and
   * approves the role right away — a promoter can start capturing guests
   * the moment they submit this. `verified` now means only "identity
   * verification passed" (submitPromoterVerification below), same
   * decoupling as organizer. */
  async quickSignupPromoter(
    userId: string,
    payload: {
      brand?: string;
      city?: string; state?: string; country?: string; pincode?: string;
      bio?: string; links?: string; audience?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException();
    if (user.role) {
      throw new BadRequestException(
        user.role === 'promoter' ? "You're already an approved promoter" : 'This number already holds a role — one number, one role',
      );
    }
    if (user.roleStatus === 'pending') throw new BadRequestException('Your application is already under review');
    if (!payload.brand?.trim()) throw new BadRequestException('Brand name is required');
    if (!payload.city?.trim()) throw new BadRequestException('City is required');
    if (!payload.bio?.trim()) throw new BadRequestException('A short bio is required');

    const row = await this.newPromoterRow(user, payload, false);
    await this.prisma.$transaction([
      this.prisma.promoter.create({ data: row }),
      this.prisma.user.update({
        where: { id: userId },
        data: { role: 'promoter', roleStatus: 'approved', promoterBrand: row.name, promoterUsername: row.slug },
      }),
    ]);

    this.meta
      .sendEvent('Lead', `${user.phone}_promoter`, 'https://prebooze.com/promoter/onboarding', { phone: user.phone, email: user.email }, { content_name: 'promoter_onboarding' })
      .catch(() => {});
    this.leads.resolveDraft(user.phone, 'promoter').catch(() => {});
    await this.notifications.notify('📣', `${row.name} signed up as a new promoter`, '/promoters').catch(() => {});

    const updated = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { status: 'approved', user: toApiUser(updated) };
  }

  /** Self-serve promoter identity verification — badge-only, same guest-
   * style ID + selfie check as organizer's individual path, minus the
   * individual/firm split (a promoter applying is always one person). Never
   * blocks anything else — payouts already ride on Promoter.bankAccount*
   * fields (self-serve, Settings), entirely separate from this. */
  async submitPromoterVerification(userId: string, files: Express.Multer.File[]) {
    const promoter = await this.prisma.promoter.findUnique({ where: { userId } });
    if (!promoter) throw new BadRequestException('Complete your promoter signup first');
    if (promoter.verified) throw new BadRequestException("You're already verified");
    const alreadyPending = await this.prisma.kycSubmission.findFirst({ where: { userId, kind: 'promoter', status: 'pending' } });
    if (alreadyPending) throw new BadRequestException('Your verification is already under review');

    const documents = await Promise.all(files.map(async (f, i) => ({
      type: i === 0 ? 'id_doc' : 'selfie',
      path: await this.storage.save(f),
    })));
    const types = new Set(documents.map((d) => d.type));
    const missing = ['id_doc', 'selfie'].filter((t) => !types.has(t));
    if (missing.length) throw new BadRequestException(`Missing required document(s): ${missing.join(', ')}`);

    const submission = await this.prisma.kycSubmission.create({
      data: {
        userId,
        kind: 'promoter',
        status: 'pending',
        payload: { verificationUpgrade: true } as Prisma.InputJsonValue,
        documents: documents as unknown as Prisma.InputJsonValue,
      },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    await this.notifications.notify('🛡', `${promoter.name} submitted verification details for review`, '/admin/kyc').catch(() => {});
    await this.staffAlerts.alert(`🛡 ${promoter.name} submitted verification details for review`).catch(() => {});
    if (user) await this.email.sendTemplate(user.email, 'kyc_pending', { name: user.name, roleLabel: 'promoter' }).catch(() => {});
    return submission;
  }

  /** Self-serve line-up signup, minimal — same shape as quickSignupOrganizer/
   * quickSignupPromoter. Creates the live Lineup row immediately (unverified)
   * and approves the role right away — a stage profile is visible and
   * bookable the moment this is submitted. Logo is uploaded separately via
   * RealUploadBox at the same LineupOnboarding.tsx step (lineup.upload has
   * no ownership gate, so it already works pre-row same as venue's). */
  async quickSignupLineup(
    userId: string,
    payload: {
      name?: string; category?: string;
      city?: string; state?: string; country?: string; pincode?: string;
      bio?: string; links?: string[]; logoUrl?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException();
    if (user.role) {
      throw new BadRequestException(
        user.role === 'lineup' ? "You're already an approved line-up" : 'This number already holds a role — one number, one role',
      );
    }
    if (user.roleStatus === 'pending') throw new BadRequestException('Your application is already under review');
    if (!payload.name?.trim()) throw new BadRequestException('Stage / brand name is required');
    if (!payload.city?.trim()) throw new BadRequestException('City is required');
    if (!payload.bio?.trim()) throw new BadRequestException('A short bio is required');

    // newLineupRow reads city/bio/links/logoUrl off the *user* object as a
    // fallback (older-shaped payload support), so mirror the submitted
    // fields onto User first — same order quickSignupOrganizer's row-then-
    // user-update transaction implies but lineup needs explicit since
    // newLineupRow's fallback path reads user.lineupName/lineupCategory/etc,
    // not this payload's raw brand/category directly.
    const userForRow = {
      ...user,
      lineupName: payload.name.trim(),
      lineupCategory: payload.category || user.lineupCategory,
      lineupLogoUrl: payload.logoUrl ?? user.lineupLogoUrl,
      bio: payload.bio.trim(),
    };
    const row = await this.newLineupRow(userForRow, { ...payload, links: payload.links ?? [] }, false);
    await this.prisma.$transaction([
      this.prisma.lineup.create({ data: row }),
      this.prisma.user.update({
        where: { id: userId },
        data: { role: 'lineup', roleStatus: 'approved', lineupName: row.name, lineupCategory: row.category, lineupUsername: row.slug, lineupLogoUrl: row.logoUrl },
      }),
    ]);

    this.meta
      .sendEvent('Lead', `${user.phone}_lineup`, 'https://prebooze.com/lineup/onboarding', { phone: user.phone, email: user.email }, { content_name: 'lineup_onboarding' })
      .catch(() => {});
    this.leads.resolveDraft(user.phone, 'lineup').catch(() => {});
    await this.notifications.notify('🎤', `${row.name} signed up as a new line-up`, '/lineups').catch(() => {});

    const updated = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { status: 'approved', user: toApiUser(updated) };
  }

  /** Self-serve line-up identity verification — genuinely new capability
   * (line-ups never had one before, since they don't touch payouts). Same
   * guest-style ID + selfie check as promoter's, purely a badge — never
   * blocks booking or profile visibility. */
  async submitLineupVerification(userId: string, files: Express.Multer.File[]) {
    const lineup = await this.prisma.lineup.findUnique({ where: { userId } });
    if (!lineup) throw new BadRequestException('Complete your line-up signup first');
    if (lineup.verified) throw new BadRequestException("You're already verified");
    const alreadyPending = await this.prisma.kycSubmission.findFirst({ where: { userId, kind: 'lineup', status: 'pending' } });
    if (alreadyPending) throw new BadRequestException('Your verification is already under review');

    const documents = await Promise.all(files.map(async (f, i) => ({
      type: i === 0 ? 'id_doc' : 'selfie',
      path: await this.storage.save(f),
    })));
    const types = new Set(documents.map((d) => d.type));
    const missing = ['id_doc', 'selfie'].filter((t) => !types.has(t));
    if (missing.length) throw new BadRequestException(`Missing required document(s): ${missing.join(', ')}`);

    const submission = await this.prisma.kycSubmission.create({
      data: {
        userId,
        kind: 'lineup',
        status: 'pending',
        payload: { verificationUpgrade: true } as Prisma.InputJsonValue,
        documents: documents as unknown as Prisma.InputJsonValue,
      },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    await this.notifications.notify('🛡', `${lineup.name} submitted verification details for review`, '/admin/kyc').catch(() => {});
    await this.staffAlerts.alert(`🛡 ${lineup.name} submitted verification details for review`).catch(() => {});
    if (user) await this.email.sendTemplate(user.email, 'kyc_pending', { name: user.name, roleLabel: 'lineup' }).catch(() => {});
    return submission;
  }

  /** Self-serve venue identity verification — badge-only, entirely separate
   * from the venue's onboarding (which no longer collects any documents —
   * see VenueService.onboard). A venue is always a business, so this is a
   * single shape (no individual/firm split like organizer's): registration/
   * license doc + address proof, plus who's submitting it. */
  async submitVenueVerification(
    userId: string,
    payload: {
      contactName?: string; contactPhone?: string; contactEmail?: string;
      contactRole?: 'Owner' | 'Manager' | 'Accountant' | 'Other'; contactRoleOther?: string;
      docLabels?: string[];
    },
    files: Express.Multer.File[],
  ) {
    const venue = await this.prisma.venue.findUnique({ where: { userId } });
    if (!venue) throw new BadRequestException('Complete your venue signup first');
    if (venue.verified) throw new BadRequestException("You're already verified");
    const alreadyPending = await this.prisma.kycSubmission.findFirst({ where: { userId, kind: 'venue', status: 'pending' } });
    if (alreadyPending) throw new BadRequestException('Your verification is already under review');

    if (!payload.contactName?.trim() || !payload.contactPhone?.trim() || !payload.contactEmail?.trim()) {
      throw new BadRequestException('Contact person name, phone and email are required');
    }
    if (!payload.contactRole) throw new BadRequestException('Contact person role is required');
    if (payload.contactRole === 'Other' && !payload.contactRoleOther?.trim()) {
      throw new BadRequestException('Describe the contact person\'s role');
    }

    const documents = await Promise.all(files.map(async (f, i) => ({
      type: payload.docLabels?.[i] ?? `doc_${i + 1}`,
      path: await this.storage.save(f),
    })));
    const types = new Set(documents.map((d) => d.type));
    const required = ['license', 'address_proof'];
    const missing = required.filter((t) => !types.has(t));
    if (missing.length) throw new BadRequestException(`Missing required document(s): ${missing.join(', ')}`);

    const submission = await this.prisma.kycSubmission.create({
      data: {
        userId,
        kind: 'venue',
        status: 'pending',
        payload: {
          verificationUpgrade: true,
          venueId: venue.id,
          contactName: payload.contactName.trim(),
          contactPhone: payload.contactPhone.trim(),
          contactEmail: payload.contactEmail.trim(),
          contactRole: payload.contactRole,
          contactRoleOther: payload.contactRole === 'Other' ? payload.contactRoleOther!.trim() : undefined,
        } as Prisma.InputJsonValue,
        documents: documents as unknown as Prisma.InputJsonValue,
      },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    await this.notifications.notify('🛡', `${venue.name} submitted verification details for review`, '/admin/kyc').catch(() => {});
    await this.staffAlerts.alert(`🛡 ${venue.name} submitted verification details for review`).catch(() => {});
    if (user) await this.email.sendTemplate(user.email, 'kyc_pending', { name: user.name, roleLabel: 'venue' }).catch(() => {});
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

    // Two kinds of organizer submission need a stricter gate before
    // approval, since neither is guaranteed complete just by existing:
    // sales-assisted applications (payload.leadId — lead team only gathers
    // the basics up front, the verification team fills in GSTIN/PAN/bank
    // via addOrganizerVerificationDetails/addOrganizerDocuments below before
    // this can be approved — that data becomes this organizer's first
    // PaymentProfile, see the creation branch below) and self-serve identity
    // verification (payload.verificationUpgrade — submitOrganizerVerification
    // already required all of this at submission time; re-checking here
    // means a future caller of this same submission-creation path can't
    // accidentally skip it). `noGst` lets a legitimately GST-exempt lead
    // through without a GSTIN on file.
    if (sub.kind === 'organizer') {
      const payload = sub.payload as Record<string, unknown> | null;
      if (payload?.leadId) {
        const missing: string[] = [];
        if (!payload.gstin && !payload.noGst) missing.push('GSTIN');
        if (!payload.pan) missing.push('PAN');
        if (!payload.bankAccount) missing.push('bank account number');
        if (!payload.bankIfsc) missing.push('IFSC code');
        if (!payload.bankName) missing.push('bank name');
        if (!payload.accountHolderName) missing.push('account holder name');
        if (missing.length) throw new BadRequestException(`Can't approve yet — still missing: ${missing.join(', ')}`);
      }
      if (payload?.verificationUpgrade) {
        const documents = Array.isArray(sub.documents) ? (sub.documents as { type: string }[]) : [];
        const types = new Set(documents.map((d) => d.type));
        const required = payload.entityType === 'individual' ? ['aadhaar', 'selfie'] : ['registration', 'ownerAadhaar', 'selfie'];
        const missing = required.filter((t) => !types.has(t));
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
        // Sales-assisted applications collect GSTIN/PAN/bank up front (the
        // missing-fields gate above already required all of it) — that
        // becomes this organizer's first PaymentProfile, same self-serve
        // model everyone else's payout details go through.
        const payload = sub.payload as Record<string, unknown> | null;
        const str = (k: string) => (typeof payload?.[k] === 'string' ? (payload[k] as string).trim() : '') || undefined;
        const bankAccount = str('bankAccount');
        if (bankAccount) {
          ops.push(this.prisma.paymentProfile.create({
            data: {
              organizerId: row.id,
              isDefault: true,
              legalName: str('accountHolderName') ?? row.brandName,
              businessAddress: '',
              country: row.country,
              state: row.state,
              city: row.city,
              pincode: row.pincode,
              bankAccountNumber: bankAccount,
              bankLast4: bankAccount.slice(-4),
              accountHolderName: str('accountHolderName') ?? '',
              ifsc: str('bankIfsc')?.toUpperCase() ?? '',
              pan: str('pan') ?? '',
              gstin: payload?.noGst ? null : str('gstin'),
              noGst: !!payload?.noGst,
            },
          }));
        }
      } else if (existing) {
        // Self-serve identity verification for an organizer who already
        // exists (quickSignupOrganizer already created the row, unverified)
        // — this submission carries no financial data at all (see
        // submitOrganizerVerification), just flip the badge.
        ops.push(this.prisma.organizer.update({ where: { id: existing.id }, data: { verified: true } }));
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
      } else if (existing) {
        // Self-serve identity verification for a promoter who already exists
        // (quickSignupPromoter already created the row, unverified) — see
        // submitPromoterVerification, just flip the badge.
        ops.push(this.prisma.promoter.update({ where: { id: existing.id }, data: { verified: true } }));
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
      } else if (existing) {
        // Self-serve identity verification for a line-up who already exists
        // (quickSignupLineup already created the row, unverified) — see
        // submitLineupVerification, just flip the badge.
        ops.push(this.prisma.lineup.update({ where: { id: existing.id }, data: { verified: true } }));
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

  /** Picks a free slug-style value for a role's id/username/slug field,
   * appending a numeric suffix on collision (e.g. two organizers both
   * picking "nightowl" — the seeded catalog isn't reserved). Shared by every
   * role's newXRow builder below — previously each one hand-copied the same
   * loop despite comments on all three claiming they were already sharing
   * one scheme; this makes that actually true, and is what newVenueRow
   * reuses too rather than adding a fourth copy. */
  private async uniqueSlugFor(model: 'organizer' | 'promoter' | 'lineup' | 'venue', field: 'id' | 'username' | 'slug', base: string): Promise<string> {
    const exists = (candidate: string) => {
      switch (model) {
        case 'organizer': return this.prisma.organizer.findUnique({ where: { [field]: candidate } as never });
        case 'promoter': return this.prisma.promoter.findUnique({ where: { [field]: candidate } as never });
        case 'lineup': return this.prisma.lineup.findUnique({ where: { [field]: candidate } as never });
        case 'venue': return this.prisma.venue.findUnique({ where: { [field]: candidate } as never });
      }
    };
    let candidate = base;
    let n = 1;
    while (await exists(candidate)) candidate = `${base}-${++n}`;
    return candidate;
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

    let h = 0;
    for (const c of user.id) h = (h * 31 + c.charCodeAt(0)) % 360;

    const str = (k: string) => (typeof payload?.[k] === 'string' ? (payload[k] as string).trim() : '') || undefined;
    const types = Array.isArray(payload?.types) ? (payload!.types as string[]).join(', ') : str('types');
    const social = payload?.socialLinks as { instagram?: string; facebook?: string; other?: string[] } | undefined;

    return {
      id: await this.uniqueSlugFor('organizer', 'id', base),
      brandName: payloadBrand || user.orgBrand || user.name || 'Organizer',
      username: await this.uniqueSlugFor('organizer', 'username', base),
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
      contact: str('contact'),
      contactPerson: str('contactPerson'),
      phone: str('phone'),
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
    verified = true,
  ) {
    const base = (user.promoterUsername || user.promoterBrand || user.name || 'promoter')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'promoter';

    const str = (k: string) => (typeof payload?.[k] === 'string' ? (payload[k] as string).trim() : '') || undefined;
    const links = (typeof payload?.links === 'string' ? (payload.links as string).split(',') : Array.isArray(payload?.links) ? (payload!.links as string[]) : [])
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      id: await this.uniqueSlugFor('promoter', 'id', 'pr-' + base),
      slug: await this.uniqueSlugFor('promoter', 'slug', base),
      name: user.promoterBrand || user.name || 'Promoter',
      verified, // quickSignupPromoter passes false; approve() (old submitRole path) still defaults true
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
    verified = true,
  ) {
    const base = (user.lineupUsername || user.lineupName || user.name || 'lineup')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'lineup';

    const category = user.lineupCategory || 'Artist';
    const emoji: Record<string, string> = { DJ: '🎧', Band: '🎸', Comedian: '🎤', Artist: '🎨', Sponsor: '⭐', Promoter: '📣', Host: '🎙' };

    let h = 0;
    for (const c of user.id) h = (h * 31 + c.charCodeAt(0)) % 360;

    const str = (k: string) => (typeof payload?.[k] === 'string' ? (payload[k] as string).trim() : '') || undefined;
    const links = Array.isArray(payload?.links) ? (payload!.links as string[]).map((s) => s.trim()).filter(Boolean) : [];

    return {
      id: await this.uniqueSlugFor('lineup', 'id', 'lu-' + base),
      slug: await this.uniqueSlugFor('lineup', 'slug', base),
      name: user.lineupName || user.name || 'Lineup',
      verified, // quickSignupLineup passes false; approve() (old submitRole path) still defaults true
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
