import { Module } from '@nestjs/common';
import { FeaturedController, AdminFeaturedController } from './featured.controller';
import { FeaturedService } from './featured.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { InvoicesService } from '../invoices/invoices.service';
import { RazorpayService } from '../payments/razorpay.service';
import { WalletService } from '../wallet/wallet.service';
import { StaffAlertsService } from '../notifications/staff-alerts';

@Module({
  controllers: [FeaturedController, AdminFeaturedController],
  providers: [
    FeaturedService, PrismaService, JwtAuthGuard, StaffAuthGuard, PermissionGuard,
    WhatsappService, EmailService, InvoicesService, RazorpayService, WalletService, StaffAlertsService,
  ],
  exports: [FeaturedService],
})
export class FeaturedModule {}
