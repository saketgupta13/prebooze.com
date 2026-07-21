import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { StaffAuthGuard } from './staff-auth.guard';

/** No PermissionGuard/module gate — a global shared feed any authenticated
 * staff member can see, matching the mock (NotificationsPanel isn't
 * role-filtered at all). */
@Controller('admin/notifications')
@UseGuards(StaffAuthGuard)
export class AdminNotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  list() {
    return this.notifications.list();
  }

  @Post(':id/read')
  markRead(@Param('id') id: string) {
    return this.notifications.markRead(id);
  }

  @Post('mark-all-read')
  markAllRead() {
    return this.notifications.markAllRead();
  }
}
