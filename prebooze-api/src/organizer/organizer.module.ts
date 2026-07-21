import { Module } from '@nestjs/common';
import { OrganizerController, AdminEventsController } from './organizer.controller';
import { OrganizerService } from './organizer.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { WhatsappService } from '../notifications/whatsapp';

@Module({
  controllers: [OrganizerController, AdminEventsController],
  providers: [OrganizerService, PrismaService, JwtAuthGuard, WhatsappService],
})
export class OrganizerModule {}
