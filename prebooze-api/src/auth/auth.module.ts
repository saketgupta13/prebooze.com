import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { redisProvider } from '../redis.provider';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { JwtAuthGuard } from './jwt.guard';
import { StorageService } from '../kyc/storage.service';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-only-change-in-production',
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, redisProvider, WhatsappService, EmailService, JwtAuthGuard, StorageService],
})
export class AuthModule {}
