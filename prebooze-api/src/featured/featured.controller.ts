import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { FeaturedService } from './featured.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../kyc/admin.guard';

type AuthedReq = { user: { sub: string } };

@Controller('featured')
export class FeaturedController {
  constructor(private featured: FeaturedService) {}

  @Post('request')
  @UseGuards(JwtAuthGuard)
  request(@Req() req: AuthedReq, @Body() body: Parameters<FeaturedService['request']>[1]) {
    return this.featured.request(req.user.sub, body);
  }

  @Get('rates')
  rates() {
    return this.featured.rates();
  }
}

/** Minimal review queue, same reasoning and same placeholder admin gate as
 * /admin/events (Phase 6) — a full featured queue + rates console is
 * separate Admin API work. */
@Controller('admin/featured')
@UseGuards(AdminGuard)
export class AdminFeaturedController {
  constructor(private featured: FeaturedService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.featured.listForAdmin(status);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.featured.adminApprove(id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string) {
    return this.featured.adminReject(id);
  }
}
