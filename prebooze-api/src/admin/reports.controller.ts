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
  finance(@Query('city') city?: string) {
    return this.reports.finance(city);
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
