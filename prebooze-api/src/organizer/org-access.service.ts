import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Organizer } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type OrgPermLevel = 'view' | 'edit';
type PermMatrix = Record<string, Record<OrgPermLevel, boolean>>;

/** Resolves "which organizer is this JWT allowed to act as, and with what
 * permissions". The real owner (Organizer.userId) always has full access —
 * unchanged behaviour from before this existed. An invited OrgStaff member
 * (see OrgTeamService.addStaff) resolves instead to their organizer's
 * OrgRole permission matrix. Every organizer-scoped controller method that
 * used to call a bare "myOrganizer(userId)" now goes through here, so a
 * real invited team member can actually use the console scoped to their
 * role instead of the invite being a decorative name label with no login
 * path and no enforcement. */
@Injectable()
export class OrgAccessService {
  constructor(private prisma: PrismaService) {}

  async resolve(userId: string): Promise<{ org: Organizer; isOwner: boolean; roleName?: string; can: (module: string, level: OrgPermLevel) => boolean }> {
    const owned = await this.prisma.organizer.findUnique({ where: { userId } });
    if (owned) return { org: owned, isOwner: true, can: () => true };

    const staff = await this.prisma.orgStaff.findFirst({ where: { userId } });
    if (!staff) throw new ForbiddenException('Not an approved organizer');
    const org = await this.prisma.organizer.findUnique({ where: { id: staff.organizerId } });
    if (!org) throw new ForbiddenException('Not an approved organizer');
    const role = await this.prisma.orgRole.findUnique({ where: { organizerId_name: { organizerId: org.id, name: staff.roleName } } });
    const perms = (role?.permissions as PermMatrix | undefined) ?? {};
    return { org, isOwner: false, roleName: staff.roleName, can: (module, level) => !!perms[module]?.[level] };
  }

  /** Resolve + assert one permission cell in a single call — the shape every
   * controller-facing method actually wants. */
  async require(userId: string, module: string, level: OrgPermLevel): Promise<Organizer> {
    const access = await this.resolve(userId);
    if (!access.can(module, level)) {
      throw new ForbiddenException(`Your role doesn't have "${level}" access to "${module}"`);
    }
    return access.org;
  }

  /** For the handful of owner-only surfaces (billing/invoices, and the
   * KYC-linked profile fields like PAN/GSTIN/bank details a "Settings &
   * team" edit already exposes) that are deliberately never delegated to
   * staff, regardless of role. */
  async requireOwner(userId: string): Promise<Organizer> {
    const access = await this.resolve(userId);
    if (!access.isOwner) throw new ForbiddenException('Only the account owner can do this');
    return access.org;
  }
}
