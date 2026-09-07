import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { RequirePermission } from '../admin/permission.decorator';

type AuthedReq = { user: { sub: string } };

/** Organizer-side paid-marketing endpoints — same route-root pattern as
 * Bookings (nested under /organizer). Guard moved to each method
 * individually (not the class) so `rates()` can stay public — same
 * exception FeaturedController's own `/featured/rates` already carries,
 * needed so the public /advertise landing page can show real pricing to a
 * logged-out visitor before they ever sign in. Every other handler here
 * forces ownerType: 'organizer' server-side; the venue mirror below is the
 * only other caller of the same MarketingService, forcing 'venue' instead
 * — the route itself is what decides which side of the marketplace is
 * acting, never a client-supplied field. */
@Controller('organizer/marketing')
export class MarketingController {
  constructor(private marketing: MarketingService) {}

  @Get('rates')
  rates() {
    return this.marketing.rates();
  }

  @Post('request')
  @UseGuards(JwtAuthGuard)
  request(@Req() req: AuthedReq, @Body('eventId') eventId: string) {
    return this.marketing.requestForEvent(req.user.sub, 'organizer', eventId);
  }

  @Post(':id/confirm-payment')
  @UseGuards(JwtAuthGuard)
  confirmPayment(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: { paymentId: string; signature: string }) {
    return this.marketing.confirmPayment(req.user.sub, 'organizer', id, body);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  myOrders(@Req() req: AuthedReq) {
    return this.marketing.myOrders(req.user.sub, 'organizer');
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  subscribe(@Req() req: AuthedReq) {
    return this.marketing.subscribe(req.user.sub, 'organizer');
  }

  @Post('subscription/cancel')
  @UseGuards(JwtAuthGuard)
  cancelSubscription(@Req() req: AuthedReq) {
    return this.marketing.cancelSubscription(req.user.sub, 'organizer');
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  mySubscription(@Req() req: AuthedReq) {
    return this.marketing.mySubscription(req.user.sub, 'organizer');
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  analytics(@Req() req: AuthedReq, @Query('eventId') eventId: string) {
    return this.marketing.analyticsFor(req.user.sub, 'organizer', eventId);
  }
}

/** Identical shape, venue side — matches VenueController's own
 * `hosting/bookings` etc. route-naming convention. */
@Controller('venue/hosting/marketing')
export class VenueMarketingController {
  constructor(private marketing: MarketingService) {}

  @Get('rates')
  rates() {
    return this.marketing.rates();
  }

  @Post('request')
  @UseGuards(JwtAuthGuard)
  request(@Req() req: AuthedReq, @Body('eventId') eventId: string) {
    return this.marketing.requestForEvent(req.user.sub, 'venue', eventId);
  }

  @Post(':id/confirm-payment')
  @UseGuards(JwtAuthGuard)
  confirmPayment(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: { paymentId: string; signature: string }) {
    return this.marketing.confirmPayment(req.user.sub, 'venue', id, body);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  myOrders(@Req() req: AuthedReq) {
    return this.marketing.myOrders(req.user.sub, 'venue');
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  subscribe(@Req() req: AuthedReq) {
    return this.marketing.subscribe(req.user.sub, 'venue');
  }

  @Post('subscription/cancel')
  @UseGuards(JwtAuthGuard)
  cancelSubscription(@Req() req: AuthedReq) {
    return this.marketing.cancelSubscription(req.user.sub, 'venue');
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  mySubscription(@Req() req: AuthedReq) {
    return this.marketing.mySubscription(req.user.sub, 'venue');
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  analytics(@Req() req: AuthedReq, @Query('eventId') eventId: string) {
    return this.marketing.analyticsFor(req.user.sub, 'venue', eventId);
  }
}

/** Admin review queue + the human handoff point — admin has actually
 * created the real Meta campaign for a paid order/subscription and records
 * its id here. Same "read-only visibility, no god-mode write on the
 * owner's own subscribe/cancel" boundary as AdminFeaturedController. */
@Controller('admin/marketing')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminMarketingController {
  constructor(private marketing: MarketingService) {}

  @Get('orders')
  @RequirePermission('Marketing campaigns', 'view')
  listOrders(@Query('status') status?: string) {
    return this.marketing.listOrdersForAdmin(status);
  }

  @Get('subscriptions')
  @RequirePermission('Marketing campaigns', 'view')
  listSubscriptions() {
    return this.marketing.listSubscriptionsForAdmin();
  }

  @Patch(':id/campaign')
  @RequirePermission('Marketing campaigns', 'edit')
  setCampaign(@Param('id') id: string, @Body('metaCampaignId') metaCampaignId: string) {
    return this.marketing.adminSetCampaign(id, metaCampaignId);
  }

  @Post(':id/reject')
  @RequirePermission('Marketing campaigns', 'approve')
  reject(@Param('id') id: string) {
    return this.marketing.adminReject(id);
  }

  @Get('rates')
  @RequirePermission('Marketing campaigns', 'view')
  rates() {
    return this.marketing.rates();
  }

  @Patch('rates')
  @RequirePermission('Marketing campaigns', 'edit')
  updateRates(@Body() body: Parameters<MarketingService['updateRates']>[0]) {
    return this.marketing.updateRates(body);
  }
}
