import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { FeaturedService } from './featured.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { RequirePermission } from '../admin/permission.decorator';

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

/** Minimal review queue, same reasoning as /admin/events (Phase 6). Real
 * staff auth as of the Admin API auth slice; the review queue is mapped to
 * "Content (banners / blogs / pages)" — the closest PERM_MODULES fit, since
 * Featured isn't its own module in the mock's RoleMatrix either. Rates are
 * gated on "Payments & payouts" instead — pricing config, not content. */
@Controller('admin/featured')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminFeaturedController {
  constructor(private featured: FeaturedService) {}

  @Get()
  @RequirePermission('Content (banners / blogs / pages)', 'view')
  list(@Query('status') status?: string) {
    return this.featured.listForAdmin(status);
  }

  @Post(':id/approve')
  @RequirePermission('Content (banners / blogs / pages)', 'approve')
  approve(@Param('id') id: string) {
    return this.featured.adminApprove(id);
  }

  @Post(':id/reject')
  @RequirePermission('Content (banners / blogs / pages)', 'approve')
  reject(@Param('id') id: string) {
    return this.featured.adminReject(id);
  }

  @Patch('rates')
  @RequirePermission('Payments & payouts', 'edit')
  updateRates(@Body() body: Parameters<FeaturedService['updateRates']>[0]) {
    return this.featured.updateRates(body);
  }
}
