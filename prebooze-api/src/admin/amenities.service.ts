import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AmenitiesService {
  constructor(private prisma: PrismaService) {}

  /** Real per-amenity "used by N venues" count — Venue.amenities is a real
   * String[] column (not free-text like Venue.type), so this just tallies
   * membership directly instead of splitting/parsing a joined string. */
  async list() {
    const amenities = await this.prisma.amenity.findMany({ orderBy: { sort: 'asc' } });
    const venues = await this.prisma.venue.findMany({ select: { amenities: true } });
    const counts = new Map<string, number>();
    for (const v of venues) for (const a of v.amenities) counts.set(a, (counts.get(a) ?? 0) + 1);
    return amenities.map((a) => ({ ...a, venues: counts.get(a.name) ?? 0 }));
  }

  async add(name: string, icon?: string) {
    const n = name?.trim();
    if (!n) throw new BadRequestException('name is required');
    const existing = await this.prisma.amenity.findUnique({ where: { name: n } });
    if (existing) return existing;
    const count = await this.prisma.amenity.count();
    return this.prisma.amenity.create({ data: { name: n, icon: icon || null, sort: count } });
  }

  async update(name: string, body: { icon?: string; sort?: number }) {
    const row = await this.prisma.amenity.findUnique({ where: { name } });
    if (!row) throw new NotFoundException('Amenity not found');
    return this.prisma.amenity.update({ where: { name }, data: body });
  }

  async remove(name: string) {
    const row = await this.prisma.amenity.findUnique({ where: { name } });
    if (!row) throw new NotFoundException('Amenity not found');
    await this.prisma.amenity.delete({ where: { name } });
    return { ok: true };
  }
}
