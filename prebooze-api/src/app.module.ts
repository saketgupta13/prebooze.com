import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { KycModule } from './kyc/kyc.module';
import { CatalogModule } from './catalog/catalog.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, KycModule, CatalogModule, BookingsModule],
  controllers: [AppController],
})
export class AppModule {}
