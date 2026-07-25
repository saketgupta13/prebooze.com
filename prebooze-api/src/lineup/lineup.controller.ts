import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { LineupService } from './lineup.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

type AuthedReq = { user: { sub: string } };

/** Same route shape as /organizer, /promoter, /venue's subscription
 * endpoints — see LineupService for why this controller only carries
 * subscription routes and nothing else. */
@Controller('lineup')
@UseGuards(JwtAuthGuard)
export class LineupController {
  constructor(private lineup: LineupService) {}

  @Get('subscription/tiers')
  subscriptionTiers() {
    return this.lineup.subscriptionTiers();
  }

  @Get('subscription')
  mySubscription(@Req() req: AuthedReq) {
    return this.lineup.mySubscription(req.user.sub);
  }

  @Post('subscription')
  subscribe(@Req() req: AuthedReq, @Body('tierId') tierId: string) {
    return this.lineup.subscribe(req.user.sub, tierId);
  }

  @Post('subscription/cancel')
  cancelSubscription(@Req() req: AuthedReq) {
    return this.lineup.cancelSubscription(req.user.sub);
  }
}
