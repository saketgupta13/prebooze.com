import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { SubTiersService } from './sub-tiers.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Payments & payouts'; // pricing config, closest fit — same as referral rates

@Controller('admin/promoter-tiers')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminSubTiersController {
  constructor(private tiers: SubTiersService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list() {
    return this.tiers.list();
  }

  @Patch(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Param('id') id: string, @Body() body: { name?: string; price?: number; guests?: number }) {
    return this.tiers.update(id, body);
  }
}
