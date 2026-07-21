import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { StorageService } from './storage.service';
import { KycProviderService } from './kyc-provider.service';
import { toApiUser } from '../auth/auth.service';

const ROLE_KINDS = ['organizer', 'promoter', 'lineup', 'venue'] as const;
type RoleKind = (typeof ROLE_KINDS)[number];

@Injectable()
export class KycService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private provider: KycProviderService,
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

    // store the self-reported profile fields immediately (display only — the
    // elevated `role` itself stays unset until a human approves)
    const profilePatch: Record<string, unknown> = { roleStatus: 'pending' };
    if (kind === 'organizer') Object.assign(profilePatch, { orgBrand: payload.brand, orgUsername: payload.username });
    if (kind === 'promoter') Object.assign(profilePatch, { promoterBrand: payload.brand, promoterUsername: payload.username });
    if (kind === 'lineup') Object.assign(profilePatch, { lineupName: payload.name, lineupCategory: payload.category, lineupUsername: payload.username });
    if (kind === 'venue') Object.assign(profilePatch, { venueName: payload.name, venueId: payload.venueId });

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
      if (user && !existing) ops.push(this.prisma.organizer.create({ data: await this.newOrganizerRow(user) }));
    }

    // same reasoning for promoter — PromoterGuest.promoterSlug and
    // Booking.promoterRef both join against Promoter.slug, and a fresh
    // approval has no row to be found by that slug yet.
    if (sub.kind === 'promoter') {
      const [user, existing] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: sub.userId } }),
        this.prisma.promoter.findUnique({ where: { userId: sub.userId } }),
      ]);
      if (user && !existing) ops.push(this.prisma.promoter.create({ data: await this.newPromoterRow(user) }));
    }

    await this.prisma.$transaction(ops);
    return { ok: true };
  }

  /** Picks a free slug-style id/username for a newly-approved organizer,
   * falling back to a numeric suffix on collision (e.g. two organizers both
   * picking "nightowl" at KYC time — the seeded catalog isn't reserved). */
  private async newOrganizerRow(user: { id: string; orgBrand: string | null; orgUsername: string | null; name: string; city: string }) {
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

    return {
      id: await unique('id'),
      brandName: user.orgBrand || user.name || 'Organizer',
      username: await unique('username'),
      city: user.city || '',
      since: String(new Date().getFullYear()),
      about: '',
      logoHue: h,
      userId: user.id,
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
      city: user.city || '',
      bio: '',
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
    return { ok: true };
  }
}
