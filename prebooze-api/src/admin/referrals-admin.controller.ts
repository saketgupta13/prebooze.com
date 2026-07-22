import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ReferralsAdminService } from './referrals-admin.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Payments & payouts'; // reward amounts are real money, closest fit

@Controller('admin/referrals')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminReferralsController {
  constructor(private referrals: ReferralsAdminService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  analytics() {
    return this.referrals.analytics();
  }

  @Get('rates')
  @RequirePermission(MODULE, 'view')
  rates() {
    return this.referrals.rates();
  }

  @Patch('rates')
  @RequirePermission(MODULE, 'edit')
  updateRates(@Body() body: { referee?: number; referrer?: number }) {
    return this.referrals.updateRates(body);
  }
}
