import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PromosService } from './promos.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Promo codes'; // own module as of the expanded-permissions slice

@Controller('admin/promos')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminPromosController {
  constructor(private promos: PromosService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list() {
    return this.promos.list();
  }

  @Post()
  @RequirePermission(MODULE, 'edit')
  create(@Body() body: Parameters<PromosService['create']>[0]) {
    return this.promos.create(body);
  }

  @Patch(':code')
  @RequirePermission(MODULE, 'edit')
  update(@Param('code') code: string, @Body() body: Parameters<PromosService['update']>[1]) {
    return this.promos.update(code, body);
  }

  @Delete(':code')
  @RequirePermission(MODULE, 'edit')
  remove(@Param('code') code: string) {
    return this.promos.remove(code);
  }
}
