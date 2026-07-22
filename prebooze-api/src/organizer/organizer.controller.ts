import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { OrganizerService } from './organizer.service';
import type { EventInput } from './organizer.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { RequirePermission } from '../admin/permission.decorator';

type AuthedReq = { user: { sub: string } };

@Controller('organizer')
@UseGuards(JwtAuthGuard)
export class OrganizerController {
  constructor(private organizer: OrganizerService) {}

  @Get('events')
  events(@Req() req: AuthedReq) {
    return this.organizer.events(req.user.sub);
  }

  @Post('events')
  upsertEvent(@Req() req: AuthedReq, @Body() body: EventInput) {
    return this.organizer.upsertEvent(req.user.sub, body);
  }

  @Get('events/:id/attendees')
  attendees(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.organizer.attendees(req.user.sub, id);
  }

  @Get('coupons')
  coupons(@Req() req: AuthedReq) {
    return this.organizer.coupons(req.user.sub);
  }

  @Post('coupons')
  upsertCoupon(@Req() req: AuthedReq, @Body() body: Parameters<OrganizerService['upsertCoupon']>[1]) {
    return this.organizer.upsertCoupon(req.user.sub, body);
  }

  @Get('payouts')
  payouts(@Req() req: AuthedReq) {
    return this.organizer.payouts(req.user.sub);
  }

  @Post('withdraw')
  withdraw(@Req() req: AuthedReq, @Body('amount') amount: number) {
    return this.organizer.withdraw(req.user.sub, amount);
  }

  @Get('carts')
  carts(@Req() req: AuthedReq) {
    return this.organizer.carts(req.user.sub);
  }

  @Post('carts/:id/remind')
  remindCart(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.organizer.remindCart(req.user.sub, id);
  }
}

/** Minimal review queue that closes the loop opened by POST /organizer/events
 * — a full events-approve admin console is separate Admin API work (see
 * BACKEND.md), this is just enough to unblock organizer-created events from
 * going live. Real staff auth + the "Events & approvals" permission, as of
 * the Admin API auth slice — previously gated on the placeholder secret. */
@Controller('admin/events')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminEventsController {
  constructor(private organizer: OrganizerService) {}

  @Get()
  @RequirePermission('Events & approvals', 'view')
  list(@Query('status') status?: string) {
    return this.organizer.listForAdmin(status);
  }

  @Post(':id/approve')
  @RequirePermission('Events & approvals', 'approve')
  approve(@Param('id') id: string) {
    return this.organizer.adminApprove(id);
  }

  @Post(':id/reject')
  @RequirePermission('Events & approvals', 'approve')
  reject(@Param('id') id: string, @Body('reason') reason: string) {
    return this.organizer.adminReject(id, reason);
  }

  // Reports slice: finally backs the "Event commission (per event)" permission
  // module that's existed since the staff-auth slice with no endpoint.
  @Patch(':id/commission')
  @RequirePermission('Event commission (per event)', 'edit')
  setCommission(@Param('id') id: string, @Body('commission') commission: number | null) {
    return this.organizer.adminSetCommission(id, commission);
  }

  @Patch(':id/paid-out')
  @RequirePermission('Payments & payouts', 'edit')
  setPaidOut(@Param('id') id: string, @Body('paidOut') paidOut: boolean) {
    return this.organizer.adminSetPaidOut(id, paidOut);
  }

  // Live Monitor slice: "Pause gate sales" — mapped onto the only real sales
  // channel this backend has (online booking), enforced in priceHold().
  @Patch(':id/pause-sales')
  @RequirePermission('Gate check-in', 'edit')
  setSalesPaused(@Param('id') id: string, @Body('paused') paused: boolean) {
    return this.organizer.adminSetSalesPaused(id, paused);
  }

  @Patch(':id/poster')
  @RequirePermission('Events & approvals', 'edit')
  setPoster(@Param('id') id: string, @Body('posterUrl') posterUrl: string | null) {
    return this.organizer.adminSetPoster(id, posterUrl);
  }
}
