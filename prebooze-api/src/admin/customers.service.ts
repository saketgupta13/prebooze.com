import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { normalizePhone } from '../auth/auth.service';
import { referralCodeFor } from '../referrals/referral.constants';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  /** "organizers" segment (mirroring prebooze-admin's Customer.segment) means
   * any elevated role, not literally just organizers — the mock's directory
   * lumps every business account together as one non-"guests" bucket.
   * `role` only flips from null on APPROVAL though — a pending or rejected
   * role application must still count as non-guest here, otherwise every
   * organizer/venue applicant sits in the Customers list looking like a
   * regular guest (with a blank name, since they never went through guest
   * profile completion) until someone gets around to reviewing them. */
  async list(segment?: 'guests' | 'organizers') {
    const isGuest = { role: null, roleStatus: null } as const;
    const where = segment === 'guests' ? isGuest : segment === 'organizers' ? { NOT: isGuest } : {};
    const users = await this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });
    if (!users.length) return [];

    const stats = await this.prisma.booking.groupBy({
      by: ['userId'],
      where: { userId: { in: users.map((u) => u.id) }, status: { not: 'cancelled' } },
      _count: { id: true },
      _sum: { total: true },
    });
    const statsByUser = new Map(stats.map((s) => [s.userId, s]));

    return users.map((u) => {
      const s = statsByUser.get(u.id);
      return {
        id: u.id,
        name: u.name || 'Guest',
        phone: u.phone,
        email: u.email || undefined,
        city: u.city,
        gender: u.gender,
        verified: u.idVerified,
        bookings: s?._count.id ?? 0,
        spend: s?._sum.total ?? 0,
        status: u.blocked ? 'blocked' : u.idVerified ? 'active' : 'unverified',
        segment: u.role || u.roleStatus ? 'organizers' : 'guests',
      };
    });
  }

  /** Manual onboarding — walk-ups, phone bookings, VIP guests added by
   * staff, no OTP round trip. Marks phoneVerified since staff is vouching
   * for the number directly (mirrors the mock's "becomes their WhatsApp
   * login" framing). If the phone already has an account, that account is
   * returned/updated rather than erroring — a staffer re-adding someone by
   * phone shouldn't create a duplicate. */
  async create(body: { name?: string; phone?: string; email?: string; city?: string; gender?: string; verified?: boolean }) {
    if (!body.name?.trim()) throw new BadRequestException('Customer name is required');
    if (!body.phone?.trim()) throw new BadRequestException('Phone number is required — it becomes their WhatsApp login');
    const phone = normalizePhone(body.phone);

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    const data = {
      name: body.name.trim(),
      email: body.email?.trim() ?? '',
      city: body.city?.trim() ?? '',
      gender: body.gender?.trim() ?? '',
      idVerified: body.verified ?? false,
      phoneVerified: true,
    };
    const user = existing
      ? await this.prisma.user.update({ where: { id: existing.id }, data })
      : await this.prisma.user.create({ data: { phone, referralCode: referralCodeFor(phone), ...data } });
    return user;
  }

  async setBlocked(id: string, blocked: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Customer not found');
    if (typeof blocked !== 'boolean') throw new BadRequestException('blocked must be a boolean');
    await this.prisma.user.update({ where: { id }, data: { blocked } });
    return { ok: true };
  }
}
