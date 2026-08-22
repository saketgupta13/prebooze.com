import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Venue } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type VenuePermLevel = 'view' | 'edit';
type PermMatrix = Record<string, Record<VenuePermLevel, boolean>>;

/** Venue's own equivalent of OrgAccessService — resolves "which venue is
 * this JWT allowed to act as [for hosting], and with what permissions".
 * The real owner (User.venueId) always has full access, same as before this
 * existed. An invited VenueStaff member (see VenueTeamService.addStaff)
 * resolves instead to their venue's VenueRole permission matrix. Folds in
 * the hostingEnabled gate here too — a staff member of a not-yet-approved
 * venue gets the same "not hosting-enabled" rejection an owner would, since
 * there's nothing real to delegate access to before approval. Every
 * venue-hosting method in VenueService now goes through here instead of the
 * old bare myVenue()+requireHostingEnabled() pair. */
@Injectable()
export class VenueAccessService {
  constructor(private prisma: PrismaService) {}

  async resolve(userId: string): Promise<{ venue: Venue; isOwner: boolean; roleName?: string; can: (module: string, level: VenuePermLevel) => boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.venueId) {
      const venue = await this.prisma.venue.findUnique({ where: { id: user.venueId } });
      if (venue) return { venue, isOwner: true, can: () => true };
    }

    const staff = await this.prisma.venueStaff.findFirst({ where: { userId } });
    if (!staff) throw new ForbiddenException('Not an approved venue partner');
    const venue = await this.prisma.venue.findUnique({ where: { id: staff.venueId } });
    if (!venue) throw new ForbiddenException('Not an approved venue partner');
    const role = await this.prisma.venueRole.findUnique({ where: { venueId_name: { venueId: venue.id, name: staff.roleName } } });
    const perms = (role?.permissions as PermMatrix | undefined) ?? {};
    return { venue, isOwner: false, roleName: staff.roleName, can: (module, level) => !!perms[module]?.[level] };
  }

  /** Resolve + assert one permission cell + the hostingEnabled gate, all in
   * one call — the shape every hosting method actually wants. */
  async require(userId: string, module: string, level: VenuePermLevel): Promise<Venue> {
    const access = await this.resolve(userId);
    if (!access.venue.hostingEnabled) throw new ForbiddenException('Hosting is not enabled for this venue yet');
    if (!access.can(module, level)) {
      throw new ForbiddenException(`Your role doesn't have "${level}" access to "${module}"`);
    }
    return access.venue;
  }
}
