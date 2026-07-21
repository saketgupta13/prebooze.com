import { Body, Controller, Get, Param, Post, UseGuards, Req } from '@nestjs/common';
import { PromoterService } from './promoter.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

type AuthedReq = { user: { sub: string } };

@Controller('promoter')
@UseGuards(JwtAuthGuard)
export class PromoterController {
  constructor(private promoter: PromoterService) {}

  @Get('promotions')
  promotions(@Req() req: AuthedReq) {
    return this.promoter.promotions(req.user.sub);
  }

  @Get('events/:id/guests')
  guests(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.promoter.guests(req.user.sub, id);
  }

  @Post('guests/:id/check-in')
  checkIn(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.promoter.checkIn(req.user.sub, id);
  }

  @Get('earnings')
  earnings(@Req() req: AuthedReq) {
    return this.promoter.earnings(req.user.sub);
  }

  @Post('withdraw')
  withdraw(@Req() req: AuthedReq, @Body('amount') amount: number) {
    return this.promoter.withdraw(req.user.sub, amount);
  }

  @Get('team')
  team(@Req() req: AuthedReq) {
    return this.promoter.team(req.user.sub);
  }

  @Post('team')
  addTeamMember(@Req() req: AuthedReq, @Body() body: { handle?: string; name?: string; hue?: number }) {
    return this.promoter.addTeamMember(req.user.sub, body);
  }

  @Post('subscription')
  subscribe(@Req() req: AuthedReq, @Body('planId') planId: string) {
    return this.promoter.subscribe(req.user.sub, planId);
  }
}

/** Public guest-list capture — no auth, reached via a promoter's affiliate
 * link (/p/:eventSlug/:promoterSlug). */
@Controller('p')
export class GuestCaptureController {
  constructor(private promoter: PromoterService) {}

  @Post(':eventSlug/:promoterSlug')
  capture(
    @Param('eventSlug') eventSlug: string,
    @Param('promoterSlug') promoterSlug: string,
    @Body() body: { name?: string; phone?: string; age?: string; gender?: string; subPromoter?: string },
  ) {
    return this.promoter.captureGuest(eventSlug, promoterSlug, body);
  }
}
