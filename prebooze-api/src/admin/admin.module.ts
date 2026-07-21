import { Module } from '@nestjs/common';
import { StaffAuthController } from './staff-auth.controller';
import { AdminStaffController, AdminRolesController } from './staff.controller';
import { AdminCustomersController } from './customers.controller';
import { AdminOrganizersController, AdminPromotersController, AdminLineupsController, AdminVenuesController } from './directory.controller';
import { AdminCmsController } from './cms.controller';
import { AdminLocationsController } from './locations.controller';
import { AdminCareersController } from './careers-admin.controller';
import { AdminReelsController } from './reels.controller';
import { AdminLedgerController } from './ledger.controller';
import { AdminReportsController, AdminSettingsController } from './reports.controller';
import { AdminGuestListController, AdminGuestListEntryController } from './guestlist.controller';
import { AdminLiveMonitorController } from './live-monitor.controller';
import { AdminNotificationsController } from './notifications.controller';
import { AdminDashboardController } from './dashboard.controller';
import { StaffAuthService } from './staff-auth.service';
import { StaffService } from './staff.service';
import { CustomersService } from './customers.service';
import { DirectoryService } from './directory.service';
import { CmsService } from './cms.service';
import { LocationsService } from './locations.service';
import { CareersAdminService } from './careers-admin.service';
import { ReelsService } from './reels.service';
import { LedgerService } from './ledger.service';
import { ReportsService } from './reports.service';
import { GuestListService } from './guestlist.service';
import { LiveMonitorService } from './live-monitor.service';
import { NotificationsService } from './notifications.service';
import { DashboardService } from './dashboard.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { OwnerOnlyGuard } from './owner-only.guard';
import { PermissionGuard } from './permission.guard';
import { PrismaService } from '../prisma.service';

// JwtModule is registered `global: true` in AuthModule, so JwtService is
// already available here without importing it again (see kyc.module.ts).
@Module({
  controllers: [
    StaffAuthController,
    AdminStaffController,
    AdminRolesController,
    AdminCustomersController,
    AdminOrganizersController,
    AdminPromotersController,
    AdminLineupsController,
    AdminVenuesController,
    AdminCmsController,
    AdminLocationsController,
    AdminCareersController,
    AdminReelsController,
    AdminLedgerController,
    AdminReportsController,
    AdminSettingsController,
    AdminGuestListController,
    AdminGuestListEntryController,
    AdminLiveMonitorController,
    AdminNotificationsController,
    AdminDashboardController,
  ],
  providers: [
    StaffAuthService,
    StaffService,
    CustomersService,
    DirectoryService,
    CmsService,
    LocationsService,
    CareersAdminService,
    ReelsService,
    LedgerService,
    ReportsService,
    GuestListService,
    LiveMonitorService,
    NotificationsService,
    DashboardService,
    StaffAuthGuard,
    OwnerOnlyGuard,
    PermissionGuard,
    PrismaService,
  ],
  exports: [StaffAuthGuard, PermissionGuard],
})
export class AdminModule {}
