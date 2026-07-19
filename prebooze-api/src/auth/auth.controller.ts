import { Body, Controller, Get, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';

class RequestOtpDto {
  @IsString() @IsNotEmpty() phone!: string;
}
class VerifyOtpDto {
  @IsString() @IsNotEmpty() requestId!: string;
  @IsString() @IsNotEmpty() code!: string;
}

@Controller()
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('auth/otp')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Post('auth/verify')
  verify(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.requestId, dto.code);
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
}
