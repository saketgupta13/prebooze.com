import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.eventCategory.findMany({ orderBy: { name: 'asc' } });
  }

  async add(name: string, icon?: string) {
    if (!name?.trim()) throw new BadRequestException('name is required');
    const existing = await this.prisma.eventCategory.findUnique({ where: { name: name.trim() } });
    if (existing) return existing;
    return this.prisma.eventCategory.create({ data: { name: name.trim(), icon: icon || '🏷' } });
  }

  async update(name: string, body: { icon?: string; imageUrl?: string; seo?: Record<string, string> }) {
    const cat = await this.prisma.eventCategory.findUnique({ where: { name } });
    if (!cat) throw new NotFoundException('Category not found');
    return this.prisma.eventCategory.update({ where: { name }, data: body });
  }

  async remove(name: string) {
    const cat = await this.prisma.eventCategory.findUnique({ where: { name } });
    if (!cat) throw new NotFoundException('Category not found');
    await this.prisma.eventCategory.delete({ where: { name } });
    return { ok: true };
  }
}
