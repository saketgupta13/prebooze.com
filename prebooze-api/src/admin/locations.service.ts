import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { toCitySlug } from '../common/city-slug';

const TOP_CITY_LIMIT = 12; // matches prebooze-admin's toggleTopCity guard exactly

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  /** The full Country → State → City tree for the admin locations screen. */
  async tree() {
    return this.prisma.country.findMany({
      include: { states: { include: { cities: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async addCountry(name: string) {
    if (!name?.trim()) throw new BadRequestException('name is required');
    const existing = await this.prisma.country.findUnique({ where: { name: name.trim() } });
    if (existing) return existing;
    return this.prisma.country.create({ data: { name: name.trim() } });
  }

  async addState(countryId: string, name: string) {
    if (!name?.trim()) throw new BadRequestException('name is required');
    if (!(await this.prisma.country.findUnique({ where: { id: countryId } }))) throw new NotFoundException('Country not found');
    const existing = await this.prisma.state.findUnique({ where: { countryId_name: { countryId, name: name.trim() } } });
    if (existing) return existing;
    return this.prisma.state.create({ data: { countryId, name: name.trim() } });
  }

  /** City rows are the same global-by-name table every other model
   * references (Venue.city, User.city, ...) — if one already exists (e.g.
   * seeded by Catalog in Phase 2) this just links it into the hierarchy
   * rather than erroring or creating a duplicate. */
  async addCity(stateId: string, name: string) {
    if (!name?.trim()) throw new BadRequestException('name is required');
    if (!(await this.prisma.state.findUnique({ where: { id: stateId } }))) throw new NotFoundException('State not found');
    const cityName = name.trim();
    const existing = await this.prisma.city.findUnique({ where: { name: cityName } });
    if (existing) return this.prisma.city.update({ where: { name: cityName }, data: { stateId } });
    // City.name is the primary key with no dedicated slug/URL-safety field
    // — two differently-cased or -punctuated names (e.g. "Bengaluru" vs
    // "bengaluru") would otherwise collide on the same /city-prefixed URL
    // once city-scoped routing reads this list, silently making one of
    // them unreachable by its own slug.
    const slug = toCitySlug(cityName);
    const all = await this.prisma.city.findMany({ select: { name: true } });
    if (all.some((c) => toCitySlug(c.name) === slug)) {
      throw new BadRequestException(`A city with the same URL slug ("${slug}") already exists`);
    }
    return this.prisma.city.create({ data: { name: cityName, icon: null, stateId } });
  }

  async toggleCountry(id: string) {
    const country = await this.prisma.country.findUnique({ where: { id } });
    if (!country) throw new NotFoundException('Country not found');
    const enabled = !country.enabled;
    // toggling a country cascades to every state + city underneath it
    await this.prisma.$transaction([
      this.prisma.country.update({ where: { id }, data: { enabled } }),
      this.prisma.state.updateMany({ where: { countryId: id }, data: { enabled } }),
      this.prisma.city.updateMany({ where: { state: { countryId: id } }, data: { enabled } }),
    ]);
    return { ok: true, enabled };
  }

  async toggleState(id: string) {
    const state = await this.prisma.state.findUnique({ where: { id } });
    if (!state) throw new NotFoundException('State not found');
    const enabled = !state.enabled;
    await this.prisma.$transaction([
      this.prisma.state.update({ where: { id }, data: { enabled } }),
      this.prisma.city.updateMany({ where: { stateId: id }, data: { enabled } }),
    ]);
    return { ok: true, enabled };
  }

  async toggleCity(name: string) {
    const city = await this.prisma.city.findUnique({ where: { name } });
    if (!city) throw new NotFoundException('City not found');
    return this.prisma.city.update({ where: { name }, data: { enabled: !city.enabled } });
  }

  async updateCity(name: string, patch: { icon?: string; top?: boolean }) {
    const city = await this.prisma.city.findUnique({ where: { name } });
    if (!city) throw new NotFoundException('City not found');
    if (patch.top === true && !city.top) {
      const topCount = await this.prisma.city.count({ where: { top: true } });
      if (topCount >= TOP_CITY_LIMIT) throw new BadRequestException(`Top-cities limit reached (${TOP_CITY_LIMIT}) — unstar one first`);
    }
    return this.prisma.city.update({ where: { name }, data: { icon: patch.icon, top: patch.top } });
  }

  async removeCountry(id: string) {
    if (!(await this.prisma.country.findUnique({ where: { id } }))) throw new NotFoundException('Country not found');
    await this.prisma.country.delete({ where: { id } }); // cascades to states; cities are only unlinked, never deleted
    return { ok: true };
  }

  async removeState(id: string) {
    if (!(await this.prisma.state.findUnique({ where: { id } }))) throw new NotFoundException('State not found');
    await this.prisma.state.delete({ where: { id } }); // cities are only unlinked (SetNull), never deleted
    return { ok: true };
  }

  /** Unlinks the city from the hierarchy — never deletes the City row
   * itself, since Venue/User/Organizer.city all reference it by name and
   * have no idea the admin location tree exists. */
  async removeCityFromTree(name: string) {
    const city = await this.prisma.city.findUnique({ where: { name } });
    if (!city) throw new NotFoundException('City not found');
    await this.prisma.city.update({ where: { name }, data: { stateId: null } });
    return { ok: true };
  }
}
