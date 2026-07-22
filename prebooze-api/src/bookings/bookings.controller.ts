import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { CreateBookingInput } from './bookings.service';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { RequirePermission } from '../admin/permission.decorator';

type AuthedReq = { user: { sub: string } };

@Controller()
export class BookingsController {
  constructor(private bookings: BookingsService) {}

  @Post('bookings/hold')
  @UseGuards(JwtAuthGuard)
  hold(@Req() req: AuthedReq, @Body() body: { eventId: string; qty: Record<string, number> }) {
    return this.bookings.createHold(req.user.sub, body.eventId, body.qty);
  }

  /** Call before showing the Razorpay checkout widget — returns final pricing
   * (post-coupon, post-wallet-credit) plus a Razorpay order id to pay against. */
  @Post('bookings/quote')
  @UseGuards(JwtAuthGuard)
  quote(@Req() req: AuthedReq, @Body() body: { holdId: string; couponCode?: string; walletCredit?: number }) {
    return this.bookings.quote(req.user.sub, body.holdId, body.couponCode, body.walletCredit);
  }

  @Post('bookings')
  @UseGuards(JwtAuthGuard)
  create(@Req() req: AuthedReq, @Body() body: CreateBookingInput) {
    return this.bookings.create(req.user.sub, body);
  }

  @Get('bookings')
  @UseGuards(JwtAuthGuard)
  list(@Req() req: AuthedReq) {
    return this.bookings.list(req.user.sub);
  }

  @Post('bookings/:id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@Req() req: AuthedReq, @Param('id') id: string, @Body('refundTo') refundTo: 'wallet' | 'source') {
    return this.bookings.cancel(req.user.sub, decodeURIComponent(id), refundTo);
  }

  @Post('bookings/check-in')
  @UseGuards(JwtAuthGuard)
  checkIn(@Body('token') token: string) {
    return this.bookings.checkIn(token);
  }

  @Post('events/:id/waitlist')
  @UseGuards(JwtAuthGuard)
  joinWaitlist(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.bookings.joinWaitlist(req.user.sub, id);
  }

  /** Public — the event page shows the waiting count even to logged-out guests. */
  @Get('events/:id/waitlist')
  waitlist(@Param('id') id: string) {
    return this.bookings.waitlist(id);
  }
}

@Controller('admin/bookings')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminBookingsController {
  constructor(private bookings: BookingsService) {}

  @Get()
  @RequirePermission('Bookings', 'view')
  list(@Query('status') status?: string) {
    return this.bookings.adminList(status);
  }

  @Post()
  @RequirePermission('Bookings', 'edit')
  create(@Body() body: Parameters<BookingsService['adminCreate']>[0]) {
    return this.bookings.adminCreate(body);
  }

  @Get(':id')
  @RequirePermission('Bookings', 'view')
  get(@Param('id') id: string) {
    return this.bookings.adminGet(decodeURIComponent(id));
  }

  @Post(':id/refund/approve')
  @RequirePermission('Refunds', 'approve')
  approveRefund(@Param('id') id: string) {
    return this.bookings.adminApproveRefund(decodeURIComponent(id));
  }

  @Post(':id/refund/decline')
  @RequirePermission('Refunds', 'approve')
  declineRefund(@Param('id') id: string) {
    return this.bookings.adminDeclineRefund(decodeURIComponent(id));
  }
}
