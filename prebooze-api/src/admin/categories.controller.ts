import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Content'; // grouped with the rest of the CMS content types

@Controller('admin/categories')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminCategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list() {
    return this.categories.list();
  }

  @Post()
  @RequirePermission(MODULE, 'edit')
  add(@Body('name') name: string, @Body('icon') icon?: string) {
    return this.categories.add(name, icon);
  }

  @Patch(':name')
  @RequirePermission(MODULE, 'edit')
  update(@Param('name') name: string, @Body() body: { icon?: string; imageUrl?: string; seo?: Record<string, string>; subs?: string[]; sort?: number }) {
    return this.categories.update(decodeURIComponent(name), body);
  }

  @Delete(':name')
  @RequirePermission(MODULE, 'edit')
  remove(@Param('name') name: string) {
    return this.categories.remove(decodeURIComponent(name));
  }
}
