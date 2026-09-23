import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Module({
  controllers: [WalletController],
  providers: [WalletService, JwtAuthGuard],
  exports: [WalletService],
})
export class WalletModule {}
