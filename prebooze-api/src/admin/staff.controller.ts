import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { OwnerOnlyGuard } from './owner-only.guard';

@Controller('admin/staff')
@UseGuards(StaffAuthGuard, OwnerOnlyGuard)
export class AdminStaffController {
  constructor(private staff: StaffService) {}

  @Get()
  list() {
    return this.staff.listStaff();
  }

  @Post()
  create(@Body() body: Parameters<StaffService['createStaff']>[0]) {
    return this.staff.createStaff(body);
  }

  @Patch(':id')
  updateRole(@Param('id') id: string, @Body('roleName') roleName: string) {
    return this.staff.updateStaffRole(id, roleName);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.staff.removeStaff(id);
  }
}

@Controller('admin/roles')
@UseGuards(StaffAuthGuard, OwnerOnlyGuard)
export class AdminRolesController {
  constructor(private staff: StaffService) {}

  @Get()
  list() {
    return this.staff.listRoles();
  }

  @Post()
  add(@Body() body: { name: string; defaultOpen?: boolean }) {
    return this.staff.addRole(body.name, body.defaultOpen ?? false);
  }

  @Patch(':name')
  setPerm(@Param('name') name: string, @Body() body: { module: string; key: 'view' | 'edit' | 'approve'; value: boolean }) {
    return this.staff.setRolePerm(name, body.module, body.key, body.value);
  }

  @Patch(':name/default-open')
  setDefaultOpen(@Param('name') name: string, @Body('value') value: boolean) {
    return this.staff.setRoleDefaultOpen(name, value);
  }

  @Delete(':name')
  remove(@Param('name') name: string) {
    return this.staff.removeRole(name);
  }
}
