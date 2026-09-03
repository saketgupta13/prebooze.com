import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AmenitiesService } from './amenities.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Content';

/** Master list of venue amenity tags — Venue.amenities itself stays a plain
 * String[] column, this is the real, admin-managed vocabulary those values
 * are picked from/added to (mirrors venue-types.controller.ts exactly). */
@Controller('admin/amenities')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminAmenitiesController {
  constructor(private amenities: AmenitiesService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list() {
    return this.amenities.list();
  }

  @Post()
  @RequirePermission(MODULE, 'edit')
  add(@Body('name') name: string, @Body('icon') icon?: string) {
    return this.amenities.add(name, icon);
  }

  @Patch(':name')
  @RequirePermission(MODULE, 'edit')
  update(@Param('name') name: string, @Body() body: { icon?: string; sort?: number }) {
    return this.amenities.update(decodeURIComponent(name), body);
  }

  @Delete(':name')
  @RequirePermission(MODULE, 'edit')
  remove(@Param('name') name: string) {
    return this.amenities.remove(decodeURIComponent(name));
  }
}
