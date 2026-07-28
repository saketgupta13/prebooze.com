import { BadRequestException, Body, Controller, Get, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LineupService } from './lineup.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StorageService } from '../kyc/storage.service';

type AuthedReq = { user: { sub: string } };

/** Same route shape as /organizer, /promoter, /venue's self-serve +
 * subscription endpoints — see LineupService for scope. */
@Controller('lineup')
@UseGuards(JwtAuthGuard)
export class LineupController {
  constructor(
    private lineup: LineupService,
    private storage: StorageService,
  ) {}

  @Get('me')
  me(@Req() req: AuthedReq) {
    return this.lineup.me(req.user.sub);
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
