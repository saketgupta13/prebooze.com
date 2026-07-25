import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/** Line-ups previously had no self-serve console/module at all — entities
 * only ever existed via the KYC-approval directory flow (DirectoryService),
 * with no JWT-authed "my line-up" endpoints the way organizer/promoter/venue
 * have. This module exists specifically to carry the Razorpay Subscription
 * routes for line-ups; it deliberately doesn't grow a full console (events,
 * earnings, etc.) — that's a separate, bigger, unrequested scope. */
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
