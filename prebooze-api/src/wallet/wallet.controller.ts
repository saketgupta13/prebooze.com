import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

type AuthedReq = { user: { sub: string } };

@Controller()
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private wallet: WalletService) {}

  @Get('wallet')
  wallet_(@Req() req: AuthedReq) {
    return this.wallet.wallet(req.user.sub);
  }

  @Get('pay-methods')
  list(@Req() req: AuthedReq) {
    return this.wallet.payMethods(req.user.sub);
  }

  @Post('pay-methods')
  add(@Req() req: AuthedReq, @Body() body: { type: 'upi' | 'card'; label: string; holder?: string; expiry?: string }) {
    return this.wallet.addPayMethod(req.user.sub, body);
  }

  @Delete('pay-methods/:id')
  remove(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.wallet.removePayMethod(req.user.sub, id);
  }

  @Post('pay-methods/:id/default')
  setDefault(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.wallet.setDefaultPayMethod(req.user.sub, id);
  }

  @Post('me/auto-renew')
  autoRenew(@Req() req: AuthedReq, @Body('on') on: boolean) {
    return this.wallet.setAutoRenew(req.user.sub, on);
  }
}
