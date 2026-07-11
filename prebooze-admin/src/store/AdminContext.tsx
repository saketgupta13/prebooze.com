import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AdminBooking,
  Notification,
  AdminEvent,
  Banner,
  Blog,
  Category,
  Customer,
  Organizer,
  PermSet,
  Promo,
  Role,
  RoleMatrix,
  Settings,
  SitePage,
  StaffMember,
  Venue,
} from '../types';
import {
  SEED_BANNERS,
  SEED_BLOGS,
  SEED_BOOKINGS,
  SEED_CATEGORIES,
  SEED_CUSTOMERS,
  SEED_EVENTS,
  SEED_ORGANIZERS,
  SEED_PAGES,
  SEED_NOTIFICATIONS,
  SEED_PROMOS,
  SEED_ROLES,
  SEED_SETTINGS,
  SEED_STAFF,
  SEED_VENUES,
  PERM_MODULES,
} from './data';

interface Session {
  role: Role;
  email: string;
  name?: string;
}

interface AdminState {
  session: Session | null;
  events: AdminEvent[];
  bookings: AdminBooking[];
  customers: Customer[];
  organizers: Organizer[];
  venues: Venue[];
  promos: Promo[];
  banners: Banner[];
  categories: Category[];
  blogs: Blog[];
  pages: SitePage[];
  staff: StaffMember[];
  roles: RoleMatrix;
  settings: Settings;
  toastMsg: string | null;
  login: (role: Role, email: string) => void;
  logout: () => void;
  toast: (msg: string) => void;
  addEvent: (e: AdminEvent) => void;
  updateEvent: (id: string, patch: Partial<AdminEvent>) => void;
  updateStaffRole: (name: string, role: string) => void;
  removeStaff: (name: string) => void;
  setRolePerm: (role: string, module: string, key: keyof PermSet, value: boolean) => void;
  addRole: (name: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  approveEvent: (id: string) => void;
  rejectEvent: (id: string) => void;
  resolveRefund: (bookingId: string, approve: boolean) => void;
  toggleBlockCustomer: (id: string) => void;
  setOrganizerStatus: (id: string, status: Organizer['status']) => void;
  addOrganizer: (o: Organizer) => void;
  updateOrganizer: (id: string, patch: Partial<Organizer>) => void;
  addVenue: (v: Venue) => void;
  updateVenue: (id: string, patch: Partial<Venue>) => void;
  addPromo: (p: Promo) => void;
  updatePromo: (code: string, patch: Partial<Promo>) => void;
  runPayoutBatch: (eventIds: string[]) => void;
  notifications: Notification[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addCustomer: (c: Customer) => void;
  updateSession: (patch: Partial<Session>) => void;
  addBanner: (b: Banner) => void;
  addCategory: (c: Category) => void;
  addBlog: (b: Blog) => void;
  addPage: (p: SitePage) => void;
  addStaff: (s: StaffMember) => void;
}

const Ctx = createContext<AdminState>(null as unknown as AdminState);

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

/** Backfill fields added after the user's data was saved: stored values win, seed fills gaps. */
function mergeWithSeed<T extends object>(seed: T[], idKey: keyof T) {
  return (list: T[]) =>
    list.map((item) => {
      const base = seed.find((x) => x[idKey] === item[idKey]);
      return base ? { ...base, ...item } : item;
    });
}

function usePersisted<T>(key: string, seed: T, migrate?: (v: T) => T) {
  const [value, setValue] = useState<T>(() => {
    const v = load(key, seed);
    return migrate ? migrate(v) : v;
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = usePersisted<Session | null>('pba_session', null);
  const [events, setEvents] = usePersisted('pba_events', SEED_EVENTS);
  const [bookings, setBookings] = usePersisted('pba_bookings', SEED_BOOKINGS, (list) =>
    // schema migration: bookings stored before the guests field existed
    list.map((b) => ({ ...b, guests: b.guests ?? [`${b.guest} (main)`] }))
  );
  const [customers, setCustomers] = usePersisted('pba_customers', SEED_CUSTOMERS);
  const [organizers, setOrganizers] = usePersisted('pba_organizers', SEED_ORGANIZERS, mergeWithSeed(SEED_ORGANIZERS, 'id'));
  const [venues, setVenues] = usePersisted('pba_venues', SEED_VENUES, mergeWithSeed(SEED_VENUES, 'id'));
  const [promos, setPromos] = usePersisted('pba_promos', SEED_PROMOS, mergeWithSeed(SEED_PROMOS, 'code'));
  const [banners, setBanners] = usePersisted('pba_banners', SEED_BANNERS);
  const [categories, setCategories] = usePersisted('pba_categories', SEED_CATEGORIES);
  const [blogs, setBlogs] = usePersisted('pba_blogs', SEED_BLOGS);
  const [pages, setPages] = usePersisted('pba_pages', SEED_PAGES);
  const [staff, setStaff] = usePersisted('pba_staff', SEED_STAFF);
  const [roles, setRoles] = usePersisted('pba_roles', SEED_ROLES);
  const [notifications, setNotifications] = usePersisted<Notification[]>('pba_notifications', SEED_NOTIFICATIONS);
  const [settings, setSettings] = usePersisted('pba_settings', SEED_SETTINGS);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const value = useMemo<AdminState>(
    () => ({
      session,
      events,
      bookings,
      customers,
      organizers,
      venues,
      promos,
      banners,
      categories,
      blogs,
      pages,
      staff,
      roles,
      settings,
      toastMsg,
      toast,
      login: (role, email) => {
        setSession({ role, email });
        toast('Welcome back ✓');
      },
      logout: () => setSession(null),
      addEvent: (e) => {
        setEvents((prev) => [e, ...prev]);
        toast('Event created ✓');
      },
      updateEvent: (id, patch) =>
        setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e))),
      updateStaffRole: (name, role) => {
        setStaff((prev) => prev.map((s) => (s.name === name ? { ...s, role } : s)));
        toast(`${name.split(' ·')[0]} is now ${role} ✓`);
      },
      removeStaff: (name) => {
        setStaff((prev) => prev.filter((s) => s.name !== name));
        toast('Staff member removed');
      },
      setRolePerm: (role, module, key, value) =>
        setRoles((prev) => ({
          ...prev,
          [role]: {
            ...prev[role],
            [module]: { ...prev[role][module], [key]: value },
          },
        })),
      addRole: (name) => {
        setRoles((prev) => ({
          ...prev,
          [name]: Object.fromEntries(
            PERM_MODULES.map((m) => [m, { view: true, edit: false, approve: false }])
          ),
        }));
        toast(`Role "${name}" created ✓`);
      },
      updateSettings: (patch) => setSettings((prev) => ({ ...prev, ...patch })),
      approveEvent: (id) => {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === id ? { ...e, status: 'live', commission: e.commission ?? 10 } : e
          )
        );
        toast('Event approved ✓');
      },
      rejectEvent: (id) => {
        setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status: 'draft' } : e)));
        toast('Event rejected — moved to drafts');
      },
      resolveRefund: (bookingId, approve) => {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId ? { ...b, status: approve ? 'refunded' : 'paid' } : b
          )
        );
        toast(approve ? 'Refund approved ✓' : 'Refund declined');
      },
      toggleBlockCustomer: (id) => {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, status: c.status === 'blocked' ? 'active' : 'blocked' }
              : c
          )
        );
        toast('Customer status updated');
      },
      setOrganizerStatus: (id, status) => {
        setOrganizers((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
        const name = organizers.find((o) => o.id === id)?.name ?? 'Organizer';
        toast(status === 'approved' ? `${name} approved ✓` : `${name} rejected`);
      },
      addOrganizer: (o) => {
        setOrganizers((prev) => [...prev, o]);
        toast('Invite sent — organizer added as Pending review ✓');
      },
      updateOrganizer: (id, patch) => {
        setOrganizers((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
        toast('Organizer profile saved ✓');
      },
      addVenue: (v) => {
        setVenues((prev) => [...prev, v]);
        toast('Venue added — Docs pending until license reviewed ✓');
      },
      updateVenue: (id, patch) => {
        setVenues((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
        toast('Venue saved ✓');
      },
      updatePromo: (code, patch) => {
        setPromos((prev) => prev.map((p) => (p.code === code ? { ...p, ...patch } : p)));
        toast('Promo code saved ✓');
      },
      runPayoutBatch: (eventIds) => {
        const utr = () => 'UTR' + Math.floor(100000000 + Math.random() * 899999999);
        setEvents((prev) =>
          prev.map((e) => (eventIds.includes(e.id) ? { ...e, paidOut: true, payoutUtr: utr() } : e))
        );
        setNotifications((prev) => [
          {
            id: 'n' + Date.now(),
            icon: '💸',
            text: `Payout batch processed — ${eventIds.length} transfer${eventIds.length === 1 ? '' : 's'} initiated`,
            time: 'just now',
            read: false,
            to: '/payments',
          },
          ...prev,
        ]);
        toast(`Payout batch of ${eventIds.length} processed ✓`);
      },
      notifications,
      markNotificationRead: (id) =>
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))),
      markAllNotificationsRead: () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        toast('All notifications marked read ✓');
      },
      addCustomer: (c) => {
        setCustomers((prev) => [c, ...prev]);
        setNotifications((prev) => [
          { id: 'n' + Date.now(), icon: '👥', text: `${c.name} onboarded manually by admin`, time: 'just now', read: true, to: '/customers' },
          ...prev,
        ]);
        toast(`${c.name} onboarded ✓`);
      },
      updateSession: (patch) => {
        setSession((prev) => (prev ? { ...prev, ...patch } : prev));
        toast('Profile updated ✓');
      },
      addPromo: (p) => {
        setPromos((prev) => [p, ...prev]);
        toast('Promo code created ✓');
      },
      addBanner: (b) => {
        setBanners((prev) => [...prev, b]);
        toast('Banner added ✓');
      },
      addCategory: (c) => {
        setCategories((prev) => [...prev, c]);
        toast('Category added ✓');
      },
      addBlog: (b) => {
        setBlogs((prev) => [b, ...prev]);
        toast('Draft saved ✓');
      },
      addPage: (p) => {
        setPages((prev) => [...prev, p]);
        toast('Page created ✓');
      },
      addStaff: (s) => {
        setStaff((prev) => [...prev, s]);
        toast('Invite sent ✓');
      },
    }),
    [session, events, bookings, customers, organizers, venues, promos, banners, categories, blogs, pages, staff, roles, settings, notifications, toastMsg, toast, setSession, setEvents, setBookings, setCustomers, setOrganizers, setVenues, setPromos, setBanners, setCategories, setBlogs, setPages, setStaff, setRoles, setSettings, setNotifications]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAdmin = () => useContext(Ctx);
