import { Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { RequirePermission } from '../admin/permission.decorator';

// Split 2026-10-06 from 'Payments & payouts' — same reasoning as Financial
// reports (reports.controller.ts): a role that only needs to read/export
// real tax invoices (e.g. for a CA) shouldn't also need access to real
// payout-moving actions just to get there.
const MODULE = 'Invoices';

@Controller('admin/invoices')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminInvoicesController {
  constructor(private invoices: InvoicesService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list(@Query('role') role?: string, @Query('city') city?: string, @Query('type') type?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.invoices.list({ role, city, type, from, to });
  }

  @Get(':id')
  @RequirePermission(MODULE, 'view')
  get(@Param('id') id: string) {
    return this.invoices.get(id);
  }

  @Get(':id/pdf')
  @RequirePermission(MODULE, 'view')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const { filename, buffer } = await this.invoices.pdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Post(':id/resend-email')
  @RequirePermission(MODULE, 'edit')
  resendEmail(@Param('id') id: string) {
    return this.invoices.resendEmail(id);
  }

  @Post(':id/resend-whatsapp')
  @RequirePermission(MODULE, 'edit')
  resendWhatsapp(@Param('id') id: string) {
    return this.invoices.resendWhatsapp(id);
  }
}
