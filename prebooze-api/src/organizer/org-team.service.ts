import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { normalizePhone } from '../auth/auth.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { OrgAccessService } from './org-access.service';

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
  constructor(
    private prisma: PrismaService,
    private orgAccess: OrgAccessService,
    private wa: WhatsappService,
    private email: EmailService,
  ) {}

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
    const org = await this.orgAccess.require(userId, 'Settings & team', 'view');
    await this.ensureSeeded(org.id);
    const rows = await this.prisma.orgRole.findMany({ where: { organizerId: org.id } });
    return Object.fromEntries(rows.map((r) => [r.name, r.permissions]));
  }

  async addRole(userId: string, name: string) {
    const org = await this.orgAccess.require(userId, 'Settings & team', 'edit');
    await this.ensureSeeded(org.id);
    if (!name?.trim()) throw new BadRequestException('name is required');
    if (name.trim() === 'Owner') throw new BadRequestException('"Owner" is reserved');
    if (await this.prisma.orgRole.findUnique({ where: { organizerId_name: { organizerId: org.id, name } } })) {
      throw new BadRequestException(`Role "${name}" already exists`);
    }
    const permissions = Object.fromEntries(ORG_PERM_MODULES.map((m) => [m, perms(true, false)]));
    return this.prisma.orgRole.create({ data: { organizerId: org.id, name, permissions } });
  }

  async setRolePerm(userId: string, roleName: string, module: string, key: 'view' | 'edit', value: boolean) {
    const org = await this.orgAccess.require(userId, 'Settings & team', 'edit');
    if (roleName === 'Owner') throw new BadRequestException('Owner always has full access');
    const role = await this.prisma.orgRole.findUnique({ where: { organizerId_name: { organizerId: org.id, name: roleName } } });
    if (!role) throw new NotFoundException('Role not found');
    const permissions = role.permissions as unknown as PermMatrix;
    permissions[module] = { ...(permissions[module] ?? { view: false, edit: false }), [key]: value };
    return this.prisma.orgRole.update({ where: { id: role.id }, data: { permissions } });
  }

  async removeRole(userId: string, roleName: string) {
    const org = await this.orgAccess.require(userId, 'Settings & team', 'edit');
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
    const org = await this.orgAccess.require(userId, 'Settings & team', 'view');
    return this.prisma.orgStaff.findMany({ where: { organizerId: org.id }, orderBy: { createdAt: 'asc' } });
  }

  /** Real invite — not a decorative name label. Requires a real phone
   * number (that's the login identity: team members sign in through the
   * exact same OTP flow as every other user, see AuthService.verifyOtp for
   * the lazy userId link-up), immediately links to an existing User if one
   * already exists for that phone, and sends a real notification on
   * WhatsApp and/or email so the invitee actually knows to log in. Email is
   * the one guaranteed-delivered channel today (Resend is live) — the
   * WhatsApp side uses a new 'org_team_invite' campaign that still needs to
   * be submitted/approved on AiSensy (same one-time step every other real
   * campaign in this codebase went through, see WhatsappService), so treat
   * it as best-effort until that's done; the .catch(() => {}) below means a
   * missing template degrades silently rather than blocking the invite. */
  async addStaff(userId: string, body: { name?: string; phone?: string; email?: string; roleName?: string; scan?: boolean }) {
    const org = await this.orgAccess.require(userId, 'Settings & team', 'edit');
    if (!body.name?.trim()) throw new BadRequestException('Name is required');
    if (!body.phone?.trim()) throw new BadRequestException('A phone number is required — that\'s how they log in');
    const phone = normalizePhone(body.phone);
    const roleName = body.roleName?.trim() || 'Door staff';
    if (roleName === 'Owner') throw new BadRequestException("Can't invite someone as Owner");

    await this.ensureSeeded(org.id);
    const role = await this.prisma.orgRole.findUnique({ where: { organizerId_name: { organizerId: org.id, name: roleName } } });
    if (!role) throw new BadRequestException(`Unknown role "${roleName}"`);

    if (await this.prisma.orgStaff.findUnique({ where: { organizerId_phone: { organizerId: org.id, phone } } })) {
      throw new BadRequestException('This phone number is already on your team');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { phone } });
    const staff = await this.prisma.orgStaff.create({
      data: { organizerId: org.id, name: body.name.trim(), phone, roleName, scan: body.scan ?? false, userId: existingUser?.id },
    });

    const loginUrl = `${process.env.WEB_APP_URL ?? ''}/login`;
    await this.wa.send(phone, 'org_team_invite', [body.name.trim(), org.brandName, roleName]).catch(() => {});
    const inviteEmail = body.email?.trim() || existingUser?.email || undefined;
    await this.email
      .sendTemplate(inviteEmail, 'org_team_invite', { name: body.name.trim(), orgBrand: org.brandName, roleName, phone })
      .catch(() => {});

    return staff;
  }

  async updateStaffRole(userId: string, staffId: string, roleName: string) {
    const org = await this.orgAccess.require(userId, 'Settings & team', 'edit');
    const member = await this.prisma.orgStaff.findUnique({ where: { id: staffId } });
    if (!member || member.organizerId !== org.id) throw new NotFoundException('Team member not found');
    if (member.roleName === 'Owner') throw new BadRequestException("Can't change the Owner's role");
    if (roleName === 'Owner') throw new BadRequestException("Can't promote someone to Owner");
    const role = await this.prisma.orgRole.findUnique({ where: { organizerId_name: { organizerId: org.id, name: roleName } } });
    if (!role) throw new BadRequestException(`Unknown role "${roleName}"`);
    return this.prisma.orgStaff.update({ where: { id: staffId }, data: { roleName } });
  }

  async removeStaff(userId: string, staffId: string) {
    const org = await this.orgAccess.require(userId, 'Settings & team', 'edit');
    const member = await this.prisma.orgStaff.findUnique({ where: { id: staffId } });
    if (!member || member.organizerId !== org.id) throw new NotFoundException('Team member not found');
    if (member.roleName === 'Owner') throw new BadRequestException("Can't remove the Owner");
    await this.prisma.orgStaff.delete({ where: { id: staffId } });
    return { ok: true };
  }

  /** What the logged-in user's own organizer-team console access looks like
   * — null if they're not staff anywhere (or if they ARE the real owner,
   * who uses the normal /organizer/me path instead, not this). Bootstraps
   * the frontend's "am I on someone's team" check after login, same idea as
   * AppContext's mySocialState() bootstrap. */
  async mine(userId: string) {
    const staff = await this.prisma.orgStaff.findFirst({ where: { userId }, include: { organizer: true } });
    if (!staff) return null;
    const role = await this.prisma.orgRole.findUnique({ where: { organizerId_name: { organizerId: staff.organizerId, name: staff.roleName } } });
    return {
      organizerId: staff.organizerId,
      organizerBrand: staff.organizer.brandName,
      organizerLogoUrl: staff.organizer.logoUrl,
      roleName: staff.roleName,
      permissions: (role?.permissions as PermMatrix | undefined) ?? {},
      scan: staff.scan,
    };
  }
}
