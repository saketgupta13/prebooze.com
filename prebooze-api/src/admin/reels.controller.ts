import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ReelsService } from './reels.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Content (banners / blogs / pages)';

@Controller('admin/reels')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminReelsController {
  constructor(private reels: ReelsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list() {
    return this.reels.list();
  }

  @Post()
  @RequirePermission(MODULE, 'edit')
  create(@Body() body: { title?: string; videoUrl?: string }) {
    return this.reels.create(body);
  }

  @Post(':id/toggle')
  @RequirePermission(MODULE, 'edit')
  toggle(@Param('id') id: string) {
    return this.reels.toggle(id);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'edit')
  remove(@Param('id') id: string) {
    return this.reels.remove(id);
  }
}
