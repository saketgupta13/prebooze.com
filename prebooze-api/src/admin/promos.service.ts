import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/** prebooze-admin's "Promo codes" page turned out to be the same underlying
 * concept as a platform-wide Coupon (organizerId null) — not a separate
 * system — with a gender-audience field added. Scoped to organizerId: null
 * throughout so this never touches or lists an organizer's own coupons. */
@Injectable()
export class PromosService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.coupon.findMany({ where: { organizerId: null }, orderBy: { validTill: 'desc' } });
  }

  async create(body: { code?: string; type?: 'percent' | 'flat'; value?: number; maxDiscount?: number; usageLimit?: number; perUserLimit?: number; eventScope?: string; validTill?: string; firstTimeOnly?: boolean; gender?: string; description?: string }) {
    if (!body.code?.trim()) throw new BadRequestException('code is required');
    const code = body.code.trim().toUpperCase();
    if (await this.prisma.coupon.findUnique({ where: { code } })) throw new BadRequestException(`${code} already exists`);
    if (body.type !== 'percent' && body.type !== 'flat') throw new BadRequestException('type must be "percent" or "flat"');
    const value = body.value ?? 10;
    if (body.type === 'percent' && value > 100) throw new BadRequestException('Percentage discount cannot exceed 100%');

    return this.prisma.coupon.create({
      data: {
        code,
        type: body.type,
        value,
        maxDiscount: body.maxDiscount,
        usageLimit: body.usageLimit ?? 1000,
        perUserLimit: body.perUserLimit ?? 1,
        eventScope: body.eventScope ?? 'all',
        validTill: body.validTill ? new Date(body.validTill) : new Date(Date.now() + 30 * 86400000),
        firstTimeOnly: body.firstTimeOnly ?? false,
        gender: body.gender ?? 'all',
        description: body.description?.trim() || undefined,
        organizerId: null,
      },
    });
  }

  async update(code: string, body: { value?: number; maxDiscount?: number; usageLimit?: number; perUserLimit?: number; eventScope?: string; validTill?: string; firstTimeOnly?: boolean; gender?: string; status?: 'active' | 'paused'; description?: string }) {
    const promo = await this.prisma.coupon.findFirst({ where: { code: code.toUpperCase(), organizerId: null } });
    if (!promo) throw new NotFoundException('Promo not found');
    const { validTill, ...rest } = body;
    return this.prisma.coupon.update({
      where: { id: promo.id },
      data: { ...rest, ...(validTill ? { validTill: new Date(validTill) } : {}) },
    });
  }

  async remove(code: string) {
    const promo = await this.prisma.coupon.findFirst({ where: { code: code.toUpperCase(), organizerId: null } });
    if (!promo) throw new NotFoundException('Promo not found');
    await this.prisma.coupon.delete({ where: { id: promo.id } });
    return { ok: true };
  }
}
