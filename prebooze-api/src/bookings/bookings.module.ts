import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { HoldsService } from './holds.service';
import { RazorpayService } from '../payments/razorpay.service';
import { WhatsappService } from '../notifications/whatsapp';
import { PrismaService } from '../prisma.service';
import { redisProvider } from '../redis.provider';
import { JwtAuthGuard } from '../auth/jwt.guard';

// JwtModule is registered `global: true` in AuthModule, so JwtService is
// already available here without importing it again (see kyc.module.ts).
@Module({
  controllers: [BookingsController],
  providers: [BookingsService, HoldsService, RazorpayService, WhatsappService, PrismaService, redisProvider, JwtAuthGuard],
})
export class BookingsModule {}
