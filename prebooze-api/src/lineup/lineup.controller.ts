import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { LineupService } from './lineup.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

type AuthedReq = { user: { sub: string } };

/** Same route shape as /organizer, /promoter, /venue's self-serve +
 * subscription endpoints — see LineupService for scope. */
@Controller('lineup')
@UseGuards(JwtAuthGuard)
export class LineupController {
  constructor(private lineup: LineupService) {}

  @Patch('me')
  updateMe(@Req() req: AuthedReq, @Body() body: Parameters<LineupService['updateMe']>[1]) {
    return this.lineup.updateMe(req.user.sub, body);
  }

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
