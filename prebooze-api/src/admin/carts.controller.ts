import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CartsService } from './carts.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

// Closest fit — recovering abandoned carts is guest/customer outreach.
const MODULE = 'Customers & organizers';

@Controller('admin/carts')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminCartsController {
  constructor(private carts: CartsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list(@Query('eventId') eventId?: string) {
    return this.carts.list(eventId);
  }

  @Post(':id/remind')
  @RequirePermission(MODULE, 'edit')
  remind(@Param('id') id: string) {
    return this.carts.remind(id);
  }

  @Post('bulk-remind')
  @RequirePermission(MODULE, 'edit')
  bulkRemind(@Body('ids') ids: string[]) {
    return this.carts.bulkRemind(ids ?? []);
  }
}
