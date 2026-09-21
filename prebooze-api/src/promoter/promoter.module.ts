import { Module } from '@nestjs/common';
import { PromoterController, GuestCaptureController } from './promoter.controller';
import { PromoterService } from './promoter.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { StaffAlertsService } from '../notifications/staff-alerts';

import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../admin/notifications.service';
import { StorageService } from '../kyc/storage.service';
import { InvoicesService } from '../invoices/invoices.service';

@Module({
  controllers: [PromoterController, GuestCaptureController],
  providers: [PromoterService, PrismaService, JwtAuthGuard, WhatsappService, EmailService, StaffAlertsService, SubscriptionsService, WalletService, NotificationsService, StorageService, InvoicesService],
})
export class PromoterModule {}
