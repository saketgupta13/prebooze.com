import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export const ORG_PERM_MODULES = [
  'Events & wizard',
  'Attendees & check-in',
  'Guest list',
  'Coupons',
  'Payouts & withdrawals',
  'Reviews',
  'Settings & team',
] as const;

type PermSet = { view: boolean; edit: boolean };
type PermMatrix = Record<string, PermSet>;

const perms = (view: boolean, edit: boolean): PermSet => ({ view, edit });

/** Seeded the first time an organizer ever looks at Team & roles — same
 * default shape the old mock shipped with (Owner/Manager/Door staff/
 * Promoter), now real per-organizer rows instead of a shared client-side
 * constant. */
const DEFAULT_ROLES: Record<string, PermMatrix> = {
  Owner: Object.fromEntries(ORG_PERM_MODULES.map((m) => [m, perms(true, true)])),
  Manager: {
    'Events & wizard': perms(true, true),
    'Attendees & check-in': perms(true, true),
    'Guest list': perms(true, true),
    Coupons: perms(true, true),
    'Payouts & withdrawals': perms(true, false),
    Reviews: perms(true, false),
    'Settings & team': perms(true, false),
  },
  'Door staff': {
    'Events & wizard': perms(false, false),
    'Attendees & check-in': perms(true, true),
    'Guest list': perms(true, true),
    Coupons: perms(false, false),
    'Payouts & withdrawals': perms(false, false),
    Reviews: perms(false, false),
    'Settings & team': perms(false, false),
  },
  Promoter: {
    'Events & wizard': perms(true, false),
    'Attendees & check-in': perms(true, false),
    'Guest list': perms(true, true),
    Coupons: perms(true, false),
    'Payouts & withdrawals': perms(false, false),
    Reviews: perms(true, false),
    'Settings & team': perms(false, false),
  },
};

@Injectable()
export class OrgTeamService {
  constructor(private prisma: PrismaService) {}

  private async myOrganizer(userId: string) {
    const org = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!org) throw new ForbiddenException('Not an approved organizer');
    return org;
  }

  /** Lazily seeds the four default roles on first real use — cheaper than a
   * migration-time backfill for every existing organizer, and every
   * organizer gets them the moment they open Team & roles either way. */
  private async ensureSeeded(organizerId: string) {
    const count = await this.prisma.orgRole.count({ where: { organizerId } });
    if (count > 0) return;
    await this.prisma.orgRole.createMany({
      data: Object.entries(DEFAULT_ROLES).map(([name, permissions]) => ({ organizerId, name, permissions })),
    });
  }

  // ---------- roles ----------
  async listRoles(userId: string) {
    const org = await this.myOrganizer(userId);
    await this.ensureSeeded(org.id);
    const rows = await this.prisma.orgRole.findMany({ where: { organizerId: org.id } });
    return Object.fromEntries(rows.map((r) => [r.name, r.permissions]));
  }

  async addRole(userId: string, name: string) {
    const org = await this.myOrganizer(userId);
    await this.ensureSeeded(org.id);
    if (!name?.trim()) throw new BadRequestException('name is required');
    if (await this.prisma.orgRole.findUnique({ where: { organizerId_name: { organizerId: org.id, name } } })) {
      throw new BadRequestException(`Role "${name}" already exists`);
    }
    const permissions = Object.fromEntries(ORG_PERM_MODULES.map((m) => [m, perms(true, false)]));
    return this.prisma.orgRole.create({ data: { organizerId: org.id, name, permissions } });
  }

  async setRolePerm(userId: string, roleName: string, module: string, key: 'view' | 'edit', value: boolean) {
    const org = await this.myOrganizer(userId);
    if (roleName === 'Owner') throw new BadRequestException('Owner always has full access');
    const role = await this.prisma.orgRole.findUnique({ where: { organizerId_name: { organizerId: org.id, name: roleName } } });
    if (!role) throw new NotFoundException('Role not found');
    const permissions = role.permissions as unknown as PermMatrix;
    permissions[module] = { ...(permissions[module] ?? { view: false, edit: false }), [key]: value };
    return this.prisma.orgRole.update({ where: { id: role.id }, data: { permissions } });
  }

  async removeRole(userId: string, roleName: string) {
    const org = await this.myOrganizer(userId);
    if (roleName === 'Owner') throw new BadRequestException("The Owner role can't be removed");
    const inUse = await this.prisma.orgStaff.count({ where: { organizerId: org.id, roleName } });
    if (inUse > 0) throw new BadRequestException(`Reassign members using "${roleName}" first`);
    const role = await this.prisma.orgRole.findUnique({ where: { organizerId_name: { organizerId: org.id, name: roleName } } });
    if (!role) throw new NotFoundException('Role not found');
    await this.prisma.orgRole.delete({ where: { id: role.id } });
    return { ok: true };
  }

  // ---------- staff ----------
  async listStaff(userId: string) {
    const org = await this.myOrganizer(userId);
    return this.prisma.orgStaff.findMany({ where: { organizerId: org.id }, orderBy: { createdAt: 'asc' } });
  }

  async addStaff(userId: string, body: { name?: string; phone?: string; roleName?: string; scan?: boolean }) {
    const org = await this.myOrganizer(userId);
    if (!body.name?.trim()) throw new BadRequestException('Name is required');
    const roleName = body.roleName?.trim() || 'Door staff';
    await this.ensureSeeded(org.id);
    const role = await this.prisma.orgRole.findUnique({ where: { organizerId_name: { organizerId: org.id, name: roleName } } });
    if (!role) throw new BadRequestException(`Unknown role "${roleName}"`);
    return this.prisma.orgStaff.create({
      data: { organizerId: org.id, name: body.name.trim(), phone: body.phone?.trim(), roleName, scan: body.scan ?? false },
    });
  }

  async updateStaffRole(userId: string, staffId: string, roleName: string) {
    const org = await this.myOrganizer(userId);
    const member = await this.prisma.orgStaff.findUnique({ where: { id: staffId } });
    if (!member || member.organizerId !== org.id) throw new NotFoundException('Team member not found');
    if (member.roleName === 'Owner') throw new BadRequestException("Can't change the Owner's role");
    const role = await this.prisma.orgRole.findUnique({ where: { organizerId_name: { organizerId: org.id, name: roleName } } });
    if (!role) throw new BadRequestException(`Unknown role "${roleName}"`);
    return this.prisma.orgStaff.update({ where: { id: staffId }, data: { roleName } });
  }

  async removeStaff(userId: string, staffId: string) {
    const org = await this.myOrganizer(userId);
    const member = await this.prisma.orgStaff.findUnique({ where: { id: staffId } });
    if (!member || member.organizerId !== org.id) throw new NotFoundException('Team member not found');
    if (member.roleName === 'Owner') throw new BadRequestException("Can't remove the Owner");
    await this.prisma.orgStaff.delete({ where: { id: staffId } });
    return { ok: true };
  }
}
