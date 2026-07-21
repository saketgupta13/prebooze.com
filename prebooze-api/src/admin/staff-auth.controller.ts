import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
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

  @Get('me')
  @UseGuards(StaffAuthGuard)
  me(@Req() req: { staff: StaffTokenPayload }) {
    return this.staffAuth.me(req.staff.staffId);
  }
}
