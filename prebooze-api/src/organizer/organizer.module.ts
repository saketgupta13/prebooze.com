import { Module } from '@nestjs/common';
import { OrganizerController, AdminEventsController } from './organizer.controller';
import { OrganizerService } from './organizer.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { WhatsappService } from '../notifications/whatsapp';

@Module({
  controllers: [OrganizerController, AdminEventsController],
  providers: [OrganizerService, PrismaService, JwtAuthGuard, StaffAuthGuard, PermissionGuard, WhatsappService],
})
export class OrganizerModule {}
