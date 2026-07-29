import { Module } from '@nestjs/common';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { EmailService } from '../notifications/email';
import { WhatsappService } from '../notifications/whatsapp';
import { StaffAlertsService } from '../notifications/staff-alerts';
import { RazorpayService } from '../payments/razorpay.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { StorageService } from '../kyc/storage.service';
import { InvoicesService } from '../invoices/invoices.service';
import { WalletService } from '../wallet/wallet.service';

@Module({
  controllers: [VenueController],
  providers: [VenueService, PrismaService, JwtAuthGuard, EmailService, WhatsappService, StaffAlertsService, RazorpayService, SubscriptionsService, StorageService, InvoicesService, WalletService],
})
export class VenueModule {}
