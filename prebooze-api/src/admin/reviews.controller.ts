import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Reviews'; // own module as of the expanded-permissions slice

@Controller('admin/reviews')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list(@Query('organizerId') organizerId?: string) {
    return this.reviews.list(organizerId);
  }

  @Patch(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Param('id') id: string, @Body() body: { rating?: number; text?: string }) {
    return this.reviews.update(id, body);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'edit')
  remove(@Param('id') id: string) {
    return this.reviews.remove(id);
  }
}
