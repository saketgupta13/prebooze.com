import { Module } from '@nestjs/common';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Module({
  controllers: [ReferralsController],
  providers: [ReferralsService, WhatsappService, EmailService, JwtAuthGuard],
})
export class ReferralsModule {}
