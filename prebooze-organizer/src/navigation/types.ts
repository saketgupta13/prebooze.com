export type AuthStackParamList = {
  PhoneEntry: undefined;
  OtpEntry: { phone: string; requestId: string; devCode?: string; existingName?: string };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Events: undefined;
  Scan: undefined;
  // Optional eventId — Dashboard's "Attendees →" row deep-links into a
  // single event's booking list, mirroring web's `/organizer/bookings?event=`.
  Bookings: { eventId?: string } | undefined;
  More: undefined;
};

// Each of these nests inside its own MainTabParamList tab (see MainTabs.tsx)
// instead of sitting in a stack above the whole tab navigator — pushing a
// screen within a tab's own stack keeps the bottom tab bar visible
// throughout (organizer feedback 2026-09-15: "don't hide bottom menu
// anywhere"), whereas a stack above the tab navigator covers it entirely.
export type EventsStackParamList = {
  EventsList: undefined;
  // Optional eventId distinguishes create (web's /organizer/events/create)
  // from edit (.../:id/edit).
  EventWizard: { eventId?: string } | undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  // No param on either — like Scanner, each picks its own default event via
  // its own organizer.events() call.
  GuestList: undefined;
  LiveMonitor: undefined;
  // Phase 3 — reviews, coupons, abandoned carts, payouts, transactions,
  // promoters (2026-09-15).
  Reviews: undefined;
  Coupons: undefined;
  AbandonedCarts: undefined;
  Payouts: undefined;
  Withdraw: undefined;
  Transactions: undefined;
  Promoters: undefined;
  // Phase 4 — settings, team & roles, verification, payment profiles
  // (2026-09-16).
  Settings: undefined;
  TeamRoles: undefined;
  Verification: undefined;
  PaymentProfiles: undefined;
};
