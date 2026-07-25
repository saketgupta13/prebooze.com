import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { SubTierRole } from '@prisma/client';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Payments & payouts';

/** Read-only admin billing visibility across every role-entity's Razorpay
 * subscription — the actual subscribe/cancel actions stay on each role's own
 * self-serve endpoint (organizer/promoter/venue), same "no god-mode write"
 * boundary as everywhere else a role manages its own account. */
@Controller('admin/subscriptions')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminSubscriptionsController {
  constructor(private subscriptions: SubscriptionsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  list(@Query('role') role?: SubTierRole) {
    return this.subscriptions.listAll(role);
  }
}
