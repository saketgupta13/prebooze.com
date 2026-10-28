import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CartsService } from './carts.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Abandoned carts'; // own module as of the expanded-permissions slice

@Controller('admin/carts')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminCartsController {
  constructor(private carts: CartsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list(@Query('eventId') eventId?: string, @Query('past') past?: string) {
    return this.carts.list(eventId, past === 'true');
  }

  @Get('stats')
  @RequirePermission(MODULE, 'view')
  stats() {
    return this.carts.stats();
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

  @Patch(':id/contacted')
  @RequirePermission(MODULE, 'edit')
  setFollowUp(
    @Param('id') id: string,
    @Body('contacted') contacted: boolean,
    @Body('at') at?: string,
    @Body('nextAt') nextAt?: string | null,
    @Body('outcome') outcome?: string | null,
    @Body('note') note?: string,
  ) {
    return this.carts.setFollowUp(id, !!contacted, { at, nextAt, outcome, note });
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'edit')
  remove(@Param('id') id: string) {
    return this.carts.remove(id);
  }

  @Post('bulk-remove')
  @RequirePermission(MODULE, 'edit')
  bulkRemove(@Body('ids') ids: string[]) {
    return this.carts.bulkRemove(ids ?? []);
  }
}
