import { Module } from '@nestjs/common';
import { LineupController } from './lineup.controller';
import { LineupService } from './lineup.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { EmailService } from '../notifications/email';
import { WhatsappService } from '../notifications/whatsapp';
import { StaffAlertsService } from '../notifications/staff-alerts';

import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { StorageService } from '../kyc/storage.service';
import { InvoicesService } from '../invoices/invoices.service';
import { WalletService } from '../wallet/wallet.service';

@Module({
  controllers: [LineupController],
  providers: [LineupService, JwtAuthGuard, EmailService, WhatsappService, StaffAlertsService, SubscriptionsService, StorageService, InvoicesService, WalletService],
})
export class LineupModule {}
