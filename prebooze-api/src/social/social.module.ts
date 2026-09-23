import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { EmailService } from '../notifications/email';

@Module({
  controllers: [SocialController],
  providers: [SocialService, JwtAuthGuard, EmailService],
  exports: [SocialService],
})
export class SocialModule {}
