import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  /** "organizers" segment (mirroring prebooze-admin's Customer.segment) means
   * any elevated role, not literally just organizers — the mock's directory
   * lumps every business account together as one non-"guests" bucket. */
  async list(segment?: 'guests' | 'organizers') {
    const where = segment === 'guests' ? { role: null } : segment === 'organizers' ? { role: { not: null } } : {};
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
        segment: u.role ? 'organizers' : 'guests',
      };
    });
  }

  async setBlocked(id: string, blocked: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Customer not found');
    if (typeof blocked !== 'boolean') throw new BadRequestException('blocked must be a boolean');
    await this.prisma.user.update({ where: { id }, data: { blocked } });
    return { ok: true };
  }
}
