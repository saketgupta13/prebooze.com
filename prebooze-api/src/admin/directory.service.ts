import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'entry';

function hueFromId(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** Admin "god mode" directory management — create/edit/verify catalog rows
 * directly, independent of the self-serve KYC flow (Phases 6-8). Pending/
 * rejected role *applications* stay exclusively in GET /admin/kyc; this
 * only ever manages already-approved directory entries (there's no
 * duplicate status field mirroring KycSubmission.status here — that would
 * be two sources of truth for the same thing). See BACKEND.md "Admin API". */
@Injectable()
export class DirectoryService {
  constructor(private prisma: PrismaService) {}

  // ---------- organizers ----------
  async listOrganizers() {
    return this.prisma.organizer.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createOrganizer(body: { brandName?: string; city?: string; state?: string; country?: string; pincode?: string; contact?: string }) {
    if (!body.brandName?.trim()) throw new BadRequestException('brandName is required');
    const base = slugify(body.brandName);
    const id = await this.uniqueId('organizer', base);
    const username = await this.uniqueField('organizer', 'username', base);
    return this.prisma.organizer.create({
      data: {
        id,
        brandName: body.brandName.trim(),
        username,
        city: body.city ?? '',
        state: body.state?.trim() || undefined,
        country: body.country?.trim() || undefined,
        pincode: body.pincode?.trim() || undefined,
        contact: body.contact ?? '',
        since: String(new Date().getFullYear()),
        about: '',
        logoHue: hueFromId(id),
      },
    });
  }

  async updateOrganizer(id: string, patch: Record<string, unknown>) {
    if (!(await this.prisma.organizer.findUnique({ where: { id } }))) throw new NotFoundException('Organizer not found');
    return this.prisma.organizer.update({ where: { id }, data: sanitizePatch(patch, ORGANIZER_EDITABLE) as never });
  }

  async setOrganizerVerified(id: string, verified: boolean) {
    if (!(await this.prisma.organizer.findUnique({ where: { id } }))) throw new NotFoundException('Organizer not found');
    return this.prisma.organizer.update({ where: { id }, data: { verified } });
  }

  /** Staff-facing visibility into an organizer's own team (OrgStaff — see
   * OrgTeamService.addStaff for the real invite flow that creates these).
   * Admin "god mode", same reasoning as the rest of this service: no
   * permission-matrix resolution needed, staff can always see/remove a
   * team member regardless of who invited them. */
  async organizerTeam(organizerId: string) {
    if (!(await this.prisma.organizer.findUnique({ where: { id: organizerId } }))) throw new NotFoundException('Organizer not found');
    return this.prisma.orgStaff.findMany({ where: { organizerId }, orderBy: { createdAt: 'asc' } });
  }

  async removeOrganizerTeamMember(organizerId: string, staffId: string) {
    const member = await this.prisma.orgStaff.findUnique({ where: { id: staffId } });
    if (!member || member.organizerId !== organizerId) throw new NotFoundException('Team member not found');
    await this.prisma.orgStaff.delete({ where: { id: staffId } });
    return { ok: true };
  }

  // ---------- promoters ----------
  async listPromoters() {
    return this.prisma.promoter.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createPromoter(body: { name?: string; city?: string; contact?: string }) {
    if (!body.name?.trim()) throw new BadRequestException('name is required');
    const base = slugify(body.name);
    const id = await this.uniqueId('promoter', 'pr-' + base);
    const slug = await this.uniqueField('promoter', 'slug', base);
    return this.prisma.promoter.create({
      data: { id, slug, name: body.name.trim(), city: body.city ?? '', contact: body.contact, bio: '' },
    });
  }

  async updatePromoter(id: string, patch: Record<string, unknown>) {
    if (!(await this.prisma.promoter.findUnique({ where: { id } }))) throw new NotFoundException('Promoter not found');
    return this.prisma.promoter.update({ where: { id }, data: sanitizePatch(patch, PROMOTER_EDITABLE) as never });
  }

  async setPromoterVerified(id: string, verified: boolean) {
    if (!(await this.prisma.promoter.findUnique({ where: { id } }))) throw new NotFoundException('Promoter not found');
    return this.prisma.promoter.update({ where: { id }, data: { verified } });
  }

  // ---------- lineups ----------
  async listLineups() {
    return this.prisma.lineup.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createLineup(body: { name?: string; category?: string; city?: string; state?: string; country?: string; pincode?: string }) {
    if (!body.name?.trim()) throw new BadRequestException('name is required');
    const base = slugify(body.name);
    const id = await this.uniqueId('lineup', 'lu-' + base);
    const slug = await this.uniqueField('lineup', 'slug', base);
    return this.prisma.lineup.create({
      data: {
        id, slug, name: body.name.trim(), category: body.category ?? 'Artist', city: body.city ?? '',
        state: body.state?.trim() || undefined, country: body.country?.trim() || undefined, pincode: body.pincode?.trim() || undefined,
        bio: '', hue: hueFromId(id), emoji: '🎤',
      },
    });
  }

  async updateLineup(id: string, patch: Record<string, unknown>) {
    const existing = await this.prisma.lineup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lineup not found');
    // slug isn't in LINEUP_EDITABLE's blanket sanitizePatch below — it's
    // @unique, so it needs the same collision check the self-serve
    // LineupService.updateMe already does for an artist changing their own
    // username, not a bare overwrite that could 500 on a duplicate.
    if (typeof patch.slug === 'string' && patch.slug.trim()) {
      const slug = patch.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      if (slug && slug !== existing.slug) {
        const clash = await this.prisma.lineup.findUnique({ where: { slug } });
        if (clash) throw new BadRequestException(`Username "${slug}" is already taken`);
        await this.prisma.lineup.update({ where: { id }, data: { slug } });
      }
    }
    return this.prisma.lineup.update({ where: { id }, data: sanitizePatch(patch, LINEUP_EDITABLE) as never });
  }

  async setLineupVerified(id: string, verified: boolean) {
    if (!(await this.prisma.lineup.findUnique({ where: { id } }))) throw new NotFoundException('Lineup not found');
    return this.prisma.lineup.update({ where: { id }, data: { verified } });
  }

  // ---------- venues ----------
  async listVenues() {
    return this.prisma.venue.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createVenue(body: { name?: string; city?: string; state?: string; country?: string; pincode?: string; address?: string; capacity?: number; type?: string }) {
    if (!body.name?.trim() || !body.city?.trim()) throw new BadRequestException('name and city are required');
    const id = await this.uniqueId('venue', slugify(body.name));
    return this.prisma.venue.create({
      data: {
        id,
        name: body.name.trim(),
        city: body.city.trim(),
        state: body.state?.trim() || undefined,
        country: body.country?.trim() || undefined,
        pincode: body.pincode?.trim() || undefined,
        address: body.address ?? '',
        capacity: body.capacity ?? 0,
        type: body.type ?? '',
        about: '',
        photoHue: hueFromId(id),
      },
    });
  }

  async updateVenue(id: string, patch: Record<string, unknown>) {
    if (!(await this.prisma.venue.findUnique({ where: { id } }))) throw new NotFoundException('Venue not found');
    return this.prisma.venue.update({ where: { id }, data: sanitizePatch(patch, VENUE_EDITABLE) as never });
  }

  async setVenueVerified(id: string, verified: boolean) {
    if (!(await this.prisma.venue.findUnique({ where: { id } }))) throw new NotFoundException('Venue not found');
    return this.prisma.venue.update({ where: { id }, data: { verified } });
  }

  /** A venue's own self-serve city edit (VenueService.updateListing) never
   * writes `city` directly — it lands in `pendingCity` instead, since a
   * guest's city filter and every directory listing depend on `city`
   * matching admin's real enabled-cities list. Approving here is the only
   * path that actually moves it into `city`. */
  async approveVenueCityChange(id: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id } });
    if (!venue) throw new NotFoundException('Venue not found');
    if (!venue.pendingCity) throw new BadRequestException('No pending city change for this venue');
    return this.prisma.venue.update({ where: { id }, data: { city: venue.pendingCity, pendingCity: null } });
  }

  async rejectVenueCityChange(id: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id } });
    if (!venue) throw new NotFoundException('Venue not found');
    if (!venue.pendingCity) throw new BadRequestException('No pending city change for this venue');
    return this.prisma.venue.update({ where: { id }, data: { pendingCity: null } });
  }

  // ---------- id/slug helpers ----------
  private async uniqueId(model: 'organizer' | 'promoter' | 'lineup' | 'venue', base: string) {
    let candidate = base;
    let n = 1;
    while (await (this.prisma[model] as { findUnique: (a: unknown) => Promise<unknown> }).findUnique({ where: { id: candidate } })) {
      candidate = `${base}-${++n}`;
    }
    return candidate;
  }

  private async uniqueField(model: 'organizer' | 'promoter' | 'lineup', field: 'username' | 'slug', base: string) {
    let candidate = base;
    let n = 1;
    while (await (this.prisma[model] as { findUnique: (a: unknown) => Promise<unknown> }).findUnique({ where: { [field]: candidate } })) {
      candidate = `${base}-${++n}`;
    }
    return candidate;
  }
}

// Only these fields are patchable via PATCH — id/slug/username/userId and
// computed/relational fields (events, followers, ledger, etc.) stay out of
// client control.
const ORGANIZER_EDITABLE = [
  'brandName', 'city', 'state', 'country', 'pincode', 'about', 'contact', 'contactPerson', 'phone', 'eventTypes', 'links', 'gstin', 'pan', 'bankLast4', 'seo',
];
const PROMOTER_EDITABLE = ['name', 'city', 'bio', 'contact', 'links', 'planId', 'seo'];
const LINEUP_EDITABLE = ['name', 'category', 'city', 'state', 'country', 'pincode', 'bio', 'links', 'logoUrl', 'seo'];
const VENUE_EDITABLE = [
  'name', 'type', 'locality', 'city', 'state', 'country', 'pincode', 'address', 'capacity', 'amenities', 'about', 'timings', 'license', 'contact', 'rules', 'seo',
  'contactPerson', 'contactPersonPhone', 'socialLinks', 'logoUrl', 'galleryUrls',
];

function sanitizePatch(patch: Record<string, unknown>, allowed: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) if (key in patch) out[key] = patch[key];
  return out;
}
