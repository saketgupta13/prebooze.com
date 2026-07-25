import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { VenueService } from './venue.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

type AuthedReq = { user: { sub: string } };

@Controller('venue')
@UseGuards(JwtAuthGuard)
export class VenueController {
  constructor(private venue: VenueService) {}

  @Post('onboard')
  onboard(@Req() req: AuthedReq, @Body() body: Parameters<VenueService['onboard']>[1]) {
    return this.venue.onboard(req.user.sub, body);
  }

  @Get('listing')
  myListing(@Req() req: AuthedReq) {
    return this.venue.myListing(req.user.sub);
  }

  @Patch('listing')
  updateListing(@Req() req: AuthedReq, @Body() body: Parameters<VenueService['updateListing']>[1]) {
    return this.venue.updateListing(req.user.sub, body);
  }

  @Get('events')
  events(@Req() req: AuthedReq) {
    return this.venue.events(req.user.sub);
  }

  @Get('subscription/tiers')
  subscriptionTiers() {
    return this.venue.subscriptionTiers();
  }

  @Get('subscription')
  mySubscription(@Req() req: AuthedReq) {
    return this.venue.mySubscription(req.user.sub);
  }

  @Post('subscription')
  subscribe(@Req() req: AuthedReq, @Body('tierId') tierId: string) {
    return this.venue.subscribe(req.user.sub, tierId);
  }

  @Post('subscription/cancel')
  cancelSubscription(@Req() req: AuthedReq) {
    return this.venue.cancelSubscription(req.user.sub);
  }
}
