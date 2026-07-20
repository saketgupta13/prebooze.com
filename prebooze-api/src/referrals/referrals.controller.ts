import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

type AuthedReq = { user: { sub: string } };

@Controller('referrals')
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(private referrals: ReferralsService) {}

  @Get()
  mine(@Req() req: AuthedReq) {
    return this.referrals.mine(req.user.sub);
  }

  @Post('claim')
  claim(@Req() req: AuthedReq, @Body('code') code: string) {
    return this.referrals.claim(req.user.sub, code);
  }
}
