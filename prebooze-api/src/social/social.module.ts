import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Module({
  controllers: [SocialController],
  providers: [SocialService, PrismaService, JwtAuthGuard],
})
export class SocialModule {}
