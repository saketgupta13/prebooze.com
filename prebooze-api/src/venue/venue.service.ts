import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

interface OnboardInput {
  name?: string;
  type?: string;
  city?: string;
  address?: string;
  capacity?: number;
  amenities?: string[];
  timings?: string;
  about?: string;
  licenseDoc?: string;
  addressProofDoc?: string;
}

@Injectable()
export class VenueService {
  constructor(
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
  ) {}

  // ---------- subscription (Razorpay-billed venue plans) ----------
  async subscriptionTiers() {
    return this.subscriptions.tiers('venue');
  }

  async mySubscription(userId: string) {
    const venue = await this.myVenue(userId);
    return this.subscriptions.current('venue', venue.id);
  }

  async subscribe(userId: string, tierId: string) {
    const venue = await this.myVenue(userId);
    return this.subscriptions.subscribe('venue', venue.id, tierId);
  }

  async cancelSubscription(userId: string) {
    const venue = await this.myVenue(userId);
    return this.subscriptions.cancel('venue', venue.id);
  }

  private async myVenue(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.venueId) throw new ForbiddenException('Not an approved venue partner');
    const venue = await this.prisma.venue.findUnique({ where: { id: user.venueId } });
    if (!venue) throw new NotFoundException('Venue listing not found');
    return venue;
  }

  private async uniqueId(base: string) {
    let candidate = base;
    let n = 1;
    while (await this.prisma.venue.findUnique({ where: { id: candidate } })) {
      candidate = `${base}-${++n}`;
    }
    return candidate;
  }

  /** Same guard rules as KycService.submitRole (one number one role, one
   * pending application at a time) — duplicated rather than shared because
   * this endpoint's contract takes document *references* as plain JSON
   * strings (prebooze-web/src/api/index.ts: `licenseDoc?: string`), not
   * multipart file uploads like /kyc/role, so it can't reuse that method's
   * Multer-shaped signature. Unlike organizer/promoter onboarding, the
   * Venue catalog row is created here immediately (unverified) — it shows
   * up in the directory and is pickable by organizers right away; only the
   * verified badge waits on admin approval (see KycService.approve). */
  async onboard(userId: string, input: OnboardInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException();
    if (user.role) {
      throw new BadRequestException(
        user.role === 'venue' ? "You're already an approved venue partner" : 'This number already holds a role — one number, one role',
      );
    }
    if (user.roleStatus === 'pending') throw new BadRequestException('Your application is already under review');

    if (!input.name?.trim() || !input.city?.trim() || !input.address?.trim() || !(Number(input.capacity) > 0) || !input.about?.trim()) {
      throw new BadRequestException('name, city, address, capacity and about are required');
    }
    if (!input.licenseDoc || !input.addressProofDoc) {
      throw new BadRequestException('Operating license and address proof are both required');
    }

    const id = await this.uniqueId(
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'venue',
    );

    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;

    const venue = await this.prisma.venue.create({
      data: {
        id,
        name: input.name.trim(),
        verified: false,
        type: input.type ?? '',
        city: input.city.trim(),
        address: input.address.trim(),
        capacity: Number(input.capacity),
        amenities: input.amenities ?? [],
        about: input.about.trim(),
        timings: input.timings,
        photoHue: h,
      },
    });

    await this.prisma.kycSubmission.create({
      data: {
        userId,
        kind: 'venue',
        status: 'pending',
        payload: { venueId: id, name: venue.name, city: venue.city } as Prisma.InputJsonValue,
        documents: [
          { type: 'license', path: input.licenseDoc },
          { type: 'address_proof', path: input.addressProofDoc },
        ] as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.user.update({ where: { id: userId }, data: { venueName: venue.name, venueId: id, roleStatus: 'pending' } });

    return venue;
  }

  async myListing(userId: string) {
    return this.myVenue(userId);
  }

  /** City changes are admin-gated — everything else an owner can edit freely. */
  async updateListing(userId: string, patch: Partial<OnboardInput>) {
    const venue = await this.myVenue(userId);
    if (patch.city !== undefined && patch.city !== venue.city) {
      throw new BadRequestException('City changes require admin review — contact support');
    }
    return this.prisma.venue.update({
      where: { id: venue.id },
      data: {
        name: patch.name?.trim(),
        type: patch.type,
        address: patch.address?.trim(),
        capacity: patch.capacity !== undefined ? Number(patch.capacity) : undefined,
        amenities: patch.amenities,
        timings: patch.timings,
        about: patch.about?.trim(),
      },
    });
  }

  async events(userId: string) {
    const venue = await this.myVenue(userId);
    return this.prisma.event.findMany({
      where: { venueId: venue.id, status: 'approved' },
      // a venue partner isn't the organizer's staff — never expose the
      // organizer's contact/GSTIN/PAN/bank fields (Admin API directory
      // slice) through this console, same reasoning as the public catalog.
      include: {
        tiers: true,
        organizer: { select: { id: true, brandName: true, username: true, verified: true, city: true, about: true, logoHue: true, contact: true } },
      },
      orderBy: { date: 'asc' },
    });
  }
}
