import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { KycModule } from './kyc/kyc.module';
import { CatalogModule } from './catalog/catalog.module';
import { BookingsModule } from './bookings/bookings.module';
import { WalletModule } from './wallet/wallet.module';
import { ReferralsModule } from './referrals/referrals.module';
import { SocialModule } from './social/social.module';
import { OrganizerModule } from './organizer/organizer.module';
import { PromoterModule } from './promoter/promoter.module';
import { VenueModule } from './venue/venue.module';
import { FeaturedModule } from './featured/featured.module';
import { SupportModule } from './support/support.module';
import { CareersModule } from './careers/careers.module';
import { AdminModule } from './admin/admin.module';
import { ContentModule } from './content/content.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    KycModule,
    CatalogModule,
    BookingsModule,
    WalletModule,
    ReferralsModule,
    SocialModule,
    OrganizerModule,
    PromoterModule,
    VenueModule,
    FeaturedModule,
    SupportModule,
    CareersModule,
    AdminModule,
    ContentModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
