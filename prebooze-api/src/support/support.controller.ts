import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

type AuthedReq = { user: { sub: string } };

@Controller('support')
export class SupportController {
  constructor(private support: SupportService) {}

  @Get('tickets')
  @UseGuards(JwtAuthGuard)
  tickets(@Req() req: AuthedReq) {
    return this.support.tickets(req.user.sub);
  }

  @Post('tickets')
  @UseGuards(JwtAuthGuard)
  raise(@Req() req: AuthedReq, @Body() body: { topic?: string; subject?: string; message?: string }) {
    return this.support.raise(req.user.sub, body);
  }

  /** Public — the Contact-us page is reachable logged-out (press, would-be
   * organizers, anyone without an account yet), unlike every other support
   * entry point here. */
  @Post('contact')
  contact(@Body() body: { name?: string; email?: string; role?: string; message?: string }) {
    return this.support.contact(body);
  }
}
