import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Payments & payouts'; // a direct PERM_MODULES fit, unlike most other slices

@Controller('admin/ledger')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminLedgerController {
  constructor(private ledger: LedgerService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list(@Query('kind') kind?: 'income' | 'expense') {
    return this.ledger.list(kind);
  }

  @Post()
  @RequirePermission(MODULE, 'edit')
  addEntry(@Body() body: Parameters<LedgerService['addEntry']>[0]) {
    return this.ledger.addEntry(body);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'edit')
  removeEntry(@Param('id') id: string) {
    return this.ledger.removeEntry(id);
  }

  @Get('categories')
  @RequirePermission(MODULE, 'view')
  listCategories() {
    return this.ledger.listCategories();
  }

  @Post('categories')
  @RequirePermission(MODULE, 'edit')
  addCategory(@Body('kind') kind: 'income' | 'expense', @Body('name') name: string) {
    return this.ledger.addCategory(kind, name);
  }
}
