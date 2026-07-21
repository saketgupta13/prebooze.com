import { Module } from '@nestjs/common';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Module({
  controllers: [VenueController],
  providers: [VenueService, PrismaService, JwtAuthGuard],
})
export class VenueModule {}
