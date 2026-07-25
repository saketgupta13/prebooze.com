import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { SubTierRole } from '@prisma/client';
import { PrismaService } from '../prisma.service';

const ROLES: SubTierRole[] = ['organizer', 'promoter', 'venue', 'lineup'];
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'tier';

/** Originally promoter-only ("promoter-tiers"); generalized when real
 * Razorpay Subscription billing landed for organizer/venue/lineup too —
 * those three start with zero seeded tiers (no invented pricing), so unlike
 * promoter, admin needs a real `create` here, not just `update`. */
@Injectable()
export class SubTiersService {
  constructor(private prisma: PrismaService) {}

  async list(role?: SubTierRole) {
    return this.prisma.subTier.findMany({ where: role ? { role } : undefined, orderBy: [{ role: 'asc' }, { price: 'asc' }] });
  }

  async create(body: { role?: string; name?: string; price?: number; guests?: number }) {
    if (!body.role || !ROLES.includes(body.role as SubTierRole)) throw new BadRequestException(`role must be one of ${ROLES.join(', ')}`);
    if (!body.name?.trim()) throw new BadRequestException('name is required');
    if (typeof body.price !== 'number' || body.price < 0) throw new BadRequestException('price must be a non-negative number');

    const base = `${body.role}-${slugify(body.name)}`;
    let id = base;
    let n = 1;
    while (await this.prisma.subTier.findUnique({ where: { id } })) id = `${base}-${++n}`;

    return this.prisma.subTier.create({
      data: {
        id,
        role: body.role as SubTierRole,
        name: body.name.trim(),
        price: body.price,
        guests: body.role === 'promoter' ? (body.guests ?? 0) : undefined,
      },
    });
  }

  async update(id: string, body: { name?: string; price?: number; guests?: number }) {
    const tier = await this.prisma.subTier.findUnique({ where: { id } });
    if (!tier) throw new NotFoundException('Subscription tier not found');
    return this.prisma.subTier.update({ where: { id }, data: body });
  }

  async remove(id: string) {
    const tier = await this.prisma.subTier.findUnique({ where: { id } });
    if (!tier) throw new NotFoundException('Subscription tier not found');
    const inUse = await this.prisma.roleSubscription.findFirst({ where: { tierId: id, status: { notIn: ['cancelled', 'expired'] } } });
    if (inUse) throw new BadRequestException('Cannot delete a tier with active subscribers — cancel or migrate them first');
    await this.prisma.subTier.delete({ where: { id } });
    return { ok: true };
  }
}
