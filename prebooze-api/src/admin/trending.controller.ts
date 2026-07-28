import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TrendingService } from './trending.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Content'; // grouped with the rest of the CMS content types

/** Admin-pinned trending search terms — always shown first, in this order;
 * CatalogService.trending() auto-fills any remaining slots from real event
 * title activity, so this list is an override/priority pin, not the only
 * source. */
@Controller('admin/trending')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminTrendingController {
  constructor(private trending: TrendingService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list() {
    return this.trending.list();
  }

  @Post()
  @RequirePermission(MODULE, 'edit')
  add(@Body('term') term: string) {
    return this.trending.add(term);
  }

  @Patch(':term')
  @RequirePermission(MODULE, 'edit')
  reorder(@Param('term') term: string, @Body('sort') sort: number) {
    return this.trending.reorder(decodeURIComponent(term), sort);
  }

  @Delete(':term')
  @RequirePermission(MODULE, 'edit')
  remove(@Param('term') term: string) {
    return this.trending.remove(decodeURIComponent(term));
  }
}
