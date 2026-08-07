import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { FeaturedService } from './featured.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { RequirePermission } from '../admin/permission.decorator';

type AuthedReq = { user: { sub: string } };

@Controller('featured')
export class FeaturedController {
  constructor(private featured: FeaturedService) {}

  @Post('request')
  @UseGuards(JwtAuthGuard)
  request(@Req() req: AuthedReq, @Body() body: Parameters<FeaturedService['request']>[1]) {
    return this.featured.request(req.user.sub, body);
  }

  @Post(':id/confirm-payment')
  @UseGuards(JwtAuthGuard)
  confirmPayment(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: { paymentId: string; signature: string }) {
    return this.featured.confirmPayment(req.user.sub, id, body);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@Req() req: AuthedReq, @Query('type') type: Parameters<FeaturedService['mine']>[1], @Query('refId') refId: string) {
    return this.featured.mine(req.user.sub, type, refId);
  }

  @Get('rates')
  rates() {
    return this.featured.rates();
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  subscribe(@Req() req: AuthedReq, @Body() body: Parameters<FeaturedService['subscribe']>[1]) {
    return this.featured.subscribe(req.user.sub, body);
  }

  @Post('subscription/cancel')
  @UseGuards(JwtAuthGuard)
  cancelSubscription(@Req() req: AuthedReq, @Body() body: { type: Parameters<FeaturedService['mine']>[1]; refId: string }) {
    return this.featured.cancelSubscription(req.user.sub, body.type, body.refId);
  }

  @Get('mine-subscription')
  @UseGuards(JwtAuthGuard)
  mySubscription(@Req() req: AuthedReq, @Query('type') type: Parameters<FeaturedService['mine']>[1], @Query('refId') refId: string) {
    return this.featured.mySubscription(req.user.sub, type, refId);
  }
}

/** Minimal review queue, same reasoning as /admin/events (Phase 6). Rates
 * are gated on "Payments & payouts" — pricing config, not the placement
 * queue itself. */
@Controller('admin/featured')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminFeaturedController {
  constructor(private featured: FeaturedService) {}

  @Get()
  @RequirePermission('Featured', 'view')
  list(@Query('status') status?: string) {
    return this.featured.listForAdmin(status);
  }

  @Get('subscriptions')
  @RequirePermission('Featured', 'view')
  listSubscriptions() {
    return this.featured.listSubscriptionsForAdmin();
  }

  @Post(':id/approve')
  @RequirePermission('Featured', 'approve')
  approve(@Param('id') id: string) {
    return this.featured.adminApprove(id);
  }

  @Post(':id/reject')
  @RequirePermission('Featured', 'approve')
  reject(@Param('id') id: string) {
    return this.featured.adminReject(id);
  }

  @Post(':id/remind')
  @RequirePermission('Featured', 'edit')
  remind(@Param('id') id: string) {
    return this.featured.adminRemind(id);
  }

  @Patch('rates')
  @RequirePermission('Payments & payouts', 'edit')
  updateRates(@Body() body: Parameters<FeaturedService['updateRates']>[0]) {
    return this.featured.updateRates(body);
  }
}
