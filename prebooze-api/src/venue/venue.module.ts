import { Module } from '@nestjs/common';
import { VenueController, AdminVenueHostingController } from './venue.controller';
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
import { NotificationsService } from '../admin/notifications.service';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { MetaConversionsService } from '../meta/meta-conversions.service';
import { LeadsService } from '../admin/leads.service';

@Module({
  controllers: [VenueController, AdminVenueHostingController],
  providers: [
    VenueService, PrismaService, JwtAuthGuard, EmailService, WhatsappService, StaffAlertsService, RazorpayService,
    SubscriptionsService, StorageService, InvoicesService, WalletService, NotificationsService, StaffAuthGuard, PermissionGuard,
    MetaConversionsService, LeadsService,
  ],
})
export class VenueModule {}
