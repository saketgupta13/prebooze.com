import { Module } from '@nestjs/common';
import { KycController, AdminKycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { StorageService } from './storage.service';
import { KycProviderService } from './kyc-provider.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { NotificationsService } from '../admin/notifications.service';
import { EmailService } from '../notifications/email';
import { WhatsappService } from '../notifications/whatsapp';
import { StaffAlertsService } from '../notifications/staff-alerts';

// JwtModule is registered `global: true` in AuthModule, so JwtService (used
// by JwtAuthGuard/StaffAuthGuard here) is already available without
// importing it again.
@Module({
  controllers: [KycController, AdminKycController],
  providers: [KycService, StorageService, KycProviderService, PrismaService, JwtAuthGuard, StaffAuthGuard, PermissionGuard, NotificationsService, EmailService, WhatsappService, StaffAlertsService],
})
export class KycModule {}
