import { Module } from '@nestjs/common';
import { MarketingController, VenueMarketingController, AdminMarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { EmailService } from '../notifications/email';
import { WhatsappService } from '../notifications/whatsapp';
import { InvoicesService } from '../invoices/invoices.service';
import { PhonePeService } from '../payments/phonepe.service';
import { WalletService } from '../wallet/wallet.service';
import { StaffAlertsService } from '../notifications/staff-alerts';
import { AnalyticsReportService } from '../analytics/analytics-report.service';

@Module({
  controllers: [MarketingController, VenueMarketingController, AdminMarketingController],
  providers: [
    MarketingService, JwtAuthGuard, StaffAuthGuard, PermissionGuard,
    EmailService, WhatsappService, InvoicesService, PhonePeService, WalletService, StaffAlertsService, AnalyticsReportService,
  ],
  exports: [MarketingService],
})
export class MarketingModule {}
