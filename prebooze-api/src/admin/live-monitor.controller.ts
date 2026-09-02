import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { LiveMonitorService } from './live-monitor.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Gate check-in';

/** Overview across every currently-relevant event at once — see this
 * page's own doc comment on LiveMonitorService.overviewAll() for why it
 * exists. Separate controller (its own top-level path, not nested under
 * :eventId) since there's no single event in scope here. */
@Controller('admin/live-monitor')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminLiveMonitorOverviewController {
  constructor(private live: LiveMonitorService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  overview() {
    return this.live.overviewAll();
  }
}

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
