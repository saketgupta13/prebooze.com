import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/** Deterministic cosmetic hue from an id — same idea as the seeded catalog's
 * avatarHue, just derived instead of authored, for projecting a real User
 * into the frontend's Person shape (see followers() below). */
function hueFromId(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function formatReviewDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

@Injectable()
export class SocialService {
  constructor(private prisma: PrismaService) {}

  // ---- follows ----
  // Every follow is instant/accepted — there's no private-account gating in
  // this product. followeeKey is opaque: "person:<id>" | "promoter:<slug>" |
  // "lineup:<slug>" | a bare venue/organizer id.
  async follow(userId: string, key: string) {
    if (!key) throw new BadRequestException('`key` is required');
    await this.prisma.follow.upsert({
      where: { followerId_followeeKey: { followerId: userId, followeeKey: key } },
      create: { followerId: userId, followeeKey: key },
      update: {},
    });
    return { ok: true };
  }

  async unfollow(userId: string, key: string) {
    await this.prisma.follow.deleteMany({ where: { followerId: userId, followeeKey: key } });
    return { ok: true };
  }

  /** Who follows me, projected into the frontend's Person shape. In
   * practice this is empty today — there's no "discover other guests as a
   * public profile" feature yet, so nobody can reach a `person:<userId>`
   * follow target; this stays correct once that exists. */
  async followers(userId: string) {
    const key = `person:${userId}`;
    const rows = await this.prisma.follow.findMany({ where: { followeeKey: key }, orderBy: { createdAt: 'desc' } });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.followerId) } } });
    return users.map((u) => ({
      id: u.id,
      name: u.name || 'Guest',
      username: u.username || u.id,
      city: u.city,
      avatarHue: hueFromId(u.id),
      bio: u.bio || undefined,
      verified: u.idVerified,
      followers: 0,
      follows: [],
    }));
  }

  /** The frontend's follow-requests UI was built ahead of any real trigger
   * for it (see BACKEND.md "Social") — there's no approval step for follows
   * in this product, so this is honestly always empty rather than backed by
   * a table that nothing ever writes to. Kept as a real endpoint so the
   * frontend doesn't 404 once wired to a live backend. */
  async followRequests(_userId: string) {
    return [];
  }

  async respondFollowRequest(_userId: string, _personId: string, _accept: boolean) {
    return { ok: true };
  }

  async setAttendanceVisibility(userId: string, v: string) {
    if (!['off', 'followers', 'public'].includes(v)) throw new BadRequestException('invalid visibility');
    await this.prisma.user.update({ where: { id: userId }, data: { attendanceVisibility: v as never } });
    return { ok: true };
  }

  /** Not in the original endpoint list: closes a real gap — the frontend's
   * follow/interested/wishlist/favourite state has toggle actions but no
   * accessor anywhere in src/api/index.ts or the User type, so a freshly
   * logged-in client on a real backend would have no way to know what's
   * already toggled. One bundled call to hydrate all of it at once, mirroring
   * how AppContext currently boots all of it from localStorage together. */
  async mySocialState(userId: string) {
    const [follows, interests, wishlists, favs] = await Promise.all([
      this.prisma.follow.findMany({ where: { followerId: userId }, select: { followeeKey: true } }),
      this.prisma.eventInterest.findMany({ where: { userId }, select: { eventId: true } }),
      this.prisma.eventWishlist.findMany({ where: { userId }, select: { eventId: true } }),
      this.prisma.venueFavourite.findMany({ where: { userId }, select: { venueId: true } }),
    ]);
    return {
      following: follows.map((f) => f.followeeKey),
      interested: interests.map((i) => i.eventId),
      wishlist: wishlists.map((w) => w.eventId),
      favouriteVenues: favs.map((v) => v.venueId),
    };
  }

  // ---- interested / wishlist / favourite ----
  async setInterested(userId: string, eventId: string, on: boolean) {
    if (on) {
      await this.prisma.eventInterest.upsert({
        where: { userId_eventId: { userId, eventId } },
        create: { userId, eventId },
        update: {},
      });
    } else {
      await this.prisma.eventInterest.deleteMany({ where: { userId, eventId } });
    }
    return { ok: true };
  }

  async setWishlist(userId: string, eventId: string, on: boolean) {
    if (on) {
      await this.prisma.eventWishlist.upsert({
        where: { userId_eventId: { userId, eventId } },
        create: { userId, eventId },
        update: {},
      });
    } else {
      await this.prisma.eventWishlist.deleteMany({ where: { userId, eventId } });
    }
    return { ok: true };
  }

  async setFavouriteVenue(userId: string, venueId: string, on: boolean) {
    if (on) {
      await this.prisma.venueFavourite.upsert({
        where: { userId_venueId: { userId, venueId } },
        create: { userId, venueId },
        update: {},
      });
    } else {
      await this.prisma.venueFavourite.deleteMany({ where: { userId, venueId } });
    }
    return { ok: true };
  }

  // ---- organizer reviews ----
  // Not in the original endpoint list: closes the read-side of a gap —
  // POST /organizers/:id/reviews was specced but nothing let a client fetch
  // existing reviews for an organizer (the mock kept them purely client-side).
  async reviews(organizerId: string) {
    const rows = await this.prisma.orgReview.findMany({
      where: { organizerId },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
    return rows.map((r) => ({
      id: r.id,
      author: r.user.name || 'Guest',
      rating: r.rating,
      text: r.text,
      organizerId: r.organizerId,
      date: formatReviewDate(r.createdAt),
    }));
  }

  async addReview(userId: string, organizerId: string, rating: number, text: string) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new BadRequestException('rating must be 1-5');
    if (!text?.trim()) throw new BadRequestException('text is required');
    const row = await this.prisma.orgReview.create({ data: { userId, organizerId, rating, text } });

    // Organizer.rating/reviewCount are display-only aggregates shown on the
    // public profile (OrganizerProfile.tsx) and OrgReviews.tsx's own KPI
    // strip — real OrgReview rows were being created here the whole time
    // but nothing ever recomputed these two fields, so every organizer's
    // public rating stayed frozen at whatever it seeded at (usually 0),
    // dead-real reviews notwithstanding.
    const agg = await this.prisma.orgReview.aggregate({ where: { organizerId }, _avg: { rating: true }, _count: true });
    await this.prisma.organizer.update({
      where: { id: organizerId },
      data: { rating: Math.round((agg._avg.rating ?? 0) * 10) / 10, reviewCount: agg._count },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return {
      id: row.id,
      author: user?.name || 'Guest',
      rating,
      text,
      organizerId,
      date: formatReviewDate(row.createdAt),
    };
  }
}
