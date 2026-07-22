import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Payments & payouts'; // exact fit

@Controller('admin/payments')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminPaymentsController {
  constructor(private payments: PaymentsService) {}

  @Get('due')
  @RequirePermission(MODULE, 'view')
  payoutsDue() {
    return this.payments.payoutsDue();
  }

  @Post('run-batch')
  @RequirePermission(MODULE, 'edit')
  runBatch(@Body('eventIds') eventIds: string[]) {
    return this.payments.runBatch(eventIds);
  }
}
