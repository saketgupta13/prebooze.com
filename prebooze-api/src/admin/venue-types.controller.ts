import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { VenueTypesService } from './venue-types.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Content';

/** Master list of venue "type" tags — Venue.type itself stays a plain
 * comma-joined string (see CatalogService for how it's parsed into
 * individual tags), this is the real, admin-managed vocabulary those
 * values are picked from. */
@Controller('admin/venue-types')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminVenueTypesController {
  constructor(private venueTypes: VenueTypesService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list() {
    return this.venueTypes.list();
  }

  @Post()
  @RequirePermission(MODULE, 'edit')
  add(@Body('name') name: string, @Body('icon') icon?: string) {
    return this.venueTypes.add(name, icon);
  }

  @Patch(':name')
  @RequirePermission(MODULE, 'edit')
  update(@Param('name') name: string, @Body() body: { icon?: string; sort?: number }) {
    return this.venueTypes.update(decodeURIComponent(name), body);
  }

  @Delete(':name')
  @RequirePermission(MODULE, 'edit')
  remove(@Param('name') name: string) {
    return this.venueTypes.remove(decodeURIComponent(name));
  }
}
