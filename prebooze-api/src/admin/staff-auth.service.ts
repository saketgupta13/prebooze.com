import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import type Redis from 'ioredis';
import type { Staff, StaffRole } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { REDIS } from '../redis.provider';
import { EmailService } from '../notifications/email';
import { hashPassword, verifyPassword } from './password.util';

type StaffWithRole = Staff & { role: StaffRole };
const TWOFA_TTL_S = 300; // 5 minutes, same window as guest OTP

@Injectable()
export class StaffAuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private email: EmailService,
    @Inject(REDIS) private redis: Redis,
  ) {}

  /** Deliberately ignores which login tab (admin/staff) the frontend
   * submitted — that's cosmetic copy on prebooze-admin's Login.tsx, not real
   * access control (see BACKEND.md "Admin API"). Real permissions come from
   * the staff's assigned roleName, resolved here from email+password alone.
   *
   * When Settings → "Require 2FA for team sign-in" is on, correct
   * credentials alone no longer issue a token — a 6-digit code is emailed
   * and `{ requires2fa: true, staffId }` comes back instead; the frontend
   * must call verify2fa with that code to actually get a session. */
  async login(email: string, password: string) {
    const staff = await this.prisma.staff.findUnique({ where: { email: email.toLowerCase().trim() }, include: { role: true } });
    if (!staff || !verifyPassword(password, staff.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.prisma.staff.update({ where: { id: staff.id }, data: { lastActiveAt: new Date() } });

    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
    if (settings?.require2fa) {
      const code = String(randomInt(100000, 1000000));
      await this.redis.set(`staff-2fa:${staff.id}`, code, 'EX', TWOFA_TTL_S);
      await this.email.sendTemplate(staff.email, 'staff_2fa_code', { name: staff.name, code });
      return { requires2fa: true, staffId: staff.id, devCode: this.email.live ? undefined : code };
    }

    const token = await this.jwt.signAsync({ staffId: staff.id, roleName: staff.roleName, email: staff.email }, { expiresIn: '12h' });
    return { token, staff: this.toApiStaff(staff) };
  }

  /** Second step when 2FA is required — the only path that ever issues a
   * token in that mode. Codes are one-shot (deleted on any correct check)
   * and expire in 5 minutes, same discipline as guest OTP. */
  async verify2fa(staffId: string, code: string) {
    if (!staffId || !code) throw new BadRequestException('staffId and code are required');
    const key = `staff-2fa:${staffId}`;
    const expected = await this.redis.get(key);
    if (!expected) throw new UnauthorizedException('Code expired — sign in again');
    if (expected !== code) throw new UnauthorizedException('Incorrect code');
    await this.redis.del(key);

    const staff = await this.prisma.staff.findUniqueOrThrow({ where: { id: staffId }, include: { role: true } });
    const token = await this.jwt.signAsync({ staffId: staff.id, roleName: staff.roleName, email: staff.email }, { expiresIn: '12h' });
    return { token, staff: this.toApiStaff(staff) };
  }

  async me(staffId: string) {
    const staff = await this.prisma.staff.findUniqueOrThrow({ where: { id: staffId }, include: { role: true } });
    return this.toApiStaff(staff);
  }

  /** Self-service — a staffer editing their own name/email. Distinct from
   * AdminStaffController's Owner-only staff management (which can edit
   * anyone); this only ever touches the caller's own row. */
  async updateMe(staffId: string, body: { name?: string; email?: string }) {
    if (body.email !== undefined) {
      const email = body.email.toLowerCase().trim();
      if (!email) throw new BadRequestException('email is required');
      const clash = await this.prisma.staff.findUnique({ where: { email } });
      if (clash && clash.id !== staffId) throw new BadRequestException('This email is already in use');
    }
    const staff = await this.prisma.staff.update({
      where: { id: staffId },
      data: { name: body.name?.trim(), email: body.email?.toLowerCase().trim() },
      include: { role: true },
    });
    return this.toApiStaff(staff);
  }

  async changeMyPassword(staffId: string, currentPassword: string, newPassword: string) {
    if (!currentPassword || !newPassword) throw new BadRequestException('Fill in both password fields');
    if (newPassword.length < 8) throw new BadRequestException('New password must be at least 8 characters');
    const staff = await this.prisma.staff.findUniqueOrThrow({ where: { id: staffId } });
    if (!verifyPassword(currentPassword, staff.passwordHash)) throw new BadRequestException('Current password is incorrect');
    await this.prisma.staff.update({ where: { id: staffId }, data: { passwordHash: hashPassword(newPassword) } });
    return { ok: true };
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
