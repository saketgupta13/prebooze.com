import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Booking, Coupon, Event, Featured, HelpTicket, JobApplication, PayMethod, Person, ReviewTargetType, User, Venue, WaitlistEntry } from '../types';
import { registerVenue } from '../data/mock';
import { COUPONS, EVENTS, REFERRAL_CONFIG, SEED_FEATURED, VENUES, eventById } from '../data/mock';
import { notify } from '../lib/notify';
import { auth, referrals as referralsApi, social as socialApi, orgTeam as orgTeamApi, bookings as bookingsApi, wallet as walletApi, support as supportApi, careers as careersApi, type OrgTeamAccess } from '../api';
import { isBackendEnabled, setToken, clearToken, getToken } from '../api/client';
import { track } from '../lib/track';
import { pushEvent } from '../lib/gtm';
import { trackMeta } from '../lib/meta';

export interface GuestReview {
  id: string;
  author: string;
  rating: number;
  eventTitle?: string;
  text: string;
  date: string;
}

export const reviewKey = (targetType: ReviewTargetType, targetId: string) => `${targetType}:${targetId}`;

export interface WalletTx {
  id: string;
  type: 'referral_welcome' | 'referral_reward' | 'refund' | 'spend';
  amount: number; // positive = credit, negative = spend
  note: string;
  date: string;
}

export interface Referral {
  code: string;
  referrerPhone: string;
  refereePhone: string;
  refereeName?: string;
  status: 'joined' | 'qualified';
  createdAt: string;
}

/** Deterministic referral code for a phone number. */
export const referralCodeFor = (phone: string) =>
  'PB' + (parseInt(phone.replace(/\D/g, '').slice(-8) || '0', 10).toString(36).toUpperCase());

/** A checkout cart, tracked for hold + abandoned-cart recovery. */
export interface CartRecord {
  id: string; // `${phone}::${eventId}`
  userPhone: string;
  userName: string;
  eventId: string;
  eventTitle: string;
  qty: number;
  qtyMap: Record<string, number>; // tierId -> qty (to restore the selection)
  tierSummary: string;
  subtotal: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'abandoned' | 'completed';
  remindedAt?: string; // last time a recovery WhatsApp nudge was sent
}

export interface PromoterGuest {
  id: string;
  eventId: string;
  promoterSlug: string;
  name: string;
  phone: string;
  age: string;
  gender: string;
  createdAt: string;
  arrived?: boolean;
  subPromoter?: string; // sub-promoter handle credited within the promoter's team
  // Party members beyond the main signer — one combined QR (this row's id)
  // covers everyone; the gate scans once and the whole party checks in
  // together (see PromoterGuest.companions on the backend).
  companions?: { name: string }[];
}

export interface SubPromoter {
  handle: string;
  name: string;
  hue: number;
  payoutSplitPct?: number;
  monthlyQuotaShare?: number | null;
}

interface Selection {
  eventId: string;
  eventSlug?: string; // present for real (live-backend) events — lets Checkout refetch by slug, the only lookup the public catalog API supports
  qty: Record<string, number>; // tierId -> qty
}

/** How long paid tickets stay held on the checkout page before the hold is released. */
export const CART_HOLD_MINUTES = 8;

interface AppState {
  user: User | null;
  city: string;
  bookings: Booking[];
  selection: Selection | null;
  myEvents: Event[]; // organizer-created events (on top of seeded)
  coupons: Coupon[];
  following: string[];
  pendingPhone: string;
  setCity: (c: string) => void;
  setPendingPhone: (p: string) => void;
  requestOtp: (phone: string) => Promise<void>;
  /** `isTeamMember` is resolved (awaited, not fire-and-forget) as part of
   * login itself — an invited organizer team member should never be
   * funneled through guest profile-completion/ID-verification, the same
   * way an organizer-onboarding signup already skips it, but that decision
   * has to be made the instant OTP verification resolves, before any
   * re-render could pick up orgTeamAccess from context. */
  loginWithOtp: (code: string) => Promise<{ status: 'new' | 'existing'; isTeamMember: boolean }>;
  updateUser: (patch: Partial<User>) => void;
  // Submits an elevated-role application for manual review — never activates
  // the role directly. Guest ID verification is separate (see idVerified /
  // the automatic flow in IdVerification.tsx) and unaffected by this.
  submitRoleApplication: (kind: 'organizer' | 'promoter' | 'lineup' | 'venue', patch: Partial<User>) => void;
  logout: () => void;
  setSelection: (s: Selection | null) => void;
  holdExpiry: number | null; // epoch ms when the current checkout hold lapses
  startHold: () => void;
  setHold: (expiresAt: number) => void; // arm the hold at an explicit epoch — used for the real server-issued hold expiry
  clearHold: () => void;
  carts: CartRecord[];
  captureCart: (c: Omit<CartRecord, 'status' | 'updatedAt'>) => void;
  setCartStatus: (id: string, status: CartRecord['status']) => void;
  remindCart: (id: string) => void;
  addBooking: (b: Booking) => void;
  cancelBooking: (id: string) => void;
  refundBooking: (id: string, method: 'wallet' | 'source') => void;
  walletTxs: WalletTx[];
  walletBalance: number;
  spendWallet: (amount: number, note: string) => void;
  /** Re-fetches the real GET /wallet — call after any action that changes a
   * real guest's balance server-side (a live purchase, a live refund) so
   * the Wallet page doesn't need a full reload to catch up. No-op offline. */
  refreshWallet: () => void;
  myReferralCode: string;
  referrals: Referral[];
  wishlist: string[]; // event ids
  toggleWishlist: (eventId: string) => void;
  favVenues: string[]; // venue ids
  toggleFavVenue: (venueId: string) => void;
  payMethods: PayMethod[];
  addPayMethod: (m: Omit<PayMethod, 'id' | 'isDefault'>) => void;
  removePayMethod: (id: string) => void;
  setDefaultPayMethod: (id: string) => void;
  helpTickets: HelpTicket[];
  addHelpTicket: (t: Omit<HelpTicket, 'id' | 'status' | 'createdAt'>) => void;
  waitlists: Record<string, WaitlistEntry[]>; // eventId -> queue (FIFO)
  joinWaitlist: (eventId: string) => void;
  jobApps: JobApplication[];
  applyJob: (a: Omit<JobApplication, 'id' | 'appliedAt' | 'cv'>, cv?: File) => void;
  /** keyed by `reviewKey(targetType, targetId)` — covers organizer/promoter/venue/lineup, never guests. */
  reviews: Record<string, GuestReview[]>;
  addReview: (targetType: ReviewTargetType, targetId: string, rating: number, text: string, eventTitle?: string) => void;
  checkInBooking: (id: string, count: number) => void;
  addEvent: (e: Event) => void;
  upsertEvent: (e: Event) => void;
  addCoupon: (c: Coupon) => void;
  updateCoupon: (id: string, patch: Partial<Coupon>) => void;
  removeCoupon: (id: string) => void;
  toggleCoupon: (id: string) => void;
  toggleFollow: (id: string) => void;
  followerDeltas: Record<string, number>;
  /** `base` is the server-fetched follower count for `id` at page-load
   * time; this layers this session's own follow/unfollow clicks on top so
   * the number moves immediately, without needing a refetch. */
  netFollowers: (id: string, base: number) => number;
  interested: string[]; // event ids the user marked "Interested"
  toggleInterested: (eventId: string) => void;
  featured: Featured[];
  requestFeatured: (input: Omit<Featured, 'id' | 'status' | 'createdAt'>) => void;
  followers: Person[]; // real GET /me/followers — who follows me, as full profiles
  followersLoading: boolean;
  myVenues: Venue[];
  addMyVenue: (v: Venue) => void;
  updateMyVenue: (id: string, patch: Partial<Venue>) => void;
  // Keyed per event, not one flat value — opening promoter A's link for
  // event X and, days later, promoter B's link for event Y must not cost
  // promoter A their credit on event X when it's finally booked. Persisted
  // (see the pb_promoter_refs effect below) so a reload never loses it either.
  promoterRefByEvent: Record<string, string>;
  setPromoterRefForEvent: (eventId: string, slug: string) => void;
  clearPromoterRefForEvent: (eventId: string) => void;
  // Same per-event keying/persistence as promoterRefByEvent, just for the
  // sub-promoter tag (?via=) on the ticket link — independent of ref since a
  // link could carry ref without via (no team member) or vice versa isn't
  // meaningful, but keeping it a separate map avoids coupling their lifetimes.
  promoterViaByEvent: Record<string, string>;
  setPromoterViaForEvent: (eventId: string, handle: string) => void;
  clearPromoterViaForEvent: (eventId: string) => void;
  toastMsg: string | null;
  toast: (msg: string) => void;
  /** Real "am I on someone's team" access — set only for an invited
   * organizer team member (not the real owner, who uses the normal
   * isOrganizer path). null while logged out or if the logged-in user
   * isn't staff anywhere; see orgTeamAccessLoaded to distinguish "still
   * loading" from "confirmed not staff". See orgTeam.mine(). */
  orgTeamAccess: OrgTeamAccess | null;
  /** False until the orgTeamAccess bootstrap fetch resolves (or is skipped
   * because there's no session) — OrganizerLayout must wait for this before
   * treating a null orgTeamAccess as "definitely not on a team," otherwise
   * a team member's console flashes the onboarding redirect on every load
   * (the fetch is async; orgTeamAccess is null on the very first render
   * regardless of whether they're staff). */
  orgTeamAccessLoaded: boolean;
}

const Ctx = createContext<AppState>(null as unknown as AppState);

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

/** One number = one role. If a stored user somehow holds more than one elevated
 * role (legacy data), collapse it to a plain guest. */
function normalizeUser(u: User | null): User | null {
  if (!u) return u;
  const roles = [u.isOrganizer, u.isPromoter, u.isLineup, u.isVenue].filter(Boolean).length;
  let next = u;
  if (roles > 1) next = { ...next, isOrganizer: false, isPromoter: false, isLineup: false, isVenue: false };
  // Cached pre-socialLinks users (localStorage from before this field existed) won't have it.
  if (!next.socialLinks) next = { ...next, socialLinks: {} };
  return next;
}

/** The real backend's toApiUser() never sends `pendingRole` (see
 * auth.service.ts) — only `roleStatus` paired with the role-specific brand
 * field set at submission time. The pending/rejected-review screens
 * (OrganizerLayout/VenueLayout/etc.) gate on `pendingRole` though, so it has
 * to be derived client-side from whichever brand field is actually set. */
function inferPendingRole(u: User): User['pendingRole'] {
  if (u.roleStatus !== 'pending' && u.roleStatus !== 'rejected') return undefined;
  if (u.orgBrand) return 'organizer';
  if (u.promoterBrand) return 'promoter';
  if (u.lineupName) return 'lineup';
  if (u.venueName) return 'venue';
  return undefined;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => normalizeUser(load('pb_user', null)));
  // 'Austin' was the original mock-data default, from before this app
  // localized to the Indian market — anyone who visited before this fix has
  // it permanently cached in pb_city (nothing ever prompted a re-pick).
  // 'Austin' was never a real, selectable option in TOP_CITIES either, so
  // no real visitor could have deliberately chosen it — safe to treat it as
  // "never set" and self-heal to the real default on their next load,
  // without touching any other city a guest actually did pick.
  const [city, setCity] = useState<string>(() => {
    const cached = load<string>('pb_city', 'Hyderabad');
    return cached === 'Austin' ? 'Hyderabad' : cached;
  });
  const [bookings, setBookings] = useState<Booking[]>(() => load('pb_bookings', []));
  const [selection, setSelectionState] = useState<Selection | null>(() => load('pb_selection', null));
  const [holdExpiry, setHoldExpiry] = useState<number | null>(() => load('pb_hold_expiry', null));
  const [carts, setCarts] = useState<CartRecord[]>(() => load('pb_carts', []));
  const [myEvents, setMyEvents] = useState<Event[]>(() => load('pb_my_events', []));
  const [coupons, setCoupons] = useState<Coupon[]>(() => load('pb_coupons', COUPONS));
  // Real-backend + no token (logged out) never trusts whatever's cached in
  // localStorage for these four, even before logout()'s own reset runs —
  // a second layer against stale follow/wishlist/favourite state surviving
  // into a logged-out view (e.g. a tab that was already open across a
  // logout that happened some other way, or any future code path that
  // clears the session without going through the shared logout()).
  const loggedOutOnBoot = isBackendEnabled() && !getToken();
  const [following, setFollowing] = useState<string[]>(() =>
    loggedOutOnBoot ? [] : load('pb_following', ['livewire', 'nightowl', 'person:p1', 'person:p2', 'person:p3'])
  );
  // Net change to a followee's follower *count* this session, keyed by the
  // same followeeKey as `following` — the server-fetched count on each
  // profile/directory page is a snapshot from page-load time, so without
  // this, following/unfollowing updated the button state instantly but the
  // number next to it stayed frozen until a hard reload. Deliberately not
  // persisted to localStorage: it's a page-load-to-now nudge only, and a
  // fresh fetch after reload already carries the real server count.
  const [followerDeltas, setFollowerDeltas] = useState<Record<string, number>>({});
  const [interested, setInterested] = useState<string[]>(() => (loggedOutOnBoot ? [] : load('pb_interested', [])));
  const [featured, setFeatured] = useState<Featured[]>(() => {
    const stored = load('pb_featured', SEED_FEATURED);
    // backfill newly seeded placements (e.g. featured venues) into old localStorage
    const merged = [...stored];
    SEED_FEATURED.forEach((s) => {
      if (!merged.some((f) => f.id === s.id)) merged.push(s);
    });
    return merged;
  });
  // wallets + referrals are global (keyed by phone) so cross-user credits work in one browser
  const [wallets, setWallets] = useState<Record<string, WalletTx[]>>(() => load('pb_wallets', {}));
  const [referrals, setReferrals] = useState<Referral[]>(() => load('pb_referrals', []));
  const [refCodes, setRefCodes] = useState<Record<string, string>>(() => load('pb_ref_codes', {}));
  const [wishlist, setWishlist] = useState<string[]>(() => (loggedOutOnBoot ? [] : load('pb_wishlist', [])));
  const [favVenues, setFavVenues] = useState<string[]>(() => (loggedOutOnBoot ? [] : load('pb_fav_venues', [])));
  const [payMethodsMap, setPayMethodsMap] = useState<Record<string, PayMethod[]>>(() => load('pb_paymethods', {}));
  const [ticketsMap, setTicketsMap] = useState<Record<string, HelpTicket[]>>(() => load('pb_help_tickets', {}));
  const [waitlists, setWaitlists] = useState<Record<string, WaitlistEntry[]>>(() => load('pb_waitlists', {}));
  const [jobApps, setJobApps] = useState<JobApplication[]>(() => load('pb_job_apps', []));
  const [reviews, setReviews] = useState<Record<string, GuestReview[]>>(() => {
    const current = load<Record<string, GuestReview[]> | null>('pb_reviews', null);
    if (current) return current;
    // reviews used to be organizer-only under the key 'pb_org_reviews',
    // keyed by plain organizer id — migrate any pre-existing data into the
    // current reviewKey('organizer', id) shape instead of silently
    // dropping a guest's own already-written reviews when this key was
    // renamed for the promoter/venue/lineup generalization.
    const old = load<Record<string, GuestReview[]> | null>('pb_org_reviews', null);
    if (!old) return {};
    const migrated: Record<string, GuestReview[]> = {};
    for (const [orgId, list] of Object.entries(old)) migrated[reviewKey('organizer', orgId)] = list;
    return migrated;
  });
  // Real GET /me/followers, not localStorage — the old fake default
  // (['p4','p5'], two hardcoded seed people) meant every guest "had
  // followers" that didn't actually follow them.
  const [followers, setFollowers] = useState<Person[]>([]);
  const [followersLoading, setFollowersLoading] = useState(isBackendEnabled());
  // Real GET /wallet + GET /pay-methods — a real WalletTx/PayMethod backend
  // has existed the whole time, but the Wallet and Payment methods pages
  // only ever read/wrote the local pb_wallets/pb_paymethods maps, so a real
  // guest's balance there never matched what Checkout actually applies (it
  // fetches wallet.balance() itself). null = not fetched yet.
  const [liveWallet, setLiveWallet] = useState<{ balance: number; txs: WalletTx[] } | null>(null);
  const [livePayMethods, setLivePayMethods] = useState<PayMethod[] | null>(null);
  // Real GET /referrals — the local `myReferralCode` below (a client-side
  // recomputation of the same deterministic phone hash the backend also
  // uses at signup) happens to match today, but "your referrals" — who
  // actually joined/qualified via your link — was always empty for a real
  // guest since nothing ever fetched it. Sourcing both from the one real
  // call removes the duplicated hash logic as a footgun too.
  const [liveReferrals, setLiveReferrals] = useState<{ code: string; referrals: Referral[] } | null>(null);
  // Real GET /support/tickets — HelpCenter used to only ever write to the
  // local pb_help_tickets map, so a guest's raised ticket never reached
  // admin and "Your tickets" always showed the same fake local echo.
  const [liveHelpTickets, setLiveHelpTickets] = useState<HelpTicket[] | null>(null);
  const [pendingPhone, setPendingPhone] = useState('');
  const [pendingRequestId, setPendingRequestId] = useState('');
  const [orgTeamAccess, setOrgTeamAccess] = useState<OrgTeamAccess | null>(null);
  const [orgTeamAccessLoaded, setOrgTeamAccessLoaded] = useState(() => !isBackendEnabled() || !getToken());
  const [myVenues, setMyVenues] = useState<Venue[]>(() => {
    const v = load<Venue[]>('pb_myvenues', []);
    v.forEach(registerVenue);
    return v;
  });
  const [promoterRefByEvent, setPromoterRefByEvent] = useState<Record<string, string>>(() => load('pb_promoter_refs', {}));
  const setPromoterRefForEvent = (eventId: string, slug: string) =>
    setPromoterRefByEvent((prev) => (prev[eventId] === slug ? prev : { ...prev, [eventId]: slug }));
  const clearPromoterRefForEvent = (eventId: string) =>
    setPromoterRefByEvent((prev) => {
      if (!(eventId in prev)) return prev;
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  const [promoterViaByEvent, setPromoterViaByEvent] = useState<Record<string, string>>(() => load('pb_promoter_via', {}));
  const setPromoterViaForEvent = (eventId: string, handle: string) =>
    setPromoterViaByEvent((prev) => (prev[eventId] === handle ? prev : { ...prev, [eventId]: handle }));
  const clearPromoterViaForEvent = (eventId: string) =>
    setPromoterViaByEvent((prev) => {
      if (!(eventId in prev)) return prev;
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2200);
  }, []);

  useEffect(() => {
    localStorage.setItem('pb_user', JSON.stringify(user));
  }, [user]);
  // Refresh from the real backend once on mount — a role application getting
  // approved/rejected happens entirely server-side (admin panel), so the
  // locally-cached user (last written at login or at submission time) goes
  // stale until this catches it up. No polling — the console layouts
  // (OrganizerLayout etc.) already re-render off `user`, so a page load or
  // reload is when this matters, not while the tab sits open.
  useEffect(() => {
    if (!isBackendEnabled() || !getToken()) return;
    auth
      .me()
      .then((apiUser) => setUser(normalizeUser({ ...apiUser, pendingRole: inferPendingRole(apiUser) })))
      .catch(() => {}); // expired/invalid token — leave cached user as-is rather than force a logout on a transient error
  }, []);
  // Real follow/interested/wishlist/favourite state — a real backend (Follow/
  // EventInterest/EventWishlist/VenueFavourite models) has existed the whole
  // time, but toggleFollow etc. below only ever touched local state until
  // now. One bundled fetch to seed all four, mirroring how they used to boot
  // from localStorage together — real state then takes over from here via
  // the real POST/DELETE calls each toggle makes.
  useEffect(() => {
    if (!isBackendEnabled() || !getToken()) return;
    socialApi
      .mySocialState()
      .then((s) => {
        setFollowing(s.following);
        setInterested(s.interested);
        setWishlist(s.wishlist);
        setFavVenues(s.favouriteVenues);
      })
      .catch(() => {});
  }, []);
  // Real GET /me/followers — who follows me, as full Person profiles
  // (backed by GET /people/:username's User-based Follow lookup now that a
  // real guest profile can actually be a follow target). There's no
  // approval step for follows in this product (see SocialService.follow),
  // so unlike `following` above there's no "requests" queue to bootstrap.
  useEffect(() => {
    if (!isBackendEnabled() || !getToken()) return;
    socialApi
      .followers()
      .then(setFollowers)
      .catch(() => {})
      .finally(() => setFollowersLoading(false));
  }, []);
  const refreshWallet = useCallback(() => {
    if (!isBackendEnabled() || !getToken()) return;
    walletApi
      .balance()
      // the API returns Prisma's `createdAt`, not this type's `date` — apiFetch
      // doesn't transform responses, it's just a cast, so this normalizes it.
      .then((w) => setLiveWallet({ balance: w.balance, txs: w.txs.map((t) => ({ ...t, date: (t as unknown as { createdAt: string }).createdAt })) }))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshWallet();
    if (!isBackendEnabled() || !getToken()) return;
    walletApi.payMethods().then(setLivePayMethods).catch(() => {});
    referralsApi.mine().then(setLiveReferrals).catch(() => {});
    supportApi.tickets().then(setLiveHelpTickets).catch(() => {});
  }, [refreshWallet]);
  // Real "am I on an organizer's team" bootstrap — an invited team member
  // isn't isOrganizer (that flag is reserved for the real KYC-approved
  // owner), so OrganizerLayout needs this separately to decide whether to
  // let a non-owner into a permission-scoped console at all.
  useEffect(() => {
    if (!isBackendEnabled() || !getToken()) return;
    orgTeamApi
      .mine()
      .then(setOrgTeamAccess)
      .catch(() => {})
      .finally(() => setOrgTeamAccessLoaded(true));
  }, []);
  useEffect(() => {
    localStorage.setItem('pb_city', JSON.stringify(city));
  }, [city]);
  useEffect(() => {
    localStorage.setItem('pb_bookings', JSON.stringify(bookings));
  }, [bookings]);
  useEffect(() => {
    localStorage.setItem('pb_selection', JSON.stringify(selection));
  }, [selection]);
  useEffect(() => {
    localStorage.setItem('pb_hold_expiry', JSON.stringify(holdExpiry));
  }, [holdExpiry]);
  useEffect(() => {
    localStorage.setItem('pb_carts', JSON.stringify(carts));
  }, [carts]);
  useEffect(() => {
    localStorage.setItem('pb_my_events', JSON.stringify(myEvents));
  }, [myEvents]);
  useEffect(() => {
    localStorage.setItem('pb_coupons', JSON.stringify(coupons));
  }, [coupons]);
  useEffect(() => {
    localStorage.setItem('pb_following', JSON.stringify(following));
  }, [following]);
  useEffect(() => {
    localStorage.setItem('pb_interested', JSON.stringify(interested));
  }, [interested]);
  useEffect(() => {
    localStorage.setItem('pb_featured', JSON.stringify(featured));
  }, [featured]);
  useEffect(() => {
    localStorage.setItem('pb_wallets', JSON.stringify(wallets));
  }, [wallets]);
  useEffect(() => {
    localStorage.setItem('pb_referrals', JSON.stringify(referrals));
  }, [referrals]);
  useEffect(() => {
    localStorage.setItem('pb_ref_codes', JSON.stringify(refCodes));
  }, [refCodes]);
  useEffect(() => {
    localStorage.setItem('pb_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);
  useEffect(() => {
    localStorage.setItem('pb_fav_venues', JSON.stringify(favVenues));
  }, [favVenues]);
  useEffect(() => {
    localStorage.setItem('pb_paymethods', JSON.stringify(payMethodsMap));
  }, [payMethodsMap]);
  useEffect(() => {
    localStorage.setItem('pb_help_tickets', JSON.stringify(ticketsMap));
  }, [ticketsMap]);
  useEffect(() => {
    localStorage.setItem('pb_waitlists', JSON.stringify(waitlists));
  }, [waitlists]);
  useEffect(() => {
    localStorage.setItem('pb_job_apps', JSON.stringify(jobApps));
  }, [jobApps]);
  useEffect(() => {
    localStorage.setItem('pb_reviews', JSON.stringify(reviews));
  }, [reviews]);
  useEffect(() => {
    localStorage.setItem('pb_promoter_refs', JSON.stringify(promoterRefByEvent));
  }, [promoterRefByEvent]);
  useEffect(() => {
    localStorage.setItem('pb_promoter_via', JSON.stringify(promoterViaByEvent));
  }, [promoterViaByEvent]);
  // register the logged-in user's referral code so /r/:code can resolve it
  useEffect(() => {
    if (user?.phone) {
      const c = referralCodeFor(user.phone);
      setRefCodes((prev) => (prev[c] === user.phone ? prev : { ...prev, [c]: user.phone }));
    }
  }, [user?.phone]);
  useEffect(() => {
    localStorage.setItem('pb_myvenues', JSON.stringify(myVenues));
  }, [myVenues]);
  const creditWallet = useCallback((phone: string, tx: Omit<WalletTx, 'id' | 'date'>) => {
    setWallets((prev) => ({
      ...prev,
      [phone]: [
        { ...tx, id: 'wtx' + Date.now() + Math.random().toString(36).slice(2, 6), date: new Date().toISOString() },
        ...(prev[phone] ?? []),
      ],
    }));
  }, []);

  const walletTxs = isBackendEnabled() ? (liveWallet?.txs ?? []) : user ? (wallets[user.phone] ?? []) : [];
  const walletBalance = isBackendEnabled() ? (liveWallet?.balance ?? 0) : walletTxs.reduce((a, t) => a + t.amount, 0);

  const value = useMemo<AppState>(
    () => ({
      user,
      city,
      bookings,
      selection,
      myEvents,
      coupons,
      following,
      pendingPhone,
      setCity,
      setPendingPhone,
      requestOtp: async (phone) => {
        setPendingPhone(phone);
        if (!isBackendEnabled()) return;
        const res = await auth.requestOtp(phone);
        setPendingRequestId(res.requestId);
        track('otp_requested');
      },
      loginWithOtp: async (code) => {
        if (isBackendEnabled()) {
          const { token, user: apiUser, isNew } = await auth.verifyOtp(pendingRequestId, code);
          track('otp_verified');
          // GA4 standard events — isNew distinguishes a first-time signup
          // from a returning login, same distinction the rest of the app
          // already makes off this same verifyOtp() response.
          pushEvent(isNew ? 'sign_up' : 'login', { method: 'whatsapp_otp' });
          // Meta has no standard "Login" event — only fire for a genuine
          // new signup, same isNew distinction as the GA4 call above.
          if (isNew) trackMeta('CompleteRegistration', { method: 'whatsapp_otp' });
          setToken(token);
          setUser(normalizeUser({ ...apiUser, pendingRole: inferPendingRole(apiUser) }));
          // Bootstrap effects above only run once on mount (before a token
          // existed) — a fresh in-SPA login needs its own fetch so a team
          // member's console access is ready the moment they land on
          // /organizer, not only after a page reload. Awaited (not
          // fire-and-forget) so the caller (Otp.tsx) can make its
          // skip-guest-funnel navigation decision off the real result
          // instead of stale context.
          const access = await orgTeamApi.mine().catch(() => null);
          setOrgTeamAccess(access);
          setOrgTeamAccessLoaded(true);
          if (isNew) {
            const pendingRef = load<string | null>('pb_pending_ref', null);
            if (pendingRef) {
              referralsApi.claim(pendingRef).catch(() => {});
              localStorage.removeItem('pb_pending_ref');
            }
          }
          return { status: isNew ? 'new' : 'existing', isTeamMember: !!access };
        }
        // ---- offline/mock mode (no VITE_API_URL) — unchanged local fallback ----
        const existing = normalizeUser(load<User | null>('pb_known_' + pendingPhone, null));
        if (existing) {
          localStorage.setItem('pb_known_' + existing.phone, JSON.stringify(existing));
          setUser(existing);
          return { status: 'existing', isTeamMember: false };
        }
        const fresh: User = {
          phone: pendingPhone,
          name: '',
          username: '',
          email: '',
          city,
          dob: '',
          gender: '',
          profession: '',
          languages: '',
          bio: '',
          socials: '',
          socialLinks: {},
          interests: [],
          phoneVerified: true,
          idVerified: false,
          profilePct: 20,
          joined: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          isOrganizer: false,
          attendanceVisibility: 'off',
        };
        setUser(fresh);
        notify(fresh.phone, 'welcome', { name: fresh.name });
        // referral attribution — welcome credit for the referee, tracked for the referrer
        const pendingRef = load<string | null>('pb_pending_ref', null);
        if (pendingRef) {
          const referrerPhone = refCodes[pendingRef];
          if (
            referrerPhone &&
            referrerPhone !== fresh.phone &&
            !referrals.some((r) => r.refereePhone === fresh.phone)
          ) {
            setReferrals((prev) => [
              ...prev,
              { code: pendingRef, referrerPhone, refereePhone: fresh.phone, status: 'joined', createdAt: new Date().toISOString() },
            ]);
            creditWallet(fresh.phone, {
              type: 'referral_welcome',
              amount: REFERRAL_CONFIG.referee,
              note: 'Welcome credit — joined via a friend’s referral link',
            });
            notify(fresh.phone, 'referral_welcome', { amount: String(REFERRAL_CONFIG.referee) });
          }
          localStorage.removeItem('pb_pending_ref');
        }
        return { status: 'new', isTeamMember: false };
      },
      updateUser: (patch) => {
        setUser((u) => {
          if (!u) return u;
          const next = normalizeUser({ ...u, ...patch })!;
          localStorage.setItem('pb_known_' + next.phone, JSON.stringify(next));
          return next;
        });
      },
      submitRoleApplication: (kind, patch) => {
        setUser((u) => {
          if (!u) return u;
          const next = normalizeUser({ ...u, ...patch, pendingRole: kind, roleStatus: 'pending', roleRejectionReason: undefined })!;
          localStorage.setItem('pb_known_' + next.phone, JSON.stringify(next));
          return next;
        });
      },
      // Real follow/interested/wishlist/favourite/followers state is
      // per-account (bootstrapped from the real backend on login — see the
      // mySocialState/social.followers() effects above), but this only ever
      // cleared the auth token — the arrays themselves, and their
      // localStorage cache, stayed exactly as they were. A logged-out
      // visitor (or a second guest logging in on the same device) would
      // still see "Following ✓" on everything the previous session followed,
      // since nothing here or on next boot ever re-fetched to overwrite it.
      logout: () => {
        setUser(null);
        setOrgTeamAccess(null);
        setOrgTeamAccessLoaded(true);
        setFollowing([]);
        setFollowers([]);
        setFollowerDeltas({});
        setInterested([]);
        setWishlist([]);
        setFavVenues([]);
        localStorage.removeItem('pb_following');
        localStorage.removeItem('pb_interested');
        localStorage.removeItem('pb_wishlist');
        localStorage.removeItem('pb_fav_venues');
        clearToken();
      },
      // changing the cart always resets any active hold; checkout re-arms it on entry
      setSelection: (s) => {
        setSelectionState(s);
        setHoldExpiry(null);
      },
      holdExpiry,
      startHold: () => setHoldExpiry(Date.now() + CART_HOLD_MINUTES * 60000),
      setHold: (expiresAt) => setHoldExpiry(expiresAt),
      clearHold: () => setHoldExpiry(null),
      carts,
      captureCart: (c) =>
        setCarts((prev) => {
          const existing = prev.find((x) => x.id === c.id);
          const rec: CartRecord = {
            ...c,
            createdAt: existing?.createdAt ?? c.createdAt,
            updatedAt: new Date().toISOString(),
            status: 'active',
          };
          return existing ? prev.map((x) => (x.id === c.id ? rec : x)) : [rec, ...prev];
        }),
      setCartStatus: (id, status) =>
        setCarts((prev) =>
          prev.map((x) => (x.id === id ? { ...x, status, updatedAt: new Date().toISOString() } : x))
        ),
      remindCart: (id) =>
        setCarts((prev) => prev.map((x) => (x.id === id ? { ...x, remindedAt: new Date().toISOString() } : x))),
      addBooking: (b) => {
        setBookings((prev) => [b, ...prev]);
        const ev = eventById(b.eventId) ?? myEvents.find((e) => e.id === b.eventId);
        notify(b.whatsapp, 'booking_confirmed', { name: b.mainGuest, event: ev?.title ?? 'your event', qty: String(b.qty), id: b.id, total: String(b.total) }, user?.email || undefined);
        // referral qualification — the referee's first paid booking rewards the referrer
        if (user) {
          const r = referrals.find((x) => x.refereePhone === user.phone && x.status === 'joined');
          if (r) {
            setReferrals((prev) =>
              prev.map((x) =>
                x.refereePhone === r.refereePhone ? { ...x, status: 'qualified' as const, refereeName: user.name || undefined } : x
              )
            );
            creditWallet(r.referrerPhone, {
              type: 'referral_reward',
              amount: REFERRAL_CONFIG.referrer,
              note: `Referral reward — ${user.name || 'your friend'} made their first booking`,
            });
            notify(r.referrerPhone, 'referral_reward', { amount: String(REFERRAL_CONFIG.referrer), friend: user.name || 'Your friend' });
          }
        }
      },
      cancelBooking: (id) =>
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' as const } : b))
        ),
      refundBooking: (id, method) => {
        const b = bookings.find((x) => x.id === id);
        if (!b || !user) return;
        setBookings((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'refunded' as const } : x)));
        if (method === 'wallet') {
          creditWallet(user.phone, { type: 'refund', amount: b.total, note: `Instant refund — booking ${b.id}` });
          toast(`₹${b.total} refunded to your wallet instantly ✓`);
          notify(user.phone, 'refund_wallet', { id: b.id, amount: String(b.total) }, user.email || undefined);
        } else {
          toast('Refund initiated to your payment method — lands in 5–7 business days');
          notify(user.phone, 'refund_source', { id: b.id, amount: String(b.total) }, user.email || undefined);
        }
        // a spot opened — offer it to the first person waiting (FIFO)
        setWaitlists((prev) => {
          const q = prev[b.eventId] ?? [];
          const idx = q.findIndex((w) => w.status === 'waiting');
          if (idx === -1) return prev;
          const evt = eventById(b.eventId) ?? myEvents.find((e) => e.id === b.eventId);
          notify(q[idx].phone, 'waitlist_offer', { name: q[idx].name, event: evt?.title ?? 'the event', link: `${window.location.origin}/events/${evt?.slug ?? ''}` });
          return { ...prev, [b.eventId]: q.map((w, i) => (i === idx ? { ...w, status: 'offered' as const } : w)) };
        });
      },
      walletTxs,
      walletBalance,
      refreshWallet,
      spendWallet: (amount, note) => {
        if (user && amount > 0) creditWallet(user.phone, { type: 'spend', amount: -amount, note });
      },
      myReferralCode: isBackendEnabled() ? (liveReferrals?.code ?? '') : user ? referralCodeFor(user.phone) : '',
      referrals: isBackendEnabled() ? (liveReferrals?.referrals ?? []) : referrals,
      wishlist,
      toggleWishlist: (eventId) => {
        // Real login required — this used to update local state optimistically
        // even for a logged-out visitor (isBackendEnabled()&&getToken() only
        // gated the *real* API call), so the button looked like it worked but
        // nothing ever persisted and the visitor got no explanation why.
        if (!user) {
          toast('Log in to save this to your wishlist');
          return;
        }
        const nowOn = !wishlist.includes(eventId);
        setWishlist((prev) => (prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [eventId, ...prev]));
        if (isBackendEnabled() && getToken()) {
          socialApi.wishlist(eventId, nowOn).catch(() => {
            setWishlist((prev) => (nowOn ? prev.filter((e) => e !== eventId) : [eventId, ...prev]));
          });
        }
      },
      favVenues,
      toggleFavVenue: (venueId) => {
        if (!user) {
          toast('Log in to save your favourite venues');
          return;
        }
        const nowOn = !favVenues.includes(venueId);
        setFavVenues((prev) => (prev.includes(venueId) ? prev.filter((v) => v !== venueId) : [venueId, ...prev]));
        if (isBackendEnabled() && getToken()) {
          socialApi.favVenue(venueId, nowOn).catch(() => {
            setFavVenues((prev) => (nowOn ? prev.filter((v) => v !== venueId) : [venueId, ...prev]));
          });
        }
      },
      payMethods: isBackendEnabled() ? (livePayMethods ?? []) : user ? (payMethodsMap[user.phone] ?? []) : [],
      addPayMethod: (m) => {
        if (!user) return;
        if (isBackendEnabled()) {
          walletApi
            .addPayMethod(m)
            .then((created) => setLivePayMethods((prev) => [...(prev ?? []), created]))
            .catch(() => toast('Could not save that payment method — try again'));
          return;
        }
        setPayMethodsMap((prev) => {
          const cur = prev[user.phone] ?? [];
          return { ...prev, [user.phone]: [...cur, { ...m, id: 'pm' + Date.now(), isDefault: cur.length === 0 }] };
        });
      },
      removePayMethod: (id) => {
        if (!user) return;
        if (isBackendEnabled()) {
          setLivePayMethods((prev) => (prev ?? []).filter((m) => m.id !== id));
          walletApi.removePayMethod(id).catch(() => walletApi.payMethods().then(setLivePayMethods).catch(() => {}));
          return;
        }
        setPayMethodsMap((prev) => ({ ...prev, [user.phone]: (prev[user.phone] ?? []).filter((m) => m.id !== id) }));
      },
      setDefaultPayMethod: (id) => {
        if (!user) return;
        if (isBackendEnabled()) {
          setLivePayMethods((prev) => (prev ?? []).map((m) => ({ ...m, isDefault: m.id === id })));
          walletApi.setDefault(id).catch(() => walletApi.payMethods().then(setLivePayMethods).catch(() => {}));
          return;
        }
        setPayMethodsMap((prev) => ({
          ...prev,
          [user.phone]: (prev[user.phone] ?? []).map((m) => ({ ...m, isDefault: m.id === id })),
        }));
      },
      waitlists,
      joinWaitlist: (eventId) => {
        if (!user) {
          toast('Log in to join the waitlist');
          return;
        }
        setWaitlists((prev) => {
          const q = prev[eventId] ?? [];
          if (q.some((w) => w.phone === user.phone)) return prev;
          return {
            ...prev,
            [eventId]: [...q, { phone: user.phone, name: user.name || 'Guest', joinedAt: new Date().toISOString(), status: 'waiting' as const }],
          };
        });
        // Real join — was local-state-only before (a real WaitlistEntry
        // model + FIFO offer-on-refund logic existed in the backend the
        // whole time, just never invoked). The local update above is an
        // optimistic mirror for instant UI feedback; EventDetail.tsx
        // re-fetches the real queue right after this resolves for the
        // authoritative count/position.
        if (isBackendEnabled() && getToken()) {
          bookingsApi.waitlistJoin(eventId).catch(() => {});
        }
        toast('You’re on the waitlist — we’ll ping you the moment a spot opens ✓');
      },
      reviews,
      addReview: (targetType, targetId, rating, text, eventTitle) => {
        if (!user) return;
        const key = reviewKey(targetType, targetId);
        setReviews((prev) => ({
          ...prev,
          [key]: [
            { id: 'grv' + Date.now(), author: user.name || 'Guest', rating, eventTitle, text, date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) },
            ...(prev[key] ?? []),
          ],
        }));
        toast('Review posted ✓');
      },
      jobApps,
      applyJob: (a, cv) => {
        if (isBackendEnabled()) {
          careersApi
            .apply(a, cv)
            .then((created) => {
              setJobApps((prev) => [created, ...prev]);
              toast('Application sent — the team will reach out on email ✓');
            })
            .catch((e) => toast((e as Error).message ?? 'Could not submit — try again'));
          return;
        }
        setJobApps((prev) => [
          { ...a, id: 'app' + Date.now(), cv: cv?.name, appliedAt: new Date().toISOString() },
          ...prev,
        ]);
        toast('Application sent — the team will reach out on email ✓');
      },
      helpTickets: isBackendEnabled() ? (liveHelpTickets ?? []) : user ? (ticketsMap[user.phone] ?? []) : [],
      addHelpTicket: (t) => {
        if (!user) return;
        if (isBackendEnabled()) {
          supportApi
            .raise(t)
            .then((created) => setLiveHelpTickets((prev) => [created, ...(prev ?? [])]))
            .catch(() => toast('Could not submit your ticket — try again'));
          return;
        }
        const tid = 'HT-' + Math.floor(1000 + Math.random() * 8999);
        setTicketsMap((prev) => ({
          ...prev,
          [user.phone]: [
            { ...t, id: tid, status: 'open' as const, createdAt: new Date().toISOString() },
            ...(prev[user.phone] ?? []),
          ],
        }));
        notify(user.phone, 'help_ticket', { id: tid, subject: t.subject, topic: t.topic }, user.email || undefined);
      },
      checkInBooking: (id, count) =>
        setBookings((prev) =>
          prev.map((b) =>
            b.id === id
              ? {
                  ...b,
                  guests: b.guests.map((g, i) => ({ ...g, checkedIn: i < count })),
                }
              : b
          )
        ),
      addEvent: (e) => setMyEvents((prev) => [e, ...prev]),
      upsertEvent: (e) =>
        setMyEvents((prev) =>
          prev.some((x) => x.id === e.id) ? prev.map((x) => (x.id === e.id ? e : x)) : [e, ...prev]
        ),
      addCoupon: (c) => setCoupons((prev) => [c, ...prev]),
      updateCoupon: (id, patch) =>
        setCoupons((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c))),
      removeCoupon: (id) => setCoupons((prev) => prev.filter((c) => c.id !== id)),
      toggleCoupon: (id) =>
        setCoupons((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, status: c.status === 'active' ? 'paused' : 'active' } : c
          )
        ),
      toggleFollow: (id) => {
        if (!user) {
          toast('Log in to follow');
          return;
        }
        const nowFollowing = !following.includes(id);
        const delta = nowFollowing ? 1 : -1;
        setFollowing((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
        setFollowerDeltas((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + delta }));
        if (isBackendEnabled() && getToken()) {
          (nowFollowing ? socialApi.follow(id) : socialApi.unfollow(id)).catch(() => {
            // real call failed — revert both optimistic local updates
            setFollowing((prev) => (nowFollowing ? prev.filter((f) => f !== id) : [...prev, id]));
            setFollowerDeltas((prev) => ({ ...prev, [id]: (prev[id] ?? 0) - delta }));
          });
        }
      },
      followerDeltas,
      netFollowers: (id, base) => base + (followerDeltas[id] ?? 0),
      featured,
      requestFeatured: (input) => {
        if (user) notify(user.phone, 'featured_submitted', { amount: String(input.amount), what: `${input.type} (${input.refId})` }, user.email || undefined);
        setFeatured((prev) => [
          { ...input, id: 'ft' + Date.now(), status: 'pending' as const, createdAt: new Date().toISOString() },
          ...prev.filter((f) => !(f.type === input.type && f.refId === input.refId)),
        ]);
      },
      interested,
      toggleInterested: (eventId) => {
        if (!user) {
          toast('Log in to mark yourself interested');
          return;
        }
        const nowOn = !interested.includes(eventId);
        setInterested((prev) =>
          prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [eventId, ...prev]
        );
        if (isBackendEnabled() && getToken()) {
          socialApi.interested(eventId, nowOn).catch(() => {
            setInterested((prev) => (nowOn ? prev.filter((e) => e !== eventId) : [eventId, ...prev]));
          });
        }
      },
      followers,
      followersLoading,
      myVenues,
      addMyVenue: (v) => {
        registerVenue(v);
        setMyVenues((prev) => [...prev, v]);
      },
      updateMyVenue: (id, patch) => {
        setMyVenues((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
        const live = VENUES.find((v) => v.id === id); // keep public pages in sync mid-session
        if (live) Object.assign(live, patch);
      },
      promoterRefByEvent,
      setPromoterRefForEvent,
      clearPromoterRefForEvent,
      promoterViaByEvent,
      setPromoterViaForEvent,
      clearPromoterViaForEvent,
      toastMsg,
      toast,
      orgTeamAccess,
      orgTeamAccessLoaded,
    }),
    [user, city, bookings, selection, holdExpiry, carts, myEvents, coupons, following, followerDeltas, interested, featured, wallets, referrals, liveReferrals, refCodes, walletTxs, walletBalance, refreshWallet, creditWallet, wishlist, favVenues, payMethodsMap, livePayMethods, ticketsMap, liveHelpTickets, waitlists, jobApps, reviews, followers, followersLoading, pendingPhone, pendingRequestId, myVenues, promoterRefByEvent, promoterViaByEvent, toastMsg, toast, orgTeamAccess, orgTeamAccessLoaded]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => useContext(Ctx);

// eslint-disable-next-line react-refresh/only-export-components
export const allEvents = (myEvents: Event[]) => [...myEvents, ...EVENTS];
