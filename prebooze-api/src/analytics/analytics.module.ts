import { Module } from '@nestjs/common';
import { TrackController } from './track.controller';
import { TrackService } from './track.service';
import { AdminAnalyticsController } from './analytics-report.controller';
import { AnalyticsReportService } from './analytics-report.service';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [TrackController, AdminAnalyticsController],
  providers: [TrackService, AnalyticsReportService, StaffAuthGuard, PermissionGuard, PrismaService],
})
export class AnalyticsModule {}
