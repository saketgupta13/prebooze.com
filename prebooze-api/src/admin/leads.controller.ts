import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Leads';

@Controller('admin/leads')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminLeadsController {
  constructor(private leads: LeadsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list() {
    return this.leads.list();
  }

  @Get('organizer-search')
  @RequirePermission(MODULE, 'view')
  searchOrganizers(@Query('q') q: string) {
    return this.leads.searchOrganizers(q);
  }

  @Get(':id')
  @RequirePermission(MODULE, 'view')
  get(@Param('id') id: string) {
    return this.leads.get(id);
  }

  @Post()
  @RequirePermission(MODULE, 'edit')
  create(@Body() body: Parameters<LeadsService['create']>[0]) {
    return this.leads.create(body);
  }

  @Patch(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Param('id') id: string, @Body() body: Parameters<LeadsService['update']>[1]) {
    return this.leads.update(id, body);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'edit')
  remove(@Param('id') id: string) {
    return this.leads.remove(id);
  }

  @Post(':id/activity')
  @RequirePermission(MODULE, 'edit')
  addActivity(@Param('id') id: string, @Body('text') text: string) {
    return this.leads.addActivity(id, text);
  }

  @Post(':id/link-organizer')
  @RequirePermission(MODULE, 'edit')
  linkOrganizer(@Param('id') id: string, @Body('organizerId') organizerId: string) {
    return this.leads.linkOrganizer(id, organizerId);
  }
}
