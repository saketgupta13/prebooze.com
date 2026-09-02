import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { DirectoryService } from './directory.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

@Controller('admin/organizers')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminOrganizersController {
  constructor(private directory: DirectoryService) {}

  @Get()
  @RequirePermission('Organizers', 'view')
  list() {
    return this.directory.listOrganizers();
  }

  @Post()
  @RequirePermission('Organizers', 'edit')
  create(@Body() body: Parameters<DirectoryService['createOrganizer']>[0]) {
    return this.directory.createOrganizer(body);
  }

  @Patch(':id')
  @RequirePermission('Organizers', 'edit')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.directory.updateOrganizer(id, body);
  }

  @Post(':id/verify')
  @RequirePermission('Organizers', 'approve')
  setVerified(@Param('id') id: string, @Body('verified') verified: boolean) {
    return this.directory.setOrganizerVerified(id, verified);
  }

  @Get(':id/payment-profiles')
  @RequirePermission('Organizers', 'view')
  paymentProfiles(@Param('id') id: string) {
    return this.directory.organizerPaymentProfiles(id);
  }

  @Patch(':id/payment-profiles/:profileId')
  @RequirePermission('Organizers', 'edit')
  updatePaymentProfile(@Param('id') id: string, @Param('profileId') profileId: string, @Body() body: Record<string, unknown>) {
    return this.directory.updateOrganizerPaymentProfile(id, profileId, body);
  }

  @Get(':id/team')
  @RequirePermission('Organizers', 'view')
  team(@Param('id') id: string) {
    return this.directory.organizerTeam(id);
  }

  @Delete(':id/team/:staffId')
  @RequirePermission('Organizers', 'edit')
  removeTeamMember(@Param('id') id: string, @Param('staffId') staffId: string) {
    return this.directory.removeOrganizerTeamMember(id, staffId);
  }
}

@Controller('admin/promoters')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminPromotersController {
  constructor(private directory: DirectoryService) {}

  @Get()
  @RequirePermission('Promoters', 'view')
  list() {
    return this.directory.listPromoters();
  }

  @Post()
  @RequirePermission('Promoters', 'edit')
  create(@Body() body: Parameters<DirectoryService['createPromoter']>[0]) {
    return this.directory.createPromoter(body);
  }

  @Patch(':id')
  @RequirePermission('Promoters', 'edit')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.directory.updatePromoter(id, body);
  }

  @Post(':id/verify')
  @RequirePermission('Promoters', 'approve')
  setVerified(@Param('id') id: string, @Body('verified') verified: boolean) {
    return this.directory.setPromoterVerified(id, verified);
  }
}

@Controller('admin/lineups')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminLineupsController {
  constructor(private directory: DirectoryService) {}

  @Get()
  @RequirePermission('Lineups', 'view')
  list() {
    return this.directory.listLineups();
  }

  @Post()
  @RequirePermission('Lineups', 'edit')
  create(@Body() body: Parameters<DirectoryService['createLineup']>[0]) {
    return this.directory.createLineup(body);
  }

  @Patch(':id')
  @RequirePermission('Lineups', 'edit')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.directory.updateLineup(id, body);
  }

  @Post(':id/verify')
  @RequirePermission('Lineups', 'approve')
  setVerified(@Param('id') id: string, @Body('verified') verified: boolean) {
    return this.directory.setLineupVerified(id, verified);
  }
}

@Controller('admin/venues')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminVenuesController {
  constructor(private directory: DirectoryService) {}

  @Get()
  @RequirePermission('Venues', 'view')
  list() {
    return this.directory.listVenues();
  }

  @Post()
  @RequirePermission('Venues', 'edit')
  create(@Body() body: Parameters<DirectoryService['createVenue']>[0]) {
    return this.directory.createVenue(body);
  }

  @Patch(':id')
  @RequirePermission('Venues', 'edit')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.directory.updateVenue(id, body);
  }

  @Post(':id/verify')
  @RequirePermission('Venues', 'approve')
  setVerified(@Param('id') id: string, @Body('verified') verified: boolean) {
    return this.directory.setVenueVerified(id, verified);
  }

  @Post(':id/city-change/approve')
  @RequirePermission('Venues', 'approve')
  approveCityChange(@Param('id') id: string) {
    return this.directory.approveVenueCityChange(id);
  }

  @Post(':id/city-change/reject')
  @RequirePermission('Venues', 'approve')
  rejectCityChange(@Param('id') id: string) {
    return this.directory.rejectVenueCityChange(id);
  }

  @Get(':id/payment-profiles')
  @RequirePermission('Venues', 'view')
  paymentProfiles(@Param('id') id: string) {
    return this.directory.venuePaymentProfiles(id);
  }

  @Patch(':id/payment-profiles/:profileId')
  @RequirePermission('Venues', 'edit')
  updatePaymentProfile(@Param('id') id: string, @Param('profileId') profileId: string, @Body() body: Record<string, unknown>) {
    return this.directory.updateVenuePaymentProfile(id, profileId, body);
  }
}
