import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Transactions';

@Controller('admin/transactions')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminTransactionsController {
  constructor(private tx: TransactionsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  payeesSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.tx.payeesSummary(from, to);
  }

  @Get('payee/:payeeType/:payeeId')
  @RequirePermission(MODULE, 'view')
  payeeEvents(
    @Param('payeeType') payeeType: 'organizer' | 'venue',
    @Param('payeeId') payeeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.tx.payeeEvents(payeeType, payeeId, from, to);
  }

  @Get('event/:eventId')
  @RequirePermission(MODULE, 'view')
  eventTransactions(@Param('eventId') eventId: string) {
    return this.tx.eventTransactions(eventId);
  }
}
