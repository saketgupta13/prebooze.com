import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { VenueTeamService } from './venue-team.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

type AuthedReq = { user: { sub: string } };

@Controller('venue/team')
@UseGuards(JwtAuthGuard)
export class VenueTeamController {
  constructor(private team: VenueTeamService) {}

  /** "Am I on some venue's hosting team?" — deliberately no permission
   * requirement of its own, same as OrgTeamController.mine. */
  @Get('mine')
  mine(@Req() req: AuthedReq) {
    return this.team.mine(req.user.sub);
  }

  @Get()
  listStaff(@Req() req: AuthedReq) {
    return this.team.listStaff(req.user.sub);
  }

  @Post()
  addStaff(@Req() req: AuthedReq, @Body() body: Parameters<VenueTeamService['addStaff']>[1]) {
    return this.team.addStaff(req.user.sub, body);
  }

  @Post(':id/role')
  updateStaffRole(@Req() req: AuthedReq, @Param('id') id: string, @Body('roleName') roleName: string) {
    return this.team.updateStaffRole(req.user.sub, id, roleName);
  }

  @Delete(':id')
  removeStaff(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.team.removeStaff(req.user.sub, id);
  }
}

@Controller('venue/roles')
@UseGuards(JwtAuthGuard)
export class VenueRolesController {
  constructor(private team: VenueTeamService) {}

  @Get()
  list(@Req() req: AuthedReq) {
    return this.team.listRoles(req.user.sub);
  }

  @Post()
  add(@Req() req: AuthedReq, @Body('name') name: string) {
    return this.team.addRole(req.user.sub, name);
  }

  @Post(':name/perm')
  setPerm(@Req() req: AuthedReq, @Param('name') name: string, @Body() body: { module: string; key: 'view' | 'edit'; value: boolean }) {
    return this.team.setRolePerm(req.user.sub, name, body.module, body.key, body.value);
  }

  @Delete(':name')
  remove(@Req() req: AuthedReq, @Param('name') name: string) {
    return this.team.removeRole(req.user.sub, name);
  }
}
