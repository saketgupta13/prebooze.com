import { Body, Controller, Get, Param, Delete, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { EmailTemplatesAdminService } from './email-templates-admin.service';
import { StaffAuthGuard, StaffTokenPayload } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Content';

@Controller('admin/email-templates')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminEmailTemplatesController {
  constructor(private svc: EmailTemplatesAdminService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list() {
    return this.svc.list();
  }

  @Post()
  @RequirePermission(MODULE, 'edit')
  create(@Body() body: { name?: string; subject?: string; bodyHtml?: string }, @Req() req: { staff: StaffTokenPayload }) {
    return this.svc.create(body, req.staff.email);
  }

  @Post(':id/send')
  @RequirePermission(MODULE, 'edit')
  sendNow(@Param('id') id: string, @Body('to') to: string) {
    return this.svc.sendNow(id, to);
  }

  @Get(':id/preview')
  @RequirePermission(MODULE, 'view')
  preview(@Param('id') id: string) {
    return this.svc.preview(id);
  }

  @Patch(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Param('id') id: string, @Body() patch: { subject?: string; bodyHtml?: string }, @Req() req: { staff: StaffTokenPayload }) {
    return this.svc.update(id, patch, req.staff.email);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'edit')
  reset(@Param('id') id: string) {
    return this.svc.reset(id);
  }
}
