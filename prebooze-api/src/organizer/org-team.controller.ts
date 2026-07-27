import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { OrgTeamService } from './org-team.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

type AuthedReq = { user: { sub: string } };

@Controller('organizer/team')
@UseGuards(JwtAuthGuard)
export class OrgTeamController {
  constructor(private team: OrgTeamService) {}

  /** "Am I on someone's team, and with what role?" — called once after
   * login to decide whether to route into an organizer console at all for
   * a user who isn't an owner. Unlike every other route on this
   * controller, deliberately has no permission requirement of its own
   * (any authenticated user can ask this about themselves). */
  @Get('mine')
  mine(@Req() req: AuthedReq) {
    return this.team.mine(req.user.sub);
  }

  @Get()
  listStaff(@Req() req: AuthedReq) {
    return this.team.listStaff(req.user.sub);
  }

  @Post()
  addStaff(@Req() req: AuthedReq, @Body() body: Parameters<OrgTeamService['addStaff']>[1]) {
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

@Controller('organizer/roles')
@UseGuards(JwtAuthGuard)
export class OrgRolesController {
  constructor(private team: OrgTeamService) {}

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
