import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { OrganizerService } from './organizer.service';
import type { EventInput } from './organizer.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../kyc/admin.guard';

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
 * going live. Same placeholder shared-secret gate as /admin/kyc. */
@Controller('admin/events')
@UseGuards(AdminGuard)
export class AdminEventsController {
  constructor(private organizer: OrganizerService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.organizer.listForAdmin(status);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.organizer.adminApprove(id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body('reason') reason: string) {
    return this.organizer.adminReject(id, reason);
  }
}
