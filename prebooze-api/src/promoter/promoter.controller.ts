import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Req } from '@nestjs/common';
import { PromoterService } from './promoter.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

type AuthedReq = { user: { sub: string } };

@Controller('promoter')
@UseGuards(JwtAuthGuard)
export class PromoterController {
  constructor(private promoter: PromoterService) {}

  @Get('me')
  me(@Req() req: AuthedReq) {
    return this.promoter.me(req.user.sub);
  }

  @Patch('me')
  updateMe(@Req() req: AuthedReq, @Body() body: Parameters<PromoterService['updateMe']>[1]) {
    return this.promoter.updateMe(req.user.sub, body);
  }

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

  @Get('events/earnings')
  perEventEarnings(@Req() req: AuthedReq) {
    return this.promoter.perEventEarnings(req.user.sub);
  }

  @Post('events/:eventId/mark-received')
  markEventReceived(@Req() req: AuthedReq, @Param('eventId') eventId: string) {
    return this.promoter.markEventReceived(req.user.sub, eventId);
  }

  @Post('events/:eventId/remind-payout')
  remindOrganizerToPay(@Req() req: AuthedReq, @Param('eventId') eventId: string) {
    return this.promoter.remindOrganizerToPay(req.user.sub, eventId);
  }

  @Post('withdraw')
  withdraw(@Req() req: AuthedReq, @Body('amount') amount: number) {
    return this.promoter.withdraw(req.user.sub, amount);
  }

  @Get('withdrawals')
  withdrawals(@Req() req: AuthedReq) {
    return this.promoter.withdrawals(req.user.sub);
  }

  @Get('team')
  team(@Req() req: AuthedReq) {
    return this.promoter.team(req.user.sub);
  }

  @Post('team')
  addTeamMember(@Req() req: AuthedReq, @Body() body: { handle?: string; name?: string; hue?: number }) {
    return this.promoter.addTeamMember(req.user.sub, body);
  }

  @Delete('team/:id')
  removeTeamMember(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.promoter.removeTeamMember(req.user.sub, id);
  }

  @Get('leaderboard')
  leaderboard() {
    return this.promoter.leaderboard();
  }

  @Get('subscription/tiers')
  subscriptionTiers() {
    return this.promoter.subscriptionTiers();
  }

  @Get('subscription')
  mySubscription(@Req() req: AuthedReq) {
    return this.promoter.mySubscription(req.user.sub);
  }

  @Post('subscription')
  subscribe(@Req() req: AuthedReq, @Body('tierId') tierId: string) {
    return this.promoter.subscribe(req.user.sub, tierId);
  }

  @Post('subscription/cancel')
  cancelSubscription(@Req() req: AuthedReq) {
    return this.promoter.cancelSubscription(req.user.sub);
  }

  @Get('usage')
  usage(@Req() req: AuthedReq) {
    return this.promoter.usage(req.user.sub);
  }
}

/** Public guest-list capture — no auth, reached via a promoter's affiliate
 * link (/p/:eventSlug/:promoterSlug). */
@Controller('p')
export class GuestCaptureController {
  constructor(private promoter: PromoterService) {}

  // Registered before the ':eventSlug/:promoterSlug' capture route below
  // would otherwise be ambiguous with — Nest matches static segments first
  // regardless of declaration order, but keeping this above documents the
  // intent: 'pass' can never collide with a real event slug since event
  // slugs are organizer-chosen human strings, not reserved.
  @Get('pass/:id')
  getPass(@Param('id') id: string) {
    return this.promoter.getPass(id);
  }

  @Post(':eventSlug/:promoterSlug')
  capture(
    @Param('eventSlug') eventSlug: string,
    @Param('promoterSlug') promoterSlug: string,
    @Body() body: { name?: string; phone?: string; age?: string; gender?: string; subPromoter?: string },
  ) {
    return this.promoter.captureGuest(eventSlug, promoterSlug, body);
  }
}
