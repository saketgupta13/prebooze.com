import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

/** Gated on its own "Dashboard" module as of the expanded-permissions
 * slice — every seeded role defaults it to view-only-true, preserving the
 * original "everyone sees it" behavior, but it's now a real toggle an
 * Owner can turn off for a narrowly-scoped custom role. */
@Controller('admin/dashboard')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminDashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get()
  @RequirePermission('Dashboard', 'view')
  get(@Query('days') days?: string, @Query('city') city?: string) {
    return this.dashboard.overview(days ? parseInt(days, 10) : undefined, city);
  }
}
