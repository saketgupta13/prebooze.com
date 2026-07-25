import { Module } from '@nestjs/common';
import { BookingsController, AdminBookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { HoldsService } from './holds.service';
import { RazorpayService } from '../payments/razorpay.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { PrismaService } from '../prisma.service';
import { redisProvider } from '../redis.provider';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { NotificationsService } from '../admin/notifications.service';
import { InvoicesService } from '../invoices/invoices.service';
import { StaffAlertsService } from '../notifications/staff-alerts';

// JwtModule is registered `global: true` in AuthModule, so JwtService is
// already available here without importing it again (see kyc.module.ts).
@Module({
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService, HoldsService, RazorpayService, WhatsappService, EmailService, PrismaService, redisProvider, JwtAuthGuard, StaffAuthGuard, PermissionGuard, NotificationsService, InvoicesService, StaffAlertsService],
})
export class BookingsModule {}
