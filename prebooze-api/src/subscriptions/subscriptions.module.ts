import { Module } from '@nestjs/common';
import { RazorpayWebhookController, PhonePeWebhookController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma.service';
import { RazorpayService } from '../payments/razorpay.service';
import { PhonePeService } from '../payments/phonepe.service';
import { EmailService } from '../notifications/email';
import { WhatsappService } from '../notifications/whatsapp';
import { StaffAlertsService } from '../notifications/staff-alerts';
import { WalletService } from '../wallet/wallet.service';
import { FeaturedModule } from '../featured/featured.module';
import { MarketingModule } from '../marketing/marketing.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [FeaturedModule, MarketingModule, BookingsModule],
  controllers: [RazorpayWebhookController, PhonePeWebhookController],
  providers: [SubscriptionsService, PrismaService, RazorpayService, PhonePeService, EmailService, WhatsappService, StaffAlertsService, WalletService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
