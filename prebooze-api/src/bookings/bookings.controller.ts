import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { CreateBookingInput } from './bookings.service';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { RequirePermission } from '../admin/permission.decorator';

type AuthedReq = { user: { sub: string } };
// Same shape TrackController uses for IP/UA — nginx sets X-Forwarded-For to
// the real visitor IP (see deploy config), socket.remoteAddress is only a
// local/direct-dev fallback.
type AuthedReqWithMeta = AuthedReq & {
  headers: { 'user-agent'?: string; 'x-forwarded-for'?: string };
  socket?: { remoteAddress?: string };
};

@Controller()
export class BookingsController {
  constructor(private bookings: BookingsService) {}

  @Post('bookings/hold')
  @UseGuards(JwtAuthGuard)
  hold(@Req() req: AuthedReq, @Body() body: { eventId: string; qty: Record<string, number> }) {
    return this.bookings.createHold(req.user.sub, body.eventId, body.qty);
  }

  @Get('bookings/coupons')
  @UseGuards(JwtAuthGuard)
  availableCoupons(@Req() req: AuthedReq, @Query('eventId') eventId: string) {
    return this.bookings.availableCoupons(req.user.sub, eventId);
  }

  /** Call before showing the Razorpay checkout widget — returns final pricing
   * (post-coupon, post-wallet-credit) plus a Razorpay order id to pay against. */
  @Post('bookings/quote')
  @UseGuards(JwtAuthGuard)
  quote(@Req() req: AuthedReq, @Body() body: { holdId: string; couponCode?: string; walletCredit?: number; promoterRef?: string }) {
    return this.bookings.quote(req.user.sub, body.holdId, body.couponCode, body.walletCredit, body.promoterRef);
  }

  /** Called right before the Razorpay checkout widget opens — snapshots the
   * attendee-details form onto the cart so a payment that captures without
   * the guest's browser ever coming back can still be turned into a real
   * booking (see BookingsService.reconcilePayment). Fire-and-forget on the
   * frontend; never blocks or fails the real payment. */
  @Post('bookings/prepare')
  @UseGuards(JwtAuthGuard)
  prepare(@Req() req: AuthedReq, @Body() body: Parameters<BookingsService['prepare']>[1]) {
    return this.bookings.prepare(req.user.sub, body);
  }

  @Post('bookings')
  @UseGuards(JwtAuthGuard)
  create(@Req() req: AuthedReqWithMeta, @Body() body: CreateBookingInput) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;
    return this.bookings.create(req.user.sub, body, { ip, userAgent: req.headers['user-agent'] });
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

  @Post('bookings/:id/resend')
  @UseGuards(JwtAuthGuard)
  resend(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.bookings.resend(req.user.sub, decodeURIComponent(id));
  }

  @Post('bookings/check-in')
  @UseGuards(JwtAuthGuard)
  checkIn(@Req() req: AuthedReq, @Body('token') token: string) {
    return this.bookings.checkIn(token, req.user.sub);
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
  list(@Query('status') status?: string, @Query('userId') userId?: string) {
    return this.bookings.adminList(status, userId);
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

  @Post(':id/resend-email')
  @RequirePermission('Bookings', 'edit')
  resendEmail(@Param('id') id: string) {
    return this.bookings.adminResendEmail(decodeURIComponent(id));
  }

  @Post(':id/note')
  @RequirePermission('Bookings', 'edit')
  setNote(@Param('id') id: string, @Body('note') note: string) {
    return this.bookings.adminSetNote(decodeURIComponent(id), note ?? '');
  }

  @Post(':id/guests')
  @RequirePermission('Bookings', 'edit')
  setGuests(@Param('id') id: string, @Body('guests') guests: { name: string; gender?: string; whatsapp?: string }[]) {
    return this.bookings.adminSetGuests(decodeURIComponent(id), guests ?? []);
  }
}
