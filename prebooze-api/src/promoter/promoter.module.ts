import { Module } from '@nestjs/common';
import { PromoterController, GuestCaptureController } from './promoter.controller';
import { PromoterService } from './promoter.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { StaffAlertsService } from '../notifications/staff-alerts';
import { RazorpayService } from '../payments/razorpay.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { WalletService } from '../wallet/wallet.service';

@Module({
  controllers: [PromoterController, GuestCaptureController],
  providers: [PromoterService, PrismaService, JwtAuthGuard, WhatsappService, EmailService, StaffAlertsService, RazorpayService, SubscriptionsService, WalletService],
})
export class PromoterModule {}
