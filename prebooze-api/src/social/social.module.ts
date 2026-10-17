import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { EmailService } from '../notifications/email';
import { GuestNotificationsService } from '../notifications/guest-notifications';
import { PushService } from '../notifications/push';

@Module({
  controllers: [SocialController],
  providers: [SocialService, JwtAuthGuard, EmailService, GuestNotificationsService, PushService],
  exports: [SocialService, GuestNotificationsService],
})
export class SocialModule {}
