import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { LiveMonitorService } from './live-monitor.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Gate check-in';

@Controller('admin/events/:eventId/live')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminLiveMonitorController {
  constructor(private live: LiveMonitorService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  get(@Param('eventId') eventId: string) {
    return this.live.live(eventId);
  }

  @Post('check-in')
  @RequirePermission(MODULE, 'edit')
  checkIn(@Param('eventId') eventId: string, @Body('name') name: string, @Body('count') count?: number) {
    return this.live.manualCheckIn(eventId, name, count);
  }
}
