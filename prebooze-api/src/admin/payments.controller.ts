import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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

  @Post('mark-paid')
  @RequirePermission(MODULE, 'edit')
  markPaid(@Body('eventId') eventId: string, @Body('utr') utr: string) {
    return this.payments.markPaid(eventId, utr);
  }

  @Get('organizer-withdrawals')
  @RequirePermission(MODULE, 'view')
  organizerWithdrawals() {
    return this.payments.organizerWithdrawals();
  }

  @Post('organizer-withdrawals/:id/mark-paid')
  @RequirePermission(MODULE, 'edit')
  markOrganizerWithdrawalPaid(@Param('id') id: string, @Body('utr') utr: string) {
    return this.payments.markOrganizerWithdrawalPaid(id, utr);
  }

  @Get('transactions')
  @RequirePermission(MODULE, 'view')
  transactions(@Query('eventId') eventId?: string) {
    return this.payments.transactions(eventId);
  }

  @Get('refunds')
  @RequirePermission(MODULE, 'view')
  refunds() {
    return this.payments.refunds();
  }

  @Get('promoter-payouts')
  @RequirePermission(MODULE, 'view')
  promoterPayoutsAll() {
    return this.payments.promoterPayoutsAll();
  }

  @Get('promoter-platform-commission-due')
  @RequirePermission(MODULE, 'view')
  platformCommissionDue() {
    return this.payments.platformCommissionDue();
  }

  @Post('promoter-platform-commission/:promoterId/mark-paid')
  @RequirePermission(MODULE, 'edit')
  markPlatformCommissionPaid(@Param('promoterId') promoterId: string) {
    return this.payments.markPlatformCommissionPaid(promoterId);
  }
}
