import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SubTiersService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.subTier.findMany({ orderBy: { price: 'asc' } });
  }

  async update(id: string, body: { name?: string; price?: number; guests?: number }) {
    const tier = await this.prisma.subTier.findUnique({ where: { id } });
    if (!tier) throw new NotFoundException('Subscription tier not found');
    return this.prisma.subTier.update({ where: { id }, data: body });
  }
}
