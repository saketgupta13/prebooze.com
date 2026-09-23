import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { EmailService } from '../notifications/email';
import { StaffAlertsService } from '../notifications/staff-alerts';
// StaffAlertsService itself depends on WhatsappService (it alerts staff over
// WhatsApp) — still needed as a provider here even though SupportService no
// longer calls wa.send() directly for the ticket-raise flow.
import { WhatsappService } from '../notifications/whatsapp';

@Module({
  controllers: [SupportController],
  providers: [SupportService, PrismaService, JwtAuthGuard, EmailService, StaffAlertsService, WhatsappService],
})
export class SupportModule {}
