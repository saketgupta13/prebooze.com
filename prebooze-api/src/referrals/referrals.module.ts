import { Module } from '@nestjs/common';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Module({
  controllers: [ReferralsController],
  providers: [ReferralsService, PrismaService, WhatsappService, JwtAuthGuard],
})
export class ReferralsModule {}
