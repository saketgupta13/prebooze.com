import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
  arrived?: boolean;
}

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

interface Selection {
  eventId: string;
  qty: Record<string, number>; // tierId -> qty
}

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
  const [selection, setSelection] = useState<Selection | null>(null);
  const [myEvents, setMyEvents] = useState<Event[]>(() => load('pb_my_events', []));
  const [coupons, setCoupons] = useState<Coupon[]>(() => load('pb_coupons', COUPONS));
  const [following, setFollowing] = useState<string[]>(() =>
    load('pb_following', ['livewire', 'nightowl'])
  );
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
    localStorage.setItem('pb_my_events', JSON.stringify(myEvents));
  }, [myEvents]);
  useEffect(() => {
    localStorage.setItem('pb_coupons', JSON.stringify(coupons));
  }, [coupons]);
  useEffect(() => {
    localStorage.setItem('pb_following', JSON.stringify(following));
  }, [following]);

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
      setSelection,
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
    }),
    [user, city, bookings, selection, myEvents, coupons, following, pendingPhone, orgBalance, withdrawals, team, orgPrefs, glist, customLineups, myVenues]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => useContext(Ctx);

// eslint-disable-next-line react-refresh/only-export-components
export const allEvents = (myEvents: Event[]) => [...myEvents, ...EVENTS];
