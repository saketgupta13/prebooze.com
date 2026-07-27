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
import { GuestListService } from '../admin/guestlist.service';
import { LiveMonitorService } from '../admin/live-monitor.service';
import { StorageService } from '../kyc/storage.service';
import { InvoicesService } from '../invoices/invoices.service';

@Module({
  controllers: [OrganizerController, AdminEventsController, OrgTeamController, OrgRolesController],
  providers: [OrganizerService, OrgTeamService, PrismaService, JwtAuthGuard, StaffAuthGuard, PermissionGuard, WhatsappService, EmailService, NotificationsService, StaffAlertsService, GuestListService, LiveMonitorService, StorageService, InvoicesService],
})
export class OrganizerModule {}
