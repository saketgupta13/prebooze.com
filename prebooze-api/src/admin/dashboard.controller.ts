import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { StaffAuthGuard } from './staff-auth.guard';

/** No PermissionGuard — every staff role sees the same overview, matching
 * the mock (Dashboard.tsx isn't gated per role either). */
@Controller('admin/dashboard')
@UseGuards(StaffAuthGuard)
export class AdminDashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get()
  get(@Query('days') days?: string, @Query('city') city?: string) {
    return this.dashboard.overview(days ? parseInt(days, 10) : undefined, city);
  }
}
