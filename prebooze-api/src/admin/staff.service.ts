import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { hashPassword, randomTempPassword } from './password.util';
import { EmailService } from '../notifications/email';
import { PERM_MODULES, resolvePermissions } from './permissions.util';

@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  // ---------- staff ----------
  async listStaff() {
    const rows = await this.prisma.staff.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(({ passwordHash: _passwordHash, ...s }) => s);
  }

  /** Still returns the one-time temp password in the response too (Owner
   * can share it directly if the email doesn't land) — the invite email is
   * additive, not a replacement for that existing contract. */
  async createStaff(body: { email?: string; name?: string; roleName?: string; city?: string; phone?: string }) {
    if (!body.email?.trim()) throw new BadRequestException('email is required');
    if (!body.roleName) throw new BadRequestException('roleName is required');
    const role = await this.prisma.staffRole.findUnique({ where: { name: body.roleName } });
    if (!role) throw new BadRequestException(`Unknown role "${body.roleName}"`);

    const email = body.email.trim().toLowerCase();
    if (await this.prisma.staff.findUnique({ where: { email } })) throw new BadRequestException('This email is already staff');

    const tempPassword = randomTempPassword();
    const staff = await this.prisma.staff.create({
      data: {
        email,
        name: body.name?.trim() || email.split('@')[0],
        roleName: body.roleName,
        city: body.city,
        phone: body.phone?.trim() || undefined,
        passwordHash: hashPassword(tempPassword),
      },
    });
    const { passwordHash: _passwordHash, ...rest } = staff;
    await this.email.sendTemplate(staff.email, 'staff_invite', {
      name: staff.name, roleName: staff.roleName, tempPassword,
    }).catch(() => {});
    return { ...rest, tempPassword };
  }

  async updateStaffRole(id: string, roleName: string) {
    if (!roleName) throw new BadRequestException('roleName is required');
    const [staff, role] = await Promise.all([
      this.prisma.staff.findUnique({ where: { id } }),
      this.prisma.staffRole.findUnique({ where: { name: roleName } }),
    ]);
    if (!staff) throw new NotFoundException('Staff not found');
    if (!role) throw new BadRequestException(`Unknown role "${roleName}"`);
    const updated = await this.prisma.staff.update({ where: { id }, data: { roleName } });
    const { passwordHash: _passwordHash, ...rest } = updated;
    return rest;
  }

  /** Restricts which Lead pipelines (organizer/venue/promoter/lineup) this
   * person can see/work — see Staff.leadRoleScope. Enforced in
   * LeadsService, not just used to drive the UI. Empty array = unrestricted,
   * same semantics as an unset scope. */
  async setLeadRoleScope(id: string, roles: string[]) {
    const staff = await this.prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new NotFoundException('Staff not found');
    const valid = ['organizer', 'venue', 'promoter', 'lineup'];
    const clean = [...new Set(roles)].filter((r) => valid.includes(r));
    const updated = await this.prisma.staff.update({ where: { id }, data: { leadRoleScope: clean } });
    const { passwordHash: _passwordHash, ...rest } = updated;
    return rest;
  }

  async removeStaff(id: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new NotFoundException('Staff not found');
    if (staff.roleName === 'Owner') {
      const ownerCount = await this.prisma.staff.count({ where: { roleName: 'Owner' } });
      if (ownerCount <= 1) throw new BadRequestException("Can't remove the last Owner");
    }
    await this.prisma.staff.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- roles ----------
  /** Returns each role's fully-resolved permission matrix (every current
   * PERM_MODULES entry present, defaultOpen fallback applied) — not the
   * raw stored JSON — so the role editor's checkboxes always show what a
   * member of that role can actually do right now, including modules
   * added after this role's row was last saved. */
  async listRoles() {
    const rows = await this.prisma.staffRole.findMany();
    return Object.fromEntries(rows.map((r) => [r.name, { permissions: resolvePermissions(r), defaultOpen: r.defaultOpen }]));
  }

  async addRole(name: string, defaultOpen = false) {
    if (!name?.trim()) throw new BadRequestException('name is required');
    if (await this.prisma.staffRole.findUnique({ where: { name } })) throw new BadRequestException(`Role "${name}" already exists`);
    const permissions = Object.fromEntries(PERM_MODULES.map((m) => [m, { view: true, edit: false, approve: false }]));
    return this.prisma.staffRole.create({ data: { name, permissions, defaultOpen } });
  }

  async setRolePerm(name: string, module: string, key: 'view' | 'edit' | 'approve', value: boolean) {
    const role = await this.prisma.staffRole.findUnique({ where: { name } });
    if (!role) throw new NotFoundException('Role not found');
    const permissions = role.permissions as Record<string, { view: boolean; edit: boolean; approve: boolean }>;
    permissions[module] = { ...(permissions[module] ?? { view: false, edit: false, approve: false }), [key]: value };
    return this.prisma.staffRole.update({ where: { name }, data: { permissions } });
  }

  /** Whether this role should automatically get access to admin features
   * added *after* it was created — see StaffRole.defaultOpen in
   * schema.prisma. Owner can flip this for any role at any time, including
   * ones they create going forward, instead of a module silently missing
   * from every existing role until someone remembers to backfill it. */
  async setRoleDefaultOpen(name: string, defaultOpen: boolean) {
    if (name === 'Owner') throw new BadRequestException('Owner always has full access — nothing to change');
    const role = await this.prisma.staffRole.findUnique({ where: { name } });
    if (!role) throw new NotFoundException('Role not found');
    return this.prisma.staffRole.update({ where: { name }, data: { defaultOpen } });
  }

  async removeRole(name: string) {
    if (name === 'Owner') throw new BadRequestException("The Owner role can't be removed");
    const inUse = await this.prisma.staff.count({ where: { roleName: name } });
    if (inUse > 0) throw new BadRequestException(`Reassign members using "${name}" first`);
    const role = await this.prisma.staffRole.findUnique({ where: { name } });
    if (!role) throw new NotFoundException('Role not found');
    await this.prisma.staffRole.delete({ where: { name } });
    return { ok: true };
  }
}
