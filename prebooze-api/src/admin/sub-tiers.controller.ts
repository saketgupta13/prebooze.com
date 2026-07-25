import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { SubTierRole } from '@prisma/client';
import { SubTiersService } from './sub-tiers.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Payments & payouts'; // pricing config, closest fit — same as referral rates

/** Renamed from `admin/promoter-tiers` — generalized to organizer/promoter/
 * venue once real Razorpay Subscription billing needed a plan to sell for
 * each role, not just promoter. */
@Controller('admin/sub-tiers')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminSubTiersController {
  constructor(private tiers: SubTiersService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list(@Query('role') role?: SubTierRole) {
    return this.tiers.list(role);
  }

  @Post()
  @RequirePermission(MODULE, 'edit')
  create(@Body() body: { role?: string; name?: string; price?: number; guests?: number }) {
    return this.tiers.create(body);
  }

  @Patch(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Param('id') id: string, @Body() body: { name?: string; price?: number; guests?: number }) {
    return this.tiers.update(id, body);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'edit')
  remove(@Param('id') id: string) {
    return this.tiers.remove(id);
  }
}
