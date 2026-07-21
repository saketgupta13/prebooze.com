import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { WhatsappService } from '../notifications/whatsapp';

@Module({
  controllers: [SupportController],
  providers: [SupportService, PrismaService, JwtAuthGuard, WhatsappService],
})
export class SupportModule {}
