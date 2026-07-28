import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/** Line-ups previously had no self-serve console/module at all — entities
 * only ever existed via the KYC-approval directory flow (DirectoryService),
 * with no JWT-authed "my line-up" endpoints the way organizer/promoter/venue
 * have. Carries the Razorpay Subscription routes plus a narrow profile-edit
 * endpoint (updateMe, matching LineupSettings.tsx's form); deliberately
 * doesn't grow a full console (events, earnings, etc.) — that's a separate,
 * bigger, unrequested scope. */
@Injectable()
export class LineupService {
  constructor(
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
  ) {}

  private async myLineup(userId: string) {
    const lineup = await this.prisma.lineup.findUnique({ where: { userId } });
    if (!lineup) throw new ForbiddenException('Not an approved line-up');
    return lineup;
  }

  /** Backs LineupSettings.tsx's on-mount fetch — the dashboard form used to
   * seed itself from the generic User (guest) fields instead, which was
   * wrong for anything saved through updateMe below (e.g. a fresh page load
   * showed the guest's own city/bio, not the artist profile's). */
  async me(userId: string) {
    return this.myLineup(userId);
  }

  /** Mirrors PromoterService.updateMe/OrganizerService.updateMe — name/
   * category/username/logoUrl are mirrored onto User.lineup* for the global
   * header + case-normalized self-follow check. `links` is a real add/remove
   * list of distinct URLs now (LineupOnboarding.tsx/LineupSettings.tsx), not
   * a single free-text field split on a delimiter — that used to make a full
   * URL like "instagram.com/handle" ambiguous with the separator itself.
   * Username reuses the same slug-collision-safe scheme as
   * KycService.newLineupRow. */
  async updateMe(userId: string, patch: { name?: string; category?: string; city?: string; bio?: string; links?: string[]; logoUrl?: string; username?: string }) {
    const lineup = await this.myLineup(userId);

    let slug = lineup.slug;
    if (patch.username !== undefined) {
      const base = patch.username.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || lineup.slug;
      let candidate = base;
      let n = 1;
      while (candidate !== lineup.slug && (await this.prisma.lineup.findUnique({ where: { slug: candidate } }))) {
        candidate = `${base}-${++n}`;
      }
      slug = candidate;
    }

    const updated = await this.prisma.lineup.update({
      where: { id: lineup.id },
      data: {
        name: patch.name?.trim(),
        category: patch.category?.trim(),
        city: patch.city?.trim(),
        bio: patch.bio,
        logoUrl: patch.logoUrl,
        slug: patch.username !== undefined ? slug : undefined,
        links: patch.links !== undefined ? patch.links.map((s) => s.trim()).filter(Boolean) : undefined,
      },
    });

    if (lineup.userId && (patch.name !== undefined || patch.category !== undefined || patch.logoUrl !== undefined || patch.username !== undefined)) {
      await this.prisma.user.update({
        where: { id: lineup.userId },
        data: {
          lineupName: patch.name !== undefined ? updated.name : undefined,
          lineupCategory: patch.category !== undefined ? updated.category : undefined,
          lineupLogoUrl: patch.logoUrl !== undefined ? updated.logoUrl : undefined,
          lineupUsername: patch.username !== undefined ? updated.slug : undefined,
        },
      });
    }

    return updated;
  }

  /** "Tagged in" events for the dashboard + (via the public catalog's own
   * matching in CatalogService) profile page — Event.lineup is a free-form
   * JSON array of {name, role}, not a real relation to the Lineup table (see
   * CreateEvent.tsx, which lets organizers pick from the live directory but
   * still just stores the name string), so this has to fetch approved events
   * and match by name in application code rather than a SQL join. */
  async events(userId: string) {
    const lineup = await this.myLineup(userId);
    const events = await this.prisma.event.findMany({
      where: { status: 'approved' },
      include: { venue: { select: { name: true, city: true } } },
      orderBy: { date: 'asc' },
    });
    const name = lineup.name.toLowerCase();
    return events
      .filter((e) => (e.lineup as { name: string; role: string }[]).some((l) => l.name.toLowerCase() === name))
      .map((e) => ({
        ...e,
        myRole: (e.lineup as { name: string; role: string }[]).find((l) => l.name.toLowerCase() === name)?.role,
      }));
  }

  async subscriptionTiers() {
    return this.subscriptions.tiers('lineup');
  }

  async mySubscription(userId: string) {
    const lineup = await this.myLineup(userId);
    return this.subscriptions.current('lineup', lineup.id);
  }

  async subscribe(userId: string, tierId: string) {
    const lineup = await this.myLineup(userId);
    return this.subscriptions.subscribe('lineup', lineup.id, tierId);
  }

  async cancelSubscription(userId: string) {
    const lineup = await this.myLineup(userId);
    return this.subscriptions.cancel('lineup', lineup.id);
  }
}
