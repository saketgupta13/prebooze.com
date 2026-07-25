import { Module } from '@nestjs/common';
import { RazorpayWebhookController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma.service';
import { RazorpayService } from '../payments/razorpay.service';
import { EmailService } from '../notifications/email';
import { WhatsappService } from '../notifications/whatsapp';
import { StaffAlertsService } from '../notifications/staff-alerts';

@Module({
  controllers: [RazorpayWebhookController],
  providers: [SubscriptionsService, PrismaService, RazorpayService, EmailService, WhatsappService, StaffAlertsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
