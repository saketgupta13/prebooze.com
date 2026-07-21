import { Module } from '@nestjs/common';
import { FeaturedController, AdminFeaturedController } from './featured.controller';
import { FeaturedService } from './featured.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { WhatsappService } from '../notifications/whatsapp';

@Module({
  controllers: [FeaturedController, AdminFeaturedController],
  providers: [FeaturedService, PrismaService, JwtAuthGuard, WhatsappService],
})
export class FeaturedModule {}
