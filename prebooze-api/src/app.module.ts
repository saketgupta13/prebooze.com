import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { LineupModule } from './lineup/lineup.module';
import { FeaturedModule } from './featured/featured.module';
import { SupportModule } from './support/support.module';
import { CareersModule } from './careers/careers.module';
import { AdminModule } from './admin/admin.module';
import { ContentModule } from './content/content.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
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
    LineupModule,
    FeaturedModule,
    SupportModule,
    CareersModule,
    AdminModule,
    ContentModule,
    SubscriptionsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
