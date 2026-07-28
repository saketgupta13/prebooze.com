import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { LineupService } from './lineup.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StorageService } from '../kyc/storage.service';
import { InvoicesService } from '../invoices/invoices.service';

type AuthedReq = { user: { sub: string; phone: string } };

/** Same route shape as /organizer, /promoter, /venue's self-serve +
 * subscription endpoints — see LineupService for scope. */
@Controller('lineup')
@UseGuards(JwtAuthGuard)
export class LineupController {
  constructor(
    private lineup: LineupService,
    private storage: StorageService,
    private invoices: InvoicesService,
  ) {}

  @Get('me')
  me(@Req() req: AuthedReq) {
    return this.lineup.me(req.user.sub);
  }

  @Get('events')
  events(@Req() req: AuthedReq) {
    return this.lineup.events(req.user.sub);
  }

  /** Real Featured billing history — same Invoice rows admin sees, filtered
   * to this line-up's own phone number, same pattern as
   * OrganizerController/VenueController's myInvoices/myInvoicePdf. */
  @Get('invoices')
  myInvoices(@Req() req: AuthedReq) {
    return this.invoices.mine('lineup', req.user.phone);
  }

  @Get('invoices/:id/pdf')
  async myInvoicePdf(@Req() req: AuthedReq, @Param('id') id: string, @Res() res: Response) {
    const { filename, buffer } = await this.invoices.pdfForOwner(id, 'lineup', req.user.phone);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  /** Real press-shot/logo upload — no ownership check (mirrors venue's
   * upload endpoint), since this is also used pre-approval during onboarding
   * before a Lineup row exists yet. */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required (max 20MB)');
    return { url: this.storage.save(file) };
  }

  @Patch('me')
  updateMe(@Req() req: AuthedReq, @Body() body: Parameters<LineupService['updateMe']>[1]) {
    return this.lineup.updateMe(req.user.sub, body);
  }

  @Get('subscription/tiers')
  subscriptionTiers() {
    return this.lineup.subscriptionTiers();
  }

  @Get('subscription')
  mySubscription(@Req() req: AuthedReq) {
    return this.lineup.mySubscription(req.user.sub);
  }

  @Post('subscription')
  subscribe(@Req() req: AuthedReq, @Body('tierId') tierId: string) {
    return this.lineup.subscribe(req.user.sub, tierId);
  }

  @Post('subscription/cancel')
  cancelSubscription(@Req() req: AuthedReq) {
    return this.lineup.cancelSubscription(req.user.sub);
  }
}
