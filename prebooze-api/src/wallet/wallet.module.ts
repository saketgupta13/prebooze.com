import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Module({
  controllers: [WalletController],
  providers: [WalletService, PrismaService, JwtAuthGuard],
})
export class WalletModule {}
