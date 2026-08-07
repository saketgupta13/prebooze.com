import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { VenueService } from './venue.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StorageService } from '../kyc/storage.service';
import { InvoicesService } from '../invoices/invoices.service';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { RequirePermission } from '../admin/permission.decorator';
import type { StaffTokenPayload } from '../admin/staff-auth.guard';

type AuthedReq = { user: { sub: string; phone: string } };
type StaffReq = { staff: StaffTokenPayload };

@Controller('venue')
@UseGuards(JwtAuthGuard)
export class VenueController {
  constructor(
    private venue: VenueService,
    private storage: StorageService,
    private invoices: InvoicesService,
  ) {}

  /** Real Featured billing history — same Invoice rows admin sees, filtered
   * to this venue partner's own phone number (see InvoicesService.mine),
   * same pattern as OrganizerController's myInvoices/myInvoicePdf. */
  @Get('invoices')
  myInvoices(@Req() req: AuthedReq) {
    return this.invoices.mine('venue', req.user.phone);
  }

  @Get('invoices/:id/pdf')
  async myInvoicePdf(@Req() req: AuthedReq, @Param('id') id: string, @Res() res: Response) {
    const { filename, buffer } = await this.invoices.pdfForOwner(id, 'venue', req.user.phone);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  /** Onboarding's license/address-proof fields are plain string URLs, not
   * multipart uploads (see VenueService.onboard) — this is what produces
   * those URLs, same local-disk StorageService as KYC docs / admin media. */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required (max 20MB)');
    return { url: await this.storage.save(file) };
  }

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

  // ---------- hosting (opt-in, admin-gated — see VenueService doc comments) ----------

  @Get('hosting')
  hostingStatus(@Req() req: AuthedReq) {
    return this.venue.hostingStatus(req.user.sub);
  }

  @Post('hosting/request')
  requestHosting(@Req() req: AuthedReq) {
    return this.venue.requestHosting(req.user.sub);
  }

  @Get('hosting/events')
  hostedEvents(@Req() req: AuthedReq) {
    return this.venue.hostedEvents(req.user.sub);
  }

  @Post('hosting/events')
  saveHostedEvent(@Req() req: AuthedReq, @Body() body: Parameters<VenueService['saveHostedEvent']>[1]) {
    return this.venue.saveHostedEvent(req.user.sub, body);
  }

  @Get('hosting/ledger')
  myLedger(@Req() req: AuthedReq) {
    return this.venue.myLedger(req.user.sub);
  }

  @Post('hosting/withdraw')
  withdraw(@Req() req: AuthedReq, @Body('amount') amount: number) {
    return this.venue.withdraw(req.user.sub, amount);
  }

  @Get('hosting/collaborator-options')
  collaboratorOptions() {
    return this.venue.collaboratorOptions();
  }
}

/** Admin review queue for venue hosting requests — the "Contacted ✓" gate
 * (see VenueHostingRequest doc comment) lives entirely here: approve is a
 * real BadRequestException, not just a hidden button, until contacted is
 * ticked first. Gated on the same 'Venues' permission module the rest of
 * venue directory management already uses. */
@Controller('admin/venues/hosting-requests')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminVenueHostingController {
  constructor(private venue: VenueService) {}

  @Get()
  @RequirePermission('Venues', 'view')
  list(@Query('status') status?: string) {
    return this.venue.listHostingRequests(status);
  }

  @Post(':id/contacted')
  @RequirePermission('Venues', 'approve')
  markContacted(@Param('id') id: string) {
    return this.venue.markHostingRequestContacted(id);
  }

  @Post(':id/approve')
  @RequirePermission('Venues', 'approve')
  approve(@Req() req: StaffReq, @Param('id') id: string) {
    return this.venue.approveHostingRequest(id, req.staff.email);
  }

  @Post(':id/reject')
  @RequirePermission('Venues', 'approve')
  reject(@Req() req: StaffReq, @Param('id') id: string, @Body('reviewNote') reviewNote?: string) {
    return this.venue.rejectHostingRequest(id, reviewNote, req.staff.email);
  }
}
