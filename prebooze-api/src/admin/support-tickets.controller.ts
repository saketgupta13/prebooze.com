import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminSupportTicketsService } from './support-tickets.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';
import type { StaffTokenPayload } from './staff-auth.guard';

const MODULE = 'Support tickets';
type StaffReq = { staff: StaffTokenPayload };

@Controller('admin/help-tickets')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminSupportTicketsController {
  constructor(private tickets: AdminSupportTicketsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list(@Query('status') status?: string) {
    return this.tickets.list(status);
  }

  @Get(':id')
  @RequirePermission(MODULE, 'view')
  get(@Param('id') id: string) {
    return this.tickets.get(id);
  }

  @Post(':id/reply')
  @RequirePermission(MODULE, 'edit')
  reply(@Param('id') id: string, @Body('message') message: string, @Req() req: StaffReq) {
    return this.tickets.reply(id, req.staff.staffId, message);
  }

  @Patch(':id')
  @RequirePermission(MODULE, 'approve')
  setStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.tickets.setStatus(id, status);
  }
}
