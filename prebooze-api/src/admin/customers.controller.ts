import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

@Controller('admin/customers')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminCustomersController {
  constructor(private customers: CustomersService) {}

  @Get()
  @RequirePermission('Customers & organizers', 'view')
  list(@Query('segment') segment?: 'guests' | 'organizers') {
    return this.customers.list(segment);
  }

  @Patch(':id/block')
  @RequirePermission('Customers & organizers', 'edit')
  setBlocked(@Param('id') id: string, @Body('blocked') blocked: boolean) {
    return this.customers.setBlocked(id, blocked);
  }
}
