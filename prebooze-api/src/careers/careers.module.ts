import { Module } from '@nestjs/common';
import { CareersController } from './careers.controller';
import { CareersService } from './careers.service';
import { EmailService } from '../notifications/email';
import { StorageService } from '../kyc/storage.service';

@Module({
  controllers: [CareersController],
  providers: [CareersService, EmailService, StorageService],
})
export class CareersModule {}
