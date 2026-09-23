import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { EmailService } from '../notifications/email';
import { StaffAlertsService } from '../notifications/staff-alerts';

@Module({
  controllers: [SupportController],
  providers: [SupportService, PrismaService, JwtAuthGuard, EmailService, StaffAlertsService],
})
export class SupportModule {}
