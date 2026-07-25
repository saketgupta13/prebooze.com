import { BadRequestException, Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { StaffAuthService } from './staff-auth.service';
import { StaffAuthGuard, StaffTokenPayload } from './staff-auth.guard';

@Controller('admin/auth')
export class StaffAuthController {
  constructor(private staffAuth: StaffAuthService) {}

  @Post('login')
  login(@Body() body: { email?: string; password?: string }) {
    if (!body.email || !body.password) throw new BadRequestException('email and password are required');
    return this.staffAuth.login(body.email, body.password);
  }

  @Post('verify-2fa')
  verify2fa(@Body() body: { staffId?: string; code?: string }) {
    if (!body.staffId || !body.code) throw new BadRequestException('staffId and code are required');
    return this.staffAuth.verify2fa(body.staffId, body.code);
  }

  @Get('me')
  @UseGuards(StaffAuthGuard)
  me(@Req() req: { staff: StaffTokenPayload }) {
    return this.staffAuth.me(req.staff.staffId);
  }

  @Patch('me')
  @UseGuards(StaffAuthGuard)
  updateMe(@Req() req: { staff: StaffTokenPayload }, @Body() body: { name?: string; email?: string }) {
    return this.staffAuth.updateMe(req.staff.staffId, body);
  }

  @Post('me/password')
  @UseGuards(StaffAuthGuard)
  changePassword(@Req() req: { staff: StaffTokenPayload }, @Body('currentPassword') currentPassword: string, @Body('newPassword') newPassword: string) {
    return this.staffAuth.changeMyPassword(req.staff.staffId, currentPassword, newPassword);
  }
}
