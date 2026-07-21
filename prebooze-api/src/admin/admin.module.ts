import { Module } from '@nestjs/common';
import { StaffAuthController } from './staff-auth.controller';
import { AdminStaffController, AdminRolesController } from './staff.controller';
import { AdminCustomersController } from './customers.controller';
import { StaffAuthService } from './staff-auth.service';
import { StaffService } from './staff.service';
import { CustomersService } from './customers.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { OwnerOnlyGuard } from './owner-only.guard';
import { PermissionGuard } from './permission.guard';
import { PrismaService } from '../prisma.service';

// JwtModule is registered `global: true` in AuthModule, so JwtService is
// already available here without importing it again (see kyc.module.ts).
@Module({
  controllers: [StaffAuthController, AdminStaffController, AdminRolesController, AdminCustomersController],
  providers: [StaffAuthService, StaffService, CustomersService, StaffAuthGuard, OwnerOnlyGuard, PermissionGuard, PrismaService],
  exports: [StaffAuthGuard, PermissionGuard],
})
export class AdminModule {}
