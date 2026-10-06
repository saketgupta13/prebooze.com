import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import type { SettingsInput } from './reports.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

// Split 2026-10-06 — previously both shared 'Payments & payouts', which
// also gates real payout-moving actions (mark-paid, advancing a
// withdrawal). A Finance role that only needed to READ reports had no way
// to get that without also being able to trigger real payouts, and Staff &
// Roles had no "Reports" checkbox to grant at all — see
// permissions.util.ts's resolvePermissions for how an existing role's
// access carries over automatically. Settings stays on 'Payments &
// payouts' — it's genuinely payout/GST-rate configuration, not a report.
const REPORTS_MODULE = 'Financial reports';
const SETTINGS_MODULE = 'Payments & payouts';

@Controller('admin/reports')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminReportsController {
  constructor(private reports: ReportsService) {}

  @Get('finance')
  @RequirePermission(REPORTS_MODULE, 'view')
  finance(@Query('city') city?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.finance(city, from, to);
  }

  @Get('daily')
  @RequirePermission(REPORTS_MODULE, 'view')
  daily(@Query('city') city?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.daily(city, from, to);
  }

  @Get('refunds')
  @RequirePermission(REPORTS_MODULE, 'view')
  refunds(@Query('city') city?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.refunds(city, from, to);
  }

  @Get('attendance')
  @RequirePermission(REPORTS_MODULE, 'view')
  attendance(@Query('city') city?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.attendance(city, from, to);
  }

  // Monthly CA-facing exports — 'month' is a plain "YYYY-MM" string, not a
  // from/to range, since both reports are inherently calendar-month filings
  // (GST return, GSTR-8).
  @Get('gst')
  @RequirePermission(REPORTS_MODULE, 'view')
  gst(@Query('month') month: string) {
    return this.reports.gst(month);
  }

  @Get('tcs')
  @RequirePermission(REPORTS_MODULE, 'view')
  tcs(@Query('month') month: string) {
    return this.reports.tcs(month);
  }
}

@Controller('admin/settings')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminSettingsController {
  constructor(private reports: ReportsService) {}

  @Get()
  @RequirePermission(SETTINGS_MODULE, 'view')
  get() {
    return this.reports.settings();
  }

  @Patch()
  @RequirePermission(SETTINGS_MODULE, 'edit')
  update(@Body() body: SettingsInput) {
    return this.reports.updateSettings(body);
  }
}
