import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';
import type { StaffTokenPayload } from './staff-auth.guard';

const MODULE = 'Payments & payouts'; // exact fit
type StaffReq = { staff: StaffTokenPayload };

@Controller('admin/payments')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminPaymentsController {
  constructor(private payments: PaymentsService) {}

  @Get('due')
  @RequirePermission(MODULE, 'view')
  payoutsDue() {
    return this.payments.payoutsDue();
  }

  @Get('due-events')
  @RequirePermission(MODULE, 'view')
  payoutsDueEvents() {
    return this.payments.payoutsDueEvents();
  }

  @Get('payee/:payeeType/:payeeId')
  @RequirePermission(MODULE, 'view')
  payeeDetail(@Param('payeeType') payeeType: 'organizer' | 'venue', @Param('payeeId') payeeId: string) {
    return this.payments.payeeDetail(payeeType, payeeId);
  }

  @Post('mark-paid')
  @RequirePermission(MODULE, 'edit')
  markPaid(@Body('eventId') eventId: string, @Body('utr') utr: string, @Req() req: StaffReq) {
    return this.payments.markPaid(eventId, utr, req.staff.email);
  }

  @Get('withdrawal-requests')
  @RequirePermission(MODULE, 'view')
  withdrawalRequests() {
    return this.payments.withdrawalRequests();
  }

  @Post('withdrawal-requests/:payeeType/:id/advance')
  @RequirePermission(MODULE, 'edit')
  advanceWithdrawal(
    @Param('payeeType') payeeType: 'organizer' | 'venue',
    @Param('id') id: string,
    @Body() body: { status: string; utr?: string; reason?: string },
    @Req() req: StaffReq,
  ) {
    return this.payments.advanceWithdrawal(payeeType, id, body, req.staff.email);
  }

  @Post('withdrawal-requests/:payeeType/:id/resolve-rejection')
  @RequirePermission(MODULE, 'edit')
  resolveRejection(
    @Param('payeeType') payeeType: 'organizer' | 'venue',
    @Param('id') id: string,
    @Body('note') note: string | undefined,
    @Req() req: StaffReq,
  ) {
    return this.payments.resolveRejection(payeeType, id, note, req.staff.email);
  }

  @Get('all-events')
  @RequirePermission(MODULE, 'view')
  allEventsPayout() {
    return this.payments.allEventsPayout();
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
