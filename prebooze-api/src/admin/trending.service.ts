import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TrendingService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.trendingSearch.findMany({ orderBy: { sort: 'asc' } });
  }

  async add(term: string) {
    const t = term?.trim();
    if (!t) throw new BadRequestException('term is required');
    const existing = await this.prisma.trendingSearch.findUnique({ where: { term: t } });
    if (existing) return existing;
    const count = await this.prisma.trendingSearch.count();
    return this.prisma.trendingSearch.create({ data: { term: t, sort: count } });
  }

  async reorder(term: string, sort: number) {
    const row = await this.prisma.trendingSearch.findUnique({ where: { term } });
    if (!row) throw new NotFoundException('Trending term not found');
    return this.prisma.trendingSearch.update({ where: { term }, data: { sort } });
  }

  async remove(term: string) {
    const row = await this.prisma.trendingSearch.findUnique({ where: { term } });
    if (!row) throw new NotFoundException('Trending term not found');
    await this.prisma.trendingSearch.delete({ where: { term } });
    return { ok: true };
  }
}
