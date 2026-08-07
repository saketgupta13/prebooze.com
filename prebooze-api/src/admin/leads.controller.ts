import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';
import type { StaffTokenPayload } from './staff-auth.guard';

const MODULE = 'Leads';
type StaffReq = { staff: StaffTokenPayload };

@Controller('admin/leads')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminLeadsController {
  constructor(private leads: LeadsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list(@Req() req: StaffReq) {
    return this.leads.list(req.staff.staffId);
  }

  @Get('organizer-search')
  @RequirePermission(MODULE, 'view')
  searchOrganizers(@Query('q') q: string) {
    return this.leads.searchOrganizers(q);
  }

  @Get('venue-search')
  @RequirePermission(MODULE, 'view')
  searchVenues(@Query('q') q: string) {
    return this.leads.searchVenues(q);
  }

  @Get('promoter-search')
  @RequirePermission(MODULE, 'view')
  searchPromoters(@Query('q') q: string) {
    return this.leads.searchPromoters(q);
  }

  @Get('lineup-search')
  @RequirePermission(MODULE, 'view')
  searchLineups(@Query('q') q: string) {
    return this.leads.searchLineups(q);
  }

  @Get(':id')
  @RequirePermission(MODULE, 'view')
  get(@Param('id') id: string, @Req() req: StaffReq) {
    return this.leads.get(id, req.staff.staffId);
  }

  @Post()
  @RequirePermission(MODULE, 'edit')
  create(@Body() body: Parameters<LeadsService['create']>[0], @Req() req: StaffReq) {
    return this.leads.create(body, req.staff.staffId);
  }

  @Patch(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Param('id') id: string, @Body() body: Parameters<LeadsService['update']>[1], @Req() req: StaffReq) {
    return this.leads.update(id, body, req.staff.staffId);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'edit')
  remove(@Param('id') id: string, @Req() req: StaffReq) {
    return this.leads.remove(id, req.staff.staffId);
  }

  @Post(':id/activity')
  @RequirePermission(MODULE, 'edit')
  addActivity(@Param('id') id: string, @Body('text') text: string, @Req() req: StaffReq) {
    return this.leads.addActivity(id, text, req.staff.staffId);
  }

  @Post(':id/link-organizer')
  @RequirePermission(MODULE, 'edit')
  linkOrganizer(@Param('id') id: string, @Body('organizerId') organizerId: string, @Req() req: StaffReq) {
    return this.leads.linkOrganizer(id, organizerId, req.staff.staffId);
  }

  @Post(':id/link-venue')
  @RequirePermission(MODULE, 'edit')
  linkVenue(@Param('id') id: string, @Body('venueId') venueId: string, @Req() req: StaffReq) {
    return this.leads.linkVenue(id, venueId, req.staff.staffId);
  }

  @Post(':id/link-promoter')
  @RequirePermission(MODULE, 'edit')
  linkPromoter(@Param('id') id: string, @Body('promoterId') promoterId: string, @Req() req: StaffReq) {
    return this.leads.linkPromoter(id, promoterId, req.staff.staffId);
  }

  @Post(':id/link-lineup')
  @RequirePermission(MODULE, 'edit')
  linkLineup(@Param('id') id: string, @Body('lineupId') lineupId: string, @Req() req: StaffReq) {
    return this.leads.linkLineup(id, lineupId, req.staff.staffId);
  }

  @Post(':id/send-onboarding')
  @RequirePermission(MODULE, 'edit')
  sendOnboarding(@Param('id') id: string, @Body() body: { email?: boolean; whatsapp?: boolean }, @Req() req: StaffReq) {
    return this.leads.sendOnboardingLink(id, body, req.staff.staffId);
  }
}
