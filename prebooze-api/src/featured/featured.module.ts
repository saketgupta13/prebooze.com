import { Module } from '@nestjs/common';
import { FeaturedController, AdminFeaturedController } from './featured.controller';
import { FeaturedService } from './featured.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StaffAuthGuard } from '../admin/staff-auth.guard';
import { PermissionGuard } from '../admin/permission.guard';
import { WhatsappService } from '../notifications/whatsapp';

@Module({
  controllers: [FeaturedController, AdminFeaturedController],
  providers: [FeaturedService, PrismaService, JwtAuthGuard, StaffAuthGuard, PermissionGuard, WhatsappService],
})
export class FeaturedModule {}
