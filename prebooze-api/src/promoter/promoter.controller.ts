import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PromoterService } from './promoter.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StorageService } from '../kyc/storage.service';
import { InvoicesService } from '../invoices/invoices.service';

type AuthedReq = { user: { sub: string; phone: string } };

@Controller('promoter')
@UseGuards(JwtAuthGuard)
export class PromoterController {
  constructor(
    private promoter: PromoterService,
    private storage: StorageService,
    private invoices: InvoicesService,
  ) {}

  @Get('me')
  me(@Req() req: AuthedReq) {
    return this.promoter.me(req.user.sub);
  }

  @Patch('me')
  updateMe(@Req() req: AuthedReq, @Body() body: Parameters<PromoterService['updateMe']>[1]) {
    return this.promoter.updateMe(req.user.sub, body);
  }

  /** Real file upload for the promoter's own profile logo — same local-disk
   * StorageService as organizer/venue/lineup uploads, just promoter-scoped.
   * me() throwing ForbiddenException for a non-promoter is what keeps this
   * from being free anonymous file storage for any authenticated user, same
   * guard organizer.controller.ts's own upload endpoint documents needing. */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 80 * 1024 * 1024 } }))
  async upload(@Req() req: AuthedReq, @UploadedFile() file?: Express.Multer.File) {
    await this.promoter.me(req.user.sub);
    if (!file) throw new BadRequestException('file is required (max 80MB)');
    return { url: await this.storage.save(file) };
  }

  /** Real Featured billing history — same Invoice rows admin sees, filtered
   * to this promoter's own phone, same pattern as organizer/venue/lineup's
   * myInvoices/myInvoicePdf. */
  @Get('invoices')
  myInvoices(@Req() req: AuthedReq) {
    return this.invoices.mine('promoter', req.user.phone);
  }

  @Get('invoices/:id/pdf')
  async myInvoicePdf(@Req() req: AuthedReq, @Param('id') id: string, @Res() res: Response) {
    const { filename, buffer } = await this.invoices.pdfForOwner(id, 'promoter', req.user.phone);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Get('promotions')
  promotions(@Req() req: AuthedReq) {
    return this.promoter.promotions(req.user.sub);
  }

  @Get('events/:id/guests')
  guests(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.promoter.guests(req.user.sub, id);
  }

  @Get('events/:id/paid-guests')
  paidGuests(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.promoter.paidGuests(req.user.sub, id);
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
  addTeamMember(@Req() req: AuthedReq, @Body() body: { handle?: string; name?: string; hue?: number; payoutSplitPct?: number; monthlyQuotaShare?: number | null }) {
    return this.promoter.addTeamMember(req.user.sub, body);
  }

  @Patch('team/:id')
  updateTeamMember(@Req() req: AuthedReq, @Param('id') id: string, @Body() body: { payoutSplitPct?: number; monthlyQuotaShare?: number | null }) {
    return this.promoter.updateTeamMember(req.user.sub, id, body);
  }

  @Delete('team/:id')
  removeTeamMember(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.promoter.removeTeamMember(req.user.sub, id);
  }

  @Get('team/earnings')
  teamEarnings(@Req() req: AuthedReq) {
    return this.promoter.teamEarnings(req.user.sub);
  }

  @Post('team/:id/events/:eventId/mark-paid')
  markTeamMemberPaid(@Req() req: AuthedReq, @Param('id') id: string, @Param('eventId') eventId: string) {
    return this.promoter.markTeamMemberPaid(req.user.sub, id, eventId);
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
    @Body() body: { name?: string; phone?: string; age?: string; gender?: string; subPromoter?: string; companions?: { name?: string }[] },
  ) {
    return this.promoter.captureGuest(eventSlug, promoterSlug, body);
  }
}
