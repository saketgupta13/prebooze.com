import { Controller, Get, Param, Post, UseGuards, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Get(':id')
  @RequirePermission(MODULE, 'view')
  detail(@Param('id') id: string) {
    return this.settlements.detail(id);
  }

  @Get('phonepe/list')
  @RequirePermission(MODULE, 'view')
  listPhonePe() {
    return this.settlements.listPhonePe();
  }

  @Get('phonepe/:id')
  @RequirePermission(MODULE, 'view')
  detailPhonePe(@Param('id') id: string) {
    return this.settlements.detailPhonePe(id);
  }

  @Post('phonepe/import')
  @RequirePermission(MODULE, 'edit')
  @UseInterceptors(FileInterceptor('file'))
  async importPhonePeSettlement(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!file.originalname.endsWith('.csv')) throw new BadRequestException('File must be CSV');

    const csv = file.buffer.toString('utf-8');
    const result = await this.settlements.importPhonePeSettlementFile(csv, file.originalname);
    return result;
  }
}
