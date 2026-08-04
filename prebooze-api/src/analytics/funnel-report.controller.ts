import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FunnelReportService } from './funnel-report.service';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { RequirePermission } from '../admin/permission.decorator';

const MODULE = 'Reports'; // a real PERM_MODULES entry that nothing else gated on yet

@Controller('admin/funnel')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminFunnelController {
  constructor(private funnel: FunnelReportService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  get(@Query('from') from?: string, @Query('to') to?: string, @Query('eventId') eventId?: string) {
    return this.funnel.get(from, to, eventId);
  }
}
