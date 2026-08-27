import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Payments & payouts';

@Controller('admin/settlements')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminSettlementsController {
  constructor(private settlements: SettlementsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list() {
    return this.settlements.list();
  }
}
