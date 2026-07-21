import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { GuestListService } from './guestlist.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';
import type { StaffTokenPayload } from './staff-auth.guard';

const MODULE = 'Gate check-in'; // a direct PERM_MODULES fit — first endpoints to use it

type StaffReq = { staff: StaffTokenPayload };

@Controller('admin/events/:eventId/guest-list')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminGuestListController {
  constructor(private guestList: GuestListService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list(@Param('eventId') eventId: string) {
    return this.guestList.list(eventId);
  }

  @Post()
  @RequirePermission(MODULE, 'edit')
  add(@Param('eventId') eventId: string, @Req() req: StaffReq, @Body() body: Parameters<GuestListService['add']>[2]) {
    return this.guestList.add(eventId, req.staff.email, body);
  }
}

@Controller('admin/guest-list')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminGuestListEntryController {
  constructor(private guestList: GuestListService) {}

  @Post(':id/toggle-arrived')
  @RequirePermission(MODULE, 'edit')
  toggleArrived(@Param('id') id: string) {
    return this.guestList.toggleArrived(id);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'edit')
  remove(@Param('id') id: string) {
    return this.guestList.remove(id);
  }
}
