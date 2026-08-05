import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { OrganizerService } from './organizer.service';
import type { EventInput } from './organizer.service';
import { OrgAccessService } from './org-access.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { RequirePermission } from '../admin/permission.decorator';
import { StorageService } from '../kyc/storage.service';
import { InvoicesService } from '../invoices/invoices.service';

type AuthedReq = { user: { sub: string; phone: string } };

@Controller('organizer')
@UseGuards(JwtAuthGuard)
export class OrganizerController {
  constructor(
    private organizer: OrganizerService,
    private storage: StorageService,
    private invoices: InvoicesService,
    private orgAccess: OrgAccessService,
  ) {}

  @Get('me')
  me(@Req() req: AuthedReq) {
    return this.organizer.me(req.user.sub);
  }

  /** Real file upload for event media (poster, gallery, teaser, social
   * banners) at creation time — same local-disk StorageService as
   * venue/admin uploads, just organizer-scoped. Previously had no
   * organizer/permission check at all (any authenticated user, including a
   * plain guest, could call this as anonymous file storage) — now requires
   * real "Events & wizard" edit access, same as the event save itself. */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 80 * 1024 * 1024 } }))
  async upload(@Req() req: AuthedReq, @UploadedFile() file?: Express.Multer.File) {
    await this.orgAccess.require(req.user.sub, 'Events & wizard', 'edit');
    if (!file) throw new BadRequestException('file is required (max 80MB)');
    return { url: await this.storage.save(file) };
  }

  @Patch('me')
  updateMe(@Req() req: AuthedReq, @Body() body: Parameters<OrganizerService['updateMe']>[1]) {
    return this.organizer.updateMe(req.user.sub, body);
  }

  /** Real Featured billing history — same Invoice rows admin sees, filtered
   * to this organizer's own phone number (see InvoicesService.mine).
   * Owner-only: billing/invoices don't map onto any team-role permission
   * module, and filtering by phone specifically means a team member's own
   * phone wouldn't even return the right rows. */
  @Get('invoices')
  async myInvoices(@Req() req: AuthedReq) {
    await this.orgAccess.requireOwner(req.user.sub);
    return this.invoices.mine('organizer', req.user.phone);
  }

  @Get('invoices/:id/pdf')
  async myInvoicePdf(@Req() req: AuthedReq, @Param('id') id: string, @Res() res: Response) {
    await this.orgAccess.requireOwner(req.user.sub);
    const { filename, buffer } = await this.invoices.pdfForOwner(id, 'organizer', req.user.phone);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

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

  @Get('promoter-payouts')
  promoterPayouts(@Req() req: AuthedReq) {
    return this.organizer.promoterPayouts(req.user.sub);
  }

  @Get('promoters')
  promoters(@Req() req: AuthedReq) {
    return this.organizer.promoters(req.user.sub);
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

  // ---------- gate ops: guest list, promoter guests, live monitor ----------

  @Get('events/:id/guest-list')
  guestList(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.organizer.guestList(req.user.sub, id);
  }

  @Post('events/:id/guest-list')
  addGuestListEntry(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.organizer.addGuestListEntry(req.user.sub, id, body);
  }

  @Post('guest-list/:id/toggle-arrived')
  toggleGuestArrived(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.organizer.toggleGuestArrived(req.user.sub, id);
  }

  @Delete('guest-list/:id')
  removeGuestListEntry(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.organizer.removeGuestListEntry(req.user.sub, id);
  }

  @Get('events/:id/promoter-guests')
  promoterGuests(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.organizer.promoterGuests(req.user.sub, id);
  }

  @Get('events/:id/live')
  live(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.organizer.live(req.user.sub, id);
  }

  @Post('events/:id/check-in')
  manualCheckIn(@Req() req: AuthedReq, @Param('id') id: string, @Body('name') name: string, @Body('count') count?: number) {
    return this.organizer.manualCheckIn(req.user.sub, id, name, count);
  }

  @Patch('events/:id/pause-sales')
  setSalesPaused(@Req() req: AuthedReq, @Param('id') id: string, @Body('paused') paused: boolean) {
    return this.organizer.setSalesPaused(req.user.sub, id, paused);
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

  // Full admin event CRUD — closes the gap flagged in the media-upload
  // slice: EventEditor.tsx's addEvent/updateEvent cover the whole event
  // surface (title/tiers/venue/lineup/rules/etc.), not just approve/reject.
  @Post()
  @RequirePermission('Events & approvals', 'edit')
  create(@Body() body: Parameters<OrganizerService['adminUpsertEvent']>[0]) {
    return this.organizer.adminUpsertEvent(body);
  }

  @Patch(':id')
  @RequirePermission('Events & approvals', 'edit')
  update(@Param('id') id: string, @Body() body: Omit<Parameters<OrganizerService['adminUpsertEvent']>[0], 'id'>) {
    return this.organizer.adminUpsertEvent({ ...body, id });
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
