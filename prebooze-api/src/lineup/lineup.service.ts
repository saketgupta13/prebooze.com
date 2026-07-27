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

  /** Mirrors PromoterService.updateMe/OrganizerService.updateMe — name is
   * mirrored onto User.lineupName/lineupCategory for the global header +
   * case-normalized self-follow check. LineupSettings.tsx's free-text
   * "socials" field maps onto Lineup.links (a string[]) by splitting on
   * commas/slashes — the only separator format the placeholder ever implied
   * ("ig / spotify / soundcloud"). No username/slug editor exists in the UI
   * yet, so slug is intentionally left alone here. */
  async updateMe(userId: string, patch: { name?: string; category?: string; city?: string; bio?: string; socials?: string }) {
    const lineup = await this.myLineup(userId);

    const updated = await this.prisma.lineup.update({
      where: { id: lineup.id },
      data: {
        name: patch.name?.trim(),
        category: patch.category?.trim(),
        city: patch.city?.trim(),
        bio: patch.bio,
        links: patch.socials !== undefined
          ? patch.socials.split(/[,/]+/).map((s) => s.trim()).filter(Boolean)
          : undefined,
      },
    });

    if (lineup.userId && (patch.name !== undefined || patch.category !== undefined)) {
      await this.prisma.user.update({
        where: { id: lineup.userId },
        data: {
          lineupName: patch.name !== undefined ? updated.name : undefined,
          lineupCategory: patch.category !== undefined ? updated.category : undefined,
        },
      });
    }

    return updated;
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
