import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Staff, StaffRole } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { verifyPassword } from './password.util';

type StaffWithRole = Staff & { role: StaffRole };

@Injectable()
export class StaffAuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  /** Deliberately ignores which login tab (admin/staff) the frontend
   * submitted — that's cosmetic copy on prebooze-admin's Login.tsx, not real
   * access control (see BACKEND.md "Admin API"). Real permissions come from
   * the staff's assigned roleName, resolved here from email+password alone. */
  async login(email: string, password: string) {
    const staff = await this.prisma.staff.findUnique({ where: { email: email.toLowerCase().trim() }, include: { role: true } });
    if (!staff || !verifyPassword(password, staff.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.prisma.staff.update({ where: { id: staff.id }, data: { lastActiveAt: new Date() } });
    const token = await this.jwt.signAsync({ staffId: staff.id, roleName: staff.roleName, email: staff.email }, { expiresIn: '12h' });
    return { token, staff: this.toApiStaff(staff) };
  }

  async me(staffId: string) {
    const staff = await this.prisma.staff.findUniqueOrThrow({ where: { id: staffId }, include: { role: true } });
    return this.toApiStaff(staff);
  }

  private toApiStaff(staff: StaffWithRole) {
    return {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      roleName: staff.roleName,
      permissions: staff.role.permissions,
      city: staff.city ?? undefined,
      lastActiveAt: staff.lastActiveAt ?? undefined,
    };
  }
}
