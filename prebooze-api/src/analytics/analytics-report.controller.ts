import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsReportService } from './analytics-report.service';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { RequirePermission } from '../admin/permission.decorator';

const MODULE = 'Reports'; // a real PERM_MODULES entry that nothing else gated on yet

@Controller('admin/analytics')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminAnalyticsController {
  constructor(private analytics: AnalyticsReportService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  get(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('eventId') eventId?: string,
    @Query('city') city?: string,
    @Query('organizerId') organizerId?: string,
  ) {
    return this.analytics.get({ from, to, eventId, city, organizerId });
  }

  @Get('realtime')
  @RequirePermission(MODULE, 'view')
  realtime() {
    return this.analytics.realtime();
  }

  @Get('filters')
  @RequirePermission(MODULE, 'view')
  filters() {
    return this.analytics.filters();
  }
}
