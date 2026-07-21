import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

type AuthedReq = { user: { sub: string } };

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private support: SupportService) {}

  @Get('tickets')
  tickets(@Req() req: AuthedReq) {
    return this.support.tickets(req.user.sub);
  }

  @Post('tickets')
  raise(@Req() req: AuthedReq, @Body() body: { topic?: string; subject?: string; message?: string }) {
    return this.support.raise(req.user.sub, body);
  }
}
