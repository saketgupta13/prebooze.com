import { Module } from '@nestjs/common';
import { TrackController } from './track.controller';
import { TrackService } from './track.service';
import { AdminFunnelController } from './funnel-report.controller';
import { FunnelReportService } from './funnel-report.service';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [TrackController, AdminFunnelController],
  providers: [TrackService, FunnelReportService, StaffAuthGuard, PermissionGuard, PrismaService],
})
export class AnalyticsModule {}
