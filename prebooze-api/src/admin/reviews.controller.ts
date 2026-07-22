import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

// Closest fit — reviews are organizer-reputation content, same reasoning
// used for KYC before it.
const MODULE = 'Customers & organizers';

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
