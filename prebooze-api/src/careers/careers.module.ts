import { Module } from '@nestjs/common';
import { CareersController } from './careers.controller';
import { CareersService } from './careers.service';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../notifications/email';
import { StorageService } from '../kyc/storage.service';

@Module({
  controllers: [CareersController],
  providers: [CareersService, PrismaService, EmailService, StorageService],
})
export class CareersModule {}
