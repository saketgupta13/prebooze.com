import { BadRequestException, Body, Controller, Get, HttpCode, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { StorageService } from '../kyc/storage.service';

class RequestOtpDto {
  @IsString() @IsNotEmpty() phone!: string;
}
class VerifyOtpDto {
  @IsString() @IsNotEmpty() requestId!: string;
  @IsString() @IsNotEmpty() code!: string;
}

@Controller()
export class AuthController {
  constructor(
    private auth: AuthService,
    private storage: StorageService,
  ) {}

  @Post('auth/otp')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Post('auth/verify')
  verify(
    @Body() dto: VerifyOtpDto,
    @Req() req: { headers: { 'user-agent'?: string; 'x-forwarded-for'?: string }; socket?: { remoteAddress?: string } },
  ) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;
    return this.auth.verifyOtp(dto.requestId, dto.code, { ip, userAgent: req.headers['user-agent'] });
  }

  @Post('auth/logout')
  @HttpCode(204)
  logout() {
    // stateless JWT — the client discards its token
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { sub: string } }) {
    return this.auth.me(req.user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Req() req: { user: { sub: string } }, @Body() patch: Record<string, unknown>) {
    return this.auth.updateMe(req.user.sub, patch);
  }

  /** Real guest avatar upload — same local-disk StorageService as every
   * other role's logo upload (organizer/venue/lineup), just guest-scoped.
   * Guests had no real photo upload at all before this. */
  @Post('me/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required (max 20MB)');
    return { url: await this.storage.save(file) };
  }

  /** Awards the one-time 10%-off coupon for finishing the soft-required
   * "complete your profile" step — see AuthService.claimProfileCompletionReward
   * for the real field-completeness check and idempotency (a second call
   * after the first successful claim just returns the same code again). */
  @Post('me/complete-profile-reward')
  @UseGuards(JwtAuthGuard)
  claimProfileCompletionReward(@Req() req: { user: { sub: string } }) {
    return this.auth.claimProfileCompletionReward(req.user.sub);
  }

  @Post('me/phone/request-change')
  @UseGuards(JwtAuthGuard)
  requestPhoneChange(@Req() req: { user: { sub: string } }, @Body('newPhone') newPhone: string) {
    return this.auth.requestPhoneChange(req.user.sub, newPhone);
  }

  @Post('me/phone/confirm-change')
  @UseGuards(JwtAuthGuard)
  confirmPhoneChange(@Req() req: { user: { sub: string } }, @Body() dto: VerifyOtpDto) {
    return this.auth.confirmPhoneChange(req.user.sub, dto.requestId, dto.code);
  }
}
