import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ReelsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.reel.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(body: { title?: string; videoUrl?: string; posterUrl?: string; city?: string; ctaLink?: string }) {
    let h = 0;
    const seed = body.title ?? String(Date.now());
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360;
    return this.prisma.reel.create({
      data: {
        title: body.title?.trim() || 'Untitled reel', hue: h, videoUrl: body.videoUrl, posterUrl: body.posterUrl, active: true,
        city: body.city?.trim() || undefined, ctaLink: body.ctaLink?.trim() || undefined,
      },
    });
  }

  /** Admin-editable after the fact (2026-10-25) — create() alone left no
   * way to fix a typo'd city/booking link, or swap the video, once a reel
   * existed; this is the generic "change anything about it" counterpart,
   * same shape as CmsService's Banner update. */
  async update(id: string, patch: { title?: string; videoUrl?: string; posterUrl?: string; city?: string | null; ctaLink?: string | null }) {
    if (!(await this.prisma.reel.findUnique({ where: { id } }))) throw new NotFoundException('Reel not found');
    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) data.title = patch.title.trim();
    if (patch.videoUrl !== undefined) data.videoUrl = patch.videoUrl;
    if (patch.posterUrl !== undefined) data.posterUrl = patch.posterUrl;
    if (patch.city !== undefined) data.city = patch.city?.trim() || null;
    if (patch.ctaLink !== undefined) data.ctaLink = patch.ctaLink?.trim() || null;
    return this.prisma.reel.update({ where: { id }, data });
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
