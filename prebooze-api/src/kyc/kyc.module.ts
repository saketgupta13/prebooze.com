import { Module } from '@nestjs/common';
import { KycController, AdminKycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { StorageService } from './storage.service';
import { KycProviderService } from './kyc-provider.service';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AdminGuard } from './admin.guard';

// JwtModule is registered `global: true` in AuthModule, so JwtService (used
// by JwtAuthGuard here) is already available without importing it again.
@Module({
  controllers: [KycController, AdminKycController],
  providers: [KycService, StorageService, KycProviderService, PrismaService, JwtAuthGuard, AdminGuard],
})
export class KycModule {}
