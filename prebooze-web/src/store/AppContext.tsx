import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Booking, Coupon, Event, User, Venue } from '../types';
import { registerVenue } from '../data/mock';
import { COUPONS, EVENTS } from '../data/mock';

export interface GuestListEntry {
  id: string;
  eventId: string;
  name: string;
  phone?: string;
  plusOnes: number;
  companions?: { name: string; phone?: string }[];
  addedBy?: string;
  arrived?: boolean;
}

export interface OrgPermSet {
  view: boolean;
  edit: boolean;
}

/** role name -> module -> permissions (organizer team) */
export type OrgRoleMatrix = Record<string, Record<string, OrgPermSet>>;

export const ORG_PERM_MODULES = [
  'Events & wizard',
  'Attendees & check-in',
  'Guest list',
  'Coupons',
  'Payouts & withdrawals',
  'Reviews',
  'Settings & team',
];

const orgPerms = (view: boolean, edit: boolean) => ({ view, edit });
const ORG_ROLE_SEED: OrgRoleMatrix = {
  Owner: Object.fromEntries(ORG_PERM_MODULES.map((m) => [m, orgPerms(true, true)])),
  Manager: {
    'Events & wizard': orgPerms(true, true),
    'Attendees & check-in': orgPerms(true, true),
    'Guest list': orgPerms(true, true),
    Coupons: orgPerms(true, true),
    'Payouts & withdrawals': orgPerms(true, false),
    Reviews: orgPerms(true, false),
    'Settings & team': orgPerms(true, false),
  },
  'Door staff': {
    'Events & wizard': orgPerms(false, false),
    'Attendees & check-in': orgPerms(true, true),
    'Guest list': orgPerms(true, true),
    Coupons: orgPerms(false, false),
    'Payouts & withdrawals': orgPerms(false, false),
    Reviews: orgPerms(false, false),
    'Settings & team': orgPerms(false, false),
  },
  Promoter: {
    'Events & wizard': orgPerms(true, false),
    'Attendees & check-in': orgPerms(true, false),
    'Guest list': orgPerms(true, true),
    Coupons: orgPerms(true, false),
    'Payouts & withdrawals': orgPerms(false, false),
    Reviews: orgPerms(true, false),
    'Settings & team': orgPerms(false, false),
  },
};

export interface TeamMember {
  name: string;
  role: string;
  scan: boolean;
}

export interface OrgPrefs {
  whatsapp: boolean;
  emailDigest: boolean;
  refundWindow: string;
}

export interface Withdrawal {
  id: string;
  amount: number;
  date: string;
  status: 'processing' | 'paid';
}

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
}

export interface SubPromoter {
  handle: string;
  name: string;
  hue: number;
}

interface Selection {
  eventId: string;
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
  loginWithOtp: () => 'new' | 'existing';
  updateUser: (patch: Partial<User>) => void;
  logout: () => void;
  setSelection: (s: Selection | null) => void;
  holdExpiry: number | null; // epoch ms when the current checkout hold lapses
  startHold: () => void;
  clearHold: () => void;
  carts: CartRecord[];
  captureCart: (c: Omit<CartRecord, 'status' | 'updatedAt'>) => void;
  setCartStatus: (id: string, status: CartRecord['status']) => void;
  remindCart: (id: string) => void;
  addBooking: (b: Booking) => void;
  cancelBooking: (id: string) => void;
  checkInBooking: (id: string, count: number) => void;
  addEvent: (e: Event) => void;
  upsertEvent: (e: Event) => void;
  addCoupon: (c: Coupon) => void;
  updateCoupon: (id: string, patch: Partial<Coupon>) => void;
  removeCoupon: (id: string) => void;
  toggleCoupon: (id: string) => void;
  toggleFollow: (id: string) => void;
  interested: string[]; // event ids the user marked "Interested"
  toggleInterested: (eventId: string) => void;
  orgBalance: number;
  withdrawals: Withdrawal[];
  withdraw: (amount: number) => void;
  team: TeamMember[];
  addTeamMember: (m: TeamMember) => void;
  removeTeamMember: (name: string) => void;
  orgPrefs: OrgPrefs;
  updateOrgPrefs: (patch: Partial<OrgPrefs>) => void;
  glist: GuestListEntry[];
  addGlist: (g: GuestListEntry) => void;
  removeGlist: (id: string) => void;
  toggleGlistArrived: (id: string) => void;
  customLineups: { name: string; role: string }[];
  addCustomLineup: (l: { name: string; role: string }) => void;
  myVenues: Venue[];
  addMyVenue: (v: Venue) => void;
  promoterGuests: PromoterGuest[];
  addPromoterGuest: (g: PromoterGuest) => void;
  checkInPromoterGuest: (id: string) => void;
  promoterPlans: Record<string, string>; // promoter slug -> plan id (for public quota lookup)
  setPromoterPlan: (slug: string, planId: string) => void;
  pendingPromoterRef: string | null; // promoter slug to credit for an in-progress paid booking
  setPendingPromoterRef: (slug: string | null) => void;
  promoterWithdrawals: Withdrawal[];
  promoterWithdraw: (amount: number) => void;
  promoterTeam: SubPromoter[];
  addSubPromoter: (s: SubPromoter) => void;
  removeSubPromoter: (handle: string) => void;
  toastMsg: string | null;
  toast: (msg: string) => void;
  updateTeamRole: (name: string, role: string) => void;
  orgRoles: OrgRoleMatrix;
  setOrgRolePerm: (role: string, module: string, key: keyof OrgPermSet, value: boolean) => void;
  addOrgRole: (name: string) => void;
  removeOrgRole: (name: string) => boolean;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => load('pb_user', null));
  const [city, setCity] = useState<string>(() => load('pb_city', 'Austin'));
  const [bookings, setBookings] = useState<Booking[]>(() => load('pb_bookings', []));
  const [selection, setSelectionState] = useState<Selection | null>(() => load('pb_selection', null));
  const [holdExpiry, setHoldExpiry] = useState<number | null>(() => load('pb_hold_expiry', null));
  const [carts, setCarts] = useState<CartRecord[]>(() => load('pb_carts', []));
  const [myEvents, setMyEvents] = useState<Event[]>(() => load('pb_my_events', []));
  const [coupons, setCoupons] = useState<Coupon[]>(() => load('pb_coupons', COUPONS));
  const [following, setFollowing] = useState<string[]>(() =>
    load('pb_following', ['livewire', 'nightowl', 'person:p1', 'person:p2', 'person:p3'])
  );
  const [interested, setInterested] = useState<string[]>(() => load('pb_interested', []));
  const [pendingPhone, setPendingPhone] = useState('');
  const [orgBalance, setOrgBalance] = useState<number>(() => load('pb_org_balance', 84320));
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>(() => load('pb_withdrawals', []));
  const [team, setTeam] = useState<TeamMember[]>(() =>
    load('pb_team', [
      { name: 'You (owner)', role: 'Owner', scan: true },
      { name: 'Meera J.', role: 'Manager', scan: true },
      { name: 'Ravi D.', role: 'Door staff', scan: true },
    ])
  );
  const [orgPrefs, setOrgPrefs] = useState<OrgPrefs>(() =>
    load('pb_orgprefs', { whatsapp: true, emailDigest: true, refundWindow: '48h' })
  );
  const [glist, setGlist] = useState<GuestListEntry[]>(() => load('pb_glist', []));
  const [customLineups, setCustomLineups] = useState<{ name: string; role: string }[]>(() =>
    load('pb_customlineups', [])
  );
  const [myVenues, setMyVenues] = useState<Venue[]>(() => {
    const v = load<Venue[]>('pb_myvenues', []);
    v.forEach(registerVenue);
    return v;
  });
  const [orgRoles, setOrgRoles] = useState<OrgRoleMatrix>(() => load('pb_orgroles', ORG_ROLE_SEED));
  const [promoterGuests, setPromoterGuests] = useState<PromoterGuest[]>(() => load('pb_promoter_guests', []));
  const [promoterPlans, setPromoterPlans] = useState<Record<string, string>>(() => load('pb_promoter_plans', {}));
  const [promoterWithdrawals, setPromoterWithdrawals] = useState<Withdrawal[]>(() => load('pb_promoter_withdrawals', []));
  const [promoterTeam, setPromoterTeam] = useState<SubPromoter[]>(() => load('pb_promoter_team', []));
  const [pendingPromoterRef, setPendingPromoterRef] = useState<string | null>(null);
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
    localStorage.setItem('pb_org_balance', JSON.stringify(orgBalance));
  }, [orgBalance]);
  useEffect(() => {
    localStorage.setItem('pb_withdrawals', JSON.stringify(withdrawals));
  }, [withdrawals]);
  useEffect(() => {
    localStorage.setItem('pb_team', JSON.stringify(team));
  }, [team]);
  useEffect(() => {
    localStorage.setItem('pb_orgprefs', JSON.stringify(orgPrefs));
  }, [orgPrefs]);
  useEffect(() => {
    localStorage.setItem('pb_glist', JSON.stringify(glist));
  }, [glist]);
  useEffect(() => {
    localStorage.setItem('pb_customlineups', JSON.stringify(customLineups));
  }, [customLineups]);
  useEffect(() => {
    localStorage.setItem('pb_myvenues', JSON.stringify(myVenues));
  }, [myVenues]);
  useEffect(() => {
    localStorage.setItem('pb_orgroles', JSON.stringify(orgRoles));
  }, [orgRoles]);
  useEffect(() => {
    localStorage.setItem('pb_promoter_guests', JSON.stringify(promoterGuests));
  }, [promoterGuests]);
  useEffect(() => {
    localStorage.setItem('pb_promoter_plans', JSON.stringify(promoterPlans));
  }, [promoterPlans]);
  useEffect(() => {
    localStorage.setItem('pb_promoter_withdrawals', JSON.stringify(promoterWithdrawals));
  }, [promoterWithdrawals]);
  useEffect(() => {
    localStorage.setItem('pb_promoter_team', JSON.stringify(promoterTeam));
  }, [promoterTeam]);

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
      loginWithOtp: () => {
        const existing = load<User | null>('pb_known_' + pendingPhone, null);
        if (existing) {
          setUser(existing);
          return 'existing';
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
          interests: [],
          phoneVerified: true,
          idVerified: false,
          profilePct: 20,
          joined: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          isOrganizer: false,
          attendanceVisibility: 'off',
        };
        setUser(fresh);
        return 'new';
      },
      updateUser: (patch) => {
        setUser((u) => {
          if (!u) return u;
          const next = { ...u, ...patch };
          localStorage.setItem('pb_known_' + next.phone, JSON.stringify(next));
          return next;
        });
      },
      logout: () => setUser(null),
      // changing the cart always resets any active hold; checkout re-arms it on entry
      setSelection: (s) => {
        setSelectionState(s);
        setHoldExpiry(null);
      },
      holdExpiry,
      startHold: () => setHoldExpiry(Date.now() + CART_HOLD_MINUTES * 60000),
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
      addBooking: (b) => setBookings((prev) => [b, ...prev]),
      cancelBooking: (id) =>
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' as const } : b))
        ),
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
      toggleFollow: (id) =>
        setFollowing((prev) =>
          prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
        ),
      interested,
      toggleInterested: (eventId) =>
        setInterested((prev) =>
          prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [eventId, ...prev]
        ),
      orgBalance,
      withdrawals,
      withdraw: (amount) => {
        setOrgBalance((b) => Math.max(0, b - amount));
        setWithdrawals((prev) => [
          {
            id: 'w' + Date.now(),
            amount,
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
            status: 'processing' as const,
          },
          ...prev,
        ]);
      },
      team,
      addTeamMember: (m) => setTeam((prev) => [...prev, m]),
      removeTeamMember: (name) => setTeam((prev) => prev.filter((m) => m.name !== name)),
      orgPrefs,
      updateOrgPrefs: (patch) => setOrgPrefs((prev) => ({ ...prev, ...patch })),
      glist,
      addGlist: (g) => setGlist((prev) => [g, ...prev]),
      removeGlist: (id) => setGlist((prev) => prev.filter((g) => g.id !== id)),
      toggleGlistArrived: (id) =>
        setGlist((prev) => prev.map((g) => (g.id === id ? { ...g, arrived: !g.arrived } : g))),
      customLineups,
      addCustomLineup: (l) => setCustomLineups((prev) => [...prev, l]),
      myVenues,
      addMyVenue: (v) => {
        registerVenue(v);
        setMyVenues((prev) => [...prev, v]);
      },
      promoterGuests,
      addPromoterGuest: (g) => setPromoterGuests((prev) => [g, ...prev]),
      checkInPromoterGuest: (id) =>
        setPromoterGuests((prev) => prev.map((g) => (g.id === id ? { ...g, arrived: !g.arrived } : g))),
      promoterPlans,
      setPromoterPlan: (slug, planId) =>
        setPromoterPlans((prev) => ({ ...prev, [slug]: planId })),
      pendingPromoterRef,
      setPendingPromoterRef,
      promoterWithdrawals,
      promoterWithdraw: (amount) =>
        setPromoterWithdrawals((prev) => [
          {
            id: 'pw' + Date.now(),
            amount,
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
            status: 'processing' as const,
          },
          ...prev,
        ]),
      promoterTeam,
      addSubPromoter: (s) =>
        setPromoterTeam((prev) => (prev.some((m) => m.handle === s.handle) ? prev : [...prev, s])),
      removeSubPromoter: (handle) => setPromoterTeam((prev) => prev.filter((m) => m.handle !== handle)),
      toastMsg,
      toast,
      updateTeamRole: (name, role) => {
        setTeam((prev) => prev.map((m) => (m.name === name ? { ...m, role } : m)));
        toast(`${name} is now ${role} ✓`);
      },
      orgRoles,
      setOrgRolePerm: (role, module, key, value) =>
        setOrgRoles((prev) => ({
          ...prev,
          [role]: { ...prev[role], [module]: { ...prev[role][module], [key]: value } },
        })),
      addOrgRole: (name) => {
        setOrgRoles((prev) =>
          prev[name]
            ? prev
            : {
                ...prev,
                [name]: Object.fromEntries(ORG_PERM_MODULES.map((m) => [m, { view: true, edit: false }])),
              }
        );
        toast(`Role "${name}" created ✓`);
      },
      removeOrgRole: (name) => {
        if (name === 'Owner') {
          toast("The Owner role can't be removed");
          return false;
        }
        if (team.some((m) => m.role === name)) {
          toast(`Reassign members using "${name}" first`);
          return false;
        }
        setOrgRoles((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
        toast(`Role "${name}" removed`);
        return true;
      },
    }),
    [user, city, bookings, selection, holdExpiry, carts, myEvents, coupons, following, interested, pendingPhone, orgBalance, withdrawals, team, orgPrefs, glist, customLineups, myVenues, orgRoles, promoterGuests, promoterPlans, pendingPromoterRef, promoterWithdrawals, promoterTeam, toastMsg, toast]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => useContext(Ctx);

// eslint-disable-next-line react-refresh/only-export-components
export const allEvents = (myEvents: Event[]) => [...myEvents, ...EVENTS];
