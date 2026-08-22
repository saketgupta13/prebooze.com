import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

@Controller('admin/customers')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminCustomersController {
  constructor(private customers: CustomersService) {}

  @Get()
  @RequirePermission('Customers', 'view')
  list(@Query('segment') segment?: 'guests' | 'organizers') {
    return this.customers.list(segment);
  }

  @Get(':id')
  @RequirePermission('Customers', 'view')
  get(@Param('id') id: string) {
    return this.customers.get(id);
  }

  @Post()
  @RequirePermission('Customers', 'edit')
  create(@Body() body: Parameters<CustomersService['create']>[0]) {
    return this.customers.create(body);
  }

  @Patch(':id/block')
  @RequirePermission('Customers', 'edit')
  setBlocked(@Param('id') id: string, @Body('blocked') blocked: boolean) {
    return this.customers.setBlocked(id, blocked);
  }

  @Patch(':id/phone')
  @RequirePermission('Customers', 'edit')
  updatePhone(@Param('id') id: string, @Body('phone') phone: string) {
    return this.customers.updatePhone(id, phone);
  }
}
