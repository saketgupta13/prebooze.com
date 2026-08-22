import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { normalizePhone } from '../auth/auth.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { VenueAccessService } from './venue-access.service';

export const VENUE_ORG_PERM_MODULES = [
  'Events & wizard',
  'Attendees & check-in',
  'Guest list',
  'Coupons',
  'Payouts & withdrawals',
  'Settings & team',
] as const;

type PermSet = { view: boolean; edit: boolean };
type PermMatrix = Record<string, PermSet>;

const perms = (view: boolean, edit: boolean): PermSet => ({ view, edit });

/** Seeded the first time a venue's Organizer panel ever looks at Team &
 * roles — same idea as OrgTeamService's DEFAULT_ROLES, minus a "Promoter"
 * role (that name would collide with the unrelated Promoters-payout page
 * here, so just Owner/Manager/Door staff). */
const DEFAULT_VENUE_ROLES: Record<string, PermMatrix> = {
  Owner: Object.fromEntries(VENUE_ORG_PERM_MODULES.map((m) => [m, perms(true, true)])),
  Manager: {
    'Events & wizard': perms(true, true),
    'Attendees & check-in': perms(true, true),
    'Guest list': perms(true, true),
    Coupons: perms(true, true),
    'Payouts & withdrawals': perms(true, false),
    'Settings & team': perms(true, false),
  },
  'Door staff': {
    'Events & wizard': perms(false, false),
    'Attendees & check-in': perms(true, true),
    'Guest list': perms(true, true),
    Coupons: perms(false, false),
    'Payouts & withdrawals': perms(false, false),
    'Settings & team': perms(false, false),
  },
};

/** Venue's own equivalent of OrgTeamService — real invite-to-login staff +
 * role management for the Organizer panel, scoped by venueId instead of
 * organizerId. Mirrors that service's shape exactly. */
@Injectable()
export class VenueTeamService {
  constructor(
    private prisma: PrismaService,
    private venueAccess: VenueAccessService,
    private wa: WhatsappService,
    private email: EmailService,
  ) {}

  private async ensureSeeded(venueId: string) {
    const count = await this.prisma.venueRole.count({ where: { venueId } });
    if (count > 0) return;
    await this.prisma.venueRole.createMany({
      data: Object.entries(DEFAULT_VENUE_ROLES).map(([name, permissions]) => ({ venueId, name, permissions })),
    });
  }

  // ---------- roles ----------
  async listRoles(userId: string) {
    const venue = await this.venueAccess.require(userId, 'Settings & team', 'view');
    await this.ensureSeeded(venue.id);
    const rows = await this.prisma.venueRole.findMany({ where: { venueId: venue.id } });
    return Object.fromEntries(rows.map((r) => [r.name, r.permissions]));
  }

  async addRole(userId: string, name: string) {
    const venue = await this.venueAccess.require(userId, 'Settings & team', 'edit');
    await this.ensureSeeded(venue.id);
    if (!name?.trim()) throw new BadRequestException('name is required');
    if (name.trim() === 'Owner') throw new BadRequestException('"Owner" is reserved');
    if (await this.prisma.venueRole.findUnique({ where: { venueId_name: { venueId: venue.id, name } } })) {
      throw new BadRequestException(`Role "${name}" already exists`);
    }
    const permissions = Object.fromEntries(VENUE_ORG_PERM_MODULES.map((m) => [m, perms(true, false)]));
    return this.prisma.venueRole.create({ data: { venueId: venue.id, name, permissions } });
  }

  async setRolePerm(userId: string, roleName: string, module: string, key: 'view' | 'edit', value: boolean) {
    const venue = await this.venueAccess.require(userId, 'Settings & team', 'edit');
    if (roleName === 'Owner') throw new BadRequestException('Owner always has full access');
    const role = await this.prisma.venueRole.findUnique({ where: { venueId_name: { venueId: venue.id, name: roleName } } });
    if (!role) throw new NotFoundException('Role not found');
    const permissions = role.permissions as unknown as PermMatrix;
    permissions[module] = { ...(permissions[module] ?? { view: false, edit: false }), [key]: value };
    return this.prisma.venueRole.update({ where: { id: role.id }, data: { permissions } });
  }

  async removeRole(userId: string, roleName: string) {
    const venue = await this.venueAccess.require(userId, 'Settings & team', 'edit');
    if (roleName === 'Owner') throw new BadRequestException("The Owner role can't be removed");
    const inUse = await this.prisma.venueStaff.count({ where: { venueId: venue.id, roleName } });
    if (inUse > 0) throw new BadRequestException(`Reassign members using "${roleName}" first`);
    const role = await this.prisma.venueRole.findUnique({ where: { venueId_name: { venueId: venue.id, name: roleName } } });
    if (!role) throw new NotFoundException('Role not found');
    await this.prisma.venueRole.delete({ where: { id: role.id } });
    return { ok: true };
  }

  // ---------- staff ----------
  async listStaff(userId: string) {
    const venue = await this.venueAccess.require(userId, 'Settings & team', 'view');
    return this.prisma.venueStaff.findMany({ where: { venueId: venue.id }, orderBy: { createdAt: 'asc' } });
  }

  /** Real invite — same real-login-path semantics as OrgTeamService.addStaff:
   * phone is the login identity, immediately links to an existing User if
   * one exists, otherwise lazily backfilled on the invitee's next OTP login
   * (see AuthService.verifyOtp). The 'venue_team_invite' WhatsApp campaign
   * needs the same one-time AiSensy approval every other real campaign in
   * this codebase went through — treat as best-effort until then. */
  async addStaff(userId: string, body: { name?: string; phone?: string; email?: string; roleName?: string; scan?: boolean }) {
    const venue = await this.venueAccess.require(userId, 'Settings & team', 'edit');
    if (!body.name?.trim()) throw new BadRequestException('Name is required');
    if (!body.phone?.trim()) throw new BadRequestException('A phone number is required — that\'s how they log in');
    const phone = normalizePhone(body.phone);
    const roleName = body.roleName?.trim() || 'Door staff';
    if (roleName === 'Owner') throw new BadRequestException("Can't invite someone as Owner");

    await this.ensureSeeded(venue.id);
    const role = await this.prisma.venueRole.findUnique({ where: { venueId_name: { venueId: venue.id, name: roleName } } });
    if (!role) throw new BadRequestException(`Unknown role "${roleName}"`);

    if (await this.prisma.venueStaff.findUnique({ where: { venueId_phone: { venueId: venue.id, phone } } })) {
      throw new BadRequestException('This phone number is already on your team');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { phone } });
    const staff = await this.prisma.venueStaff.create({
      data: { venueId: venue.id, name: body.name.trim(), phone, roleName, scan: body.scan ?? false, userId: existingUser?.id },
    });

    await this.wa.send(phone, 'venue_team_invite', [body.name.trim(), venue.name, roleName]).catch(() => {});
    const inviteEmail = body.email?.trim() || existingUser?.email || undefined;
    await this.email
      .sendTemplate(inviteEmail, 'venue_team_invite', { name: body.name.trim(), venueBrand: venue.name, roleName, phone })
      .catch(() => {});

    return staff;
  }

  async updateStaffRole(userId: string, staffId: string, roleName: string) {
    const venue = await this.venueAccess.require(userId, 'Settings & team', 'edit');
    const member = await this.prisma.venueStaff.findUnique({ where: { id: staffId } });
    if (!member || member.venueId !== venue.id) throw new NotFoundException('Team member not found');
    if (member.roleName === 'Owner') throw new BadRequestException("Can't change the Owner's role");
    if (roleName === 'Owner') throw new BadRequestException("Can't promote someone to Owner");
    const role = await this.prisma.venueRole.findUnique({ where: { venueId_name: { venueId: venue.id, name: roleName } } });
    if (!role) throw new BadRequestException(`Unknown role "${roleName}"`);
    return this.prisma.venueStaff.update({ where: { id: staffId }, data: { roleName } });
  }

  async removeStaff(userId: string, staffId: string) {
    const venue = await this.venueAccess.require(userId, 'Settings & team', 'edit');
    const member = await this.prisma.venueStaff.findUnique({ where: { id: staffId } });
    if (!member || member.venueId !== venue.id) throw new NotFoundException('Team member not found');
    if (member.roleName === 'Owner') throw new BadRequestException("Can't remove the Owner");
    await this.prisma.venueStaff.delete({ where: { id: staffId } });
    return { ok: true };
  }

  /** "Am I on some venue's hosting team?" — null if not (or if the caller
   * IS the real venue owner, who uses the normal venue/hosting/* path
   * instead). Bootstraps the frontend's team-access check after login, same
   * as OrgTeamService.mine. */
  async mine(userId: string) {
    const staff = await this.prisma.venueStaff.findFirst({ where: { userId }, include: { venue: true } });
    if (!staff) return null;
    const role = await this.prisma.venueRole.findUnique({ where: { venueId_name: { venueId: staff.venueId, name: staff.roleName } } });
    return {
      venueId: staff.venueId,
      venueBrand: staff.venue.name,
      venueLogoUrl: staff.venue.logoUrl,
      roleName: staff.roleName,
      permissions: (role?.permissions as PermMatrix | undefined) ?? {},
      scan: staff.scan,
    };
  }
}
