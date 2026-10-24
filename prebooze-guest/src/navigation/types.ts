import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  PhoneEntry: undefined;
  OtpEntry: { requestId: string; phone: string; existingName?: string };
};

export type MainTabParamList = {
  Home: undefined;
  People: undefined;
  Bookings: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  // ref/via: an arriving promoter-shared link (?ref=slug[&via=handle]) —
  // credits that promoter for whatever's booked, carried through to
  // Checkout. See GuestListLanding for the separate free-entry guest-list
  // flow, which this is not.
  EventDetail: { slug: string; ref?: string; via?: string };
  OrganizerProfile: { id: string };
  VenueProfile: { id: string };
  LineupProfile: { slug: string };
  PromoterProfile: { slug: string };
  PersonProfile: { username: string };
  Browse: { city?: string; cat?: string; search?: string } | undefined;
  Categories: undefined;
  VenuesDirectory: undefined;
  OrganizersDirectory: undefined;
  LineupsDirectory: undefined;
  PromotersDirectory: undefined;
  Checkout: { eventSlug: string; qty: Record<string, number>; promoterRef?: string; promoterVia?: string };
  BookingConfirmed: { bookingId: string };
  BookingDetail: { bookingId: string };
  GuestListLanding: { eventSlug: string; promoterSlug: string };
  GuestPass: { passId: string };
  EditProfile: undefined;
  FinishProfile: undefined;
  Wishlist: undefined;
  Wallet: undefined;
  ReferEarn: undefined;
  PaymentMethods: undefined;
  NotificationSettings: undefined;
  Notifications: undefined;
  HelpCenter: undefined;
  PrivacyPolicy: undefined;
  AboutPrebooze: undefined;
  DeleteAccount: undefined;
  Following: { initialTab?: 'followers' | 'following' } | undefined;
  ReferralLanding: { code: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
