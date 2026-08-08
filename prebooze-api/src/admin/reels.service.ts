import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ReelsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.reel.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(body: { title?: string; videoUrl?: string; posterUrl?: string }) {
    let h = 0;
    const seed = body.title ?? String(Date.now());
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360;
    return this.prisma.reel.create({
      data: { title: body.title?.trim() || 'Untitled reel', hue: h, videoUrl: body.videoUrl, posterUrl: body.posterUrl, active: true },
    });
  }

  async toggle(id: string) {
    const reel = await this.prisma.reel.findUnique({ where: { id } });
    if (!reel) throw new NotFoundException('Reel not found');
    return this.prisma.reel.update({ where: { id }, data: { active: !reel.active } });
  }

  async remove(id: string) {
    if (!(await this.prisma.reel.findUnique({ where: { id } }))) throw new NotFoundException('Reel not found');
    await this.prisma.reel.delete({ where: { id } });
    return { ok: true };
  }
}
