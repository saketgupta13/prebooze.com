import { Module } from '@nestjs/common';
import { PromoterController, GuestCaptureController } from './promoter.controller';
import { PromoterService } from './promoter.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { WhatsappService } from '../notifications/whatsapp';

@Module({
  controllers: [PromoterController, GuestCaptureController],
  providers: [PromoterService, PrismaService, JwtAuthGuard, WhatsappService],
})
export class PromoterModule {}
