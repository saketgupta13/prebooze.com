import { Module } from '@nestjs/common';
import { CareersController } from './careers.controller';
import { CareersService } from './careers.service';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../notifications/email';

@Module({
  controllers: [CareersController],
  providers: [CareersService, PrismaService, EmailService],
})
export class CareersModule {}
