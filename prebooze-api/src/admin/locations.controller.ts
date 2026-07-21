import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

// Locations isn't its own PERM_MODULES entry either (same situation as KYC
// and Featured before it) — "Customers & organizers" is the closest fit
// left; city/country availability shapes who can even sign up as an
// organizer/venue in a given market, which is squarely that module's turf.
const MODULE = 'Customers & organizers';

@Controller('admin/locations')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminLocationsController {
  constructor(private locations: LocationsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  tree() {
    return this.locations.tree();
  }

  @Post('countries')
  @RequirePermission(MODULE, 'edit')
  addCountry(@Body('name') name: string) {
    return this.locations.addCountry(name);
  }

  @Post('states')
  @RequirePermission(MODULE, 'edit')
  addState(@Body('countryId') countryId: string, @Body('name') name: string) {
    return this.locations.addState(countryId, name);
  }

  @Post('cities')
  @RequirePermission(MODULE, 'edit')
  addCity(@Body('stateId') stateId: string, @Body('name') name: string) {
    return this.locations.addCity(stateId, name);
  }

  @Post('countries/:id/toggle')
  @RequirePermission(MODULE, 'edit')
  toggleCountry(@Param('id') id: string) {
    return this.locations.toggleCountry(id);
  }

  @Post('states/:id/toggle')
  @RequirePermission(MODULE, 'edit')
  toggleState(@Param('id') id: string) {
    return this.locations.toggleState(id);
  }

  @Post('cities/:name/toggle')
  @RequirePermission(MODULE, 'edit')
  toggleCity(@Param('name') name: string) {
    return this.locations.toggleCity(decodeURIComponent(name));
  }

  @Patch('cities/:name')
  @RequirePermission(MODULE, 'edit')
  updateCity(@Param('name') name: string, @Body() body: { icon?: string; top?: boolean }) {
    return this.locations.updateCity(decodeURIComponent(name), body);
  }

  @Delete('countries/:id')
  @RequirePermission(MODULE, 'edit')
  removeCountry(@Param('id') id: string) {
    return this.locations.removeCountry(id);
  }

  @Delete('states/:id')
  @RequirePermission(MODULE, 'edit')
  removeState(@Param('id') id: string) {
    return this.locations.removeState(id);
  }

  @Delete('cities/:name')
  @RequirePermission(MODULE, 'edit')
  removeCity(@Param('name') name: string) {
    return this.locations.removeCityFromTree(decodeURIComponent(name));
  }
}
