import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import type { SettingsInput } from './reports.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Payments & payouts'; // closest fit — reports are inherently cross-cutting financial data

@Controller('admin/reports')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminReportsController {
  constructor(private reports: ReportsService) {}

  @Get('finance')
  @RequirePermission(MODULE, 'view')
  finance(@Query('city') city?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.finance(city, from, to);
  }

  @Get('daily')
  @RequirePermission(MODULE, 'view')
  daily(@Query('city') city?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.daily(city, from, to);
  }

  @Get('refunds')
  @RequirePermission(MODULE, 'view')
  refunds(@Query('city') city?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.refunds(city, from, to);
  }

  @Get('attendance')
  @RequirePermission(MODULE, 'view')
  attendance(@Query('city') city?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.attendance(city, from, to);
  }
}

@Controller('admin/settings')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminSettingsController {
  constructor(private reports: ReportsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  get() {
    return this.reports.settings();
  }

  @Patch()
  @RequirePermission(MODULE, 'edit')
  update(@Body() body: SettingsInput) {
    return this.reports.updateSettings(body);
  }
}
