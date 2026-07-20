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

    await this.prisma.$transaction([
      this.prisma.kycSubmission.update({
        where: { id },
        data: { status: 'approved', reviewedBy, reviewedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: sub.userId },
        data: { role: sub.kind as never, roleStatus: 'approved' },
      }),
    ]);
    return { ok: true };
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
