import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class VenueTypesService {
  constructor(private prisma: PrismaService) {}

  /** Same real per-type event count as the public CatalogService.venueTypes()
   * — duplicated rather than shared since this list also needs every admin-
   * only column (not just name/icon/events) for the edit UI. */
  async list() {
    const types = await this.prisma.venueType.findMany({ orderBy: { sort: 'asc' } });
    const events = await this.prisma.event.findMany({
      where: { status: 'approved' },
      select: { venue: { select: { type: true } } },
    });
    const counts = new Map<string, number>();
    for (const e of events) {
      const tags = (e.venue?.type ?? '').split(',').map((t) => t.trim()).filter(Boolean);
      for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return types.map((t) => ({ ...t, events: counts.get(t.name) ?? 0 }));
  }

  async add(name: string, icon?: string) {
    const n = name?.trim();
    if (!n) throw new BadRequestException('name is required');
    const existing = await this.prisma.venueType.findUnique({ where: { name: n } });
    if (existing) return existing;
    const count = await this.prisma.venueType.count();
    return this.prisma.venueType.create({ data: { name: n, icon: icon || null, sort: count } });
  }

  async update(name: string, body: { icon?: string; sort?: number }) {
    const row = await this.prisma.venueType.findUnique({ where: { name } });
    if (!row) throw new NotFoundException('Venue type not found');
    return this.prisma.venueType.update({ where: { name }, data: body });
  }

  async remove(name: string) {
    const row = await this.prisma.venueType.findUnique({ where: { name } });
    if (!row) throw new NotFoundException('Venue type not found');
    await this.prisma.venueType.delete({ where: { name } });
    return { ok: true };
  }
}
