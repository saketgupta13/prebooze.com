import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { StorageService } from './storage.service';
import { KycProviderService } from './kyc-provider.service';
import { toApiUser } from '../auth/auth.service';
import { NotificationsService } from '../admin/notifications.service';
import { EmailService } from '../notifications/email';
import { KYC_ROLE_LABEL } from '../notifications/email-templates';
import { StaffAlertsService } from '../notifications/staff-alerts';

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
  ) {}

  // ---------- guest: automatic ----------
  async submitGuest(userId: string, idDoc?: Express.Multer.File, selfie?: Express.Multer.File) {
    if (!idDoc || !selfie) throw new BadRequestException('Both an ID document and a selfie are required');

    const result = await this.provider.checkGuest(idDoc, selfie);
    const documents = [
      { type: 'id_doc', path: this.storage.save(idDoc) },
      { type: 'selfie', path: this.storage.save(selfie) },
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
    if (!files.length) throw new BadRequestException('At least one document is required');

    const documents = files.map((f, i) => ({
      type: (payload.docLabels as string[] | undefined)?.[i] ?? `doc_${i + 1}`,
      path: this.storage.save(f),
    }));

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
    if (kind === 'lineup') Object.assign(profilePatch, { lineupName: payload.name, lineupCategory: payload.category, lineupUsername: payload.username });
    // no venue case here — kind === 'venue' is rejected above, before this point

    const updated = await this.prisma.user.update({ where: { id: userId }, data: profilePatch });
    return { status: 'pending', user: toApiUser(updated) };
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
    if (sub.kind === 'organizer') {
      const [user, existing] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: sub.userId } }),
        this.prisma.organizer.findUnique({ where: { userId: sub.userId } }),
      ]);
      if (user && !existing) {
        const row = await this.newOrganizerRow(user, sub.payload as Record<string, unknown> | null);
        ops.push(this.prisma.organizer.create({ data: row }));
        // Organizer.username is normalized (lowercased, collision-suffixed);
        // User.orgUsername was captured raw at submission time and never
        // touched again — sync it now so any exact-match comparison against
        // the real catalog username (e.g. the public-profile "is this my
        // own page" check) doesn't silently mismatch on casing forever.
        ops.push(this.prisma.user.update({ where: { id: sub.userId }, data: { orgUsername: row.username } }));
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
        const row = await this.newPromoterRow(user);
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
        const row = await this.newLineupRow(user);
        ops.push(this.prisma.lineup.create({ data: row }));
        ops.push(this.prisma.user.update({ where: { id: sub.userId }, data: { lineupUsername: row.slug } }));
      }
    }

    await this.prisma.$transaction(ops);

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
  ) {
    const base = (user.orgUsername || user.orgBrand || user.name || 'organizer')
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
      brandName: user.orgBrand || user.name || 'Organizer',
      username: await unique('username'),
      verified: true, // this row is only ever created at the moment KYC is approved
      city: user.city || '',
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
   * "pr1" with a separate human slug), so both need picking. */
  private async newPromoterRow(user: { id: string; promoterBrand: string | null; promoterUsername: string | null; name: string; city: string }) {
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

    return {
      id: await uniqueId(),
      slug: await uniqueSlug(),
      name: user.promoterBrand || user.name || 'Promoter',
      verified: true, // this row is only ever created at the moment KYC is approved
      city: user.city || '',
      bio: '',
      userId: user.id,
    };
  }

  /** Same slug-collision-safe scheme again, keyed off lineupUsername/lineupName.
   * bio/city are pulled from the plain User fields — LineupSettings.tsx saves
   * artist-profile edits through the generic PATCH /me, not a dedicated
   * endpoint, so those are the live source of truth even post-approval. */
  private async newLineupRow(user: {
    id: string;
    lineupName: string | null;
    lineupCategory: string | null;
    lineupUsername: string | null;
    name: string;
    city: string;
    bio: string;
  }) {
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

    return {
      id: await uniqueId(),
      slug: await uniqueSlug(),
      name: user.lineupName || user.name || 'Lineup',
      verified: true, // this row is only ever created at the moment KYC is approved
      category,
      city: user.city || '',
      bio: user.bio || '',
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
}
