import { Module } from '@nestjs/common';
import { OrganizerController, AdminEventsController } from './organizer.controller';
import { OrgTeamController, OrgRolesController } from './org-team.controller';
import { OrganizerService } from './organizer.service';
import { OrgTeamService } from './org-team.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { NotificationsService } from '../admin/notifications.service';
import { StaffAlertsService } from '../notifications/staff-alerts';
import { RazorpayService } from '../payments/razorpay.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { GuestListService } from '../admin/guestlist.service';
import { LiveMonitorService } from '../admin/live-monitor.service';
import { StorageService } from '../kyc/storage.service';

@Module({
  controllers: [OrganizerController, AdminEventsController, OrgTeamController, OrgRolesController],
  providers: [OrganizerService, OrgTeamService, PrismaService, JwtAuthGuard, StaffAuthGuard, PermissionGuard, WhatsappService, EmailService, NotificationsService, StaffAlertsService, RazorpayService, SubscriptionsService, GuestListService, LiveMonitorService, StorageService],
})
export class OrganizerModule {}
