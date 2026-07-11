import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AdminBooking,
  AdminEvent,
  Banner,
  Blog,
  Category,
  Customer,
  Organizer,
  Promo,
  Role,
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
  SEED_PROMOS,
  SEED_STAFF,
  SEED_VENUES,
} from './data';

interface Session {
  role: Role;
  email: string;
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
  toastMsg: string | null;
  login: (role: Role, email: string) => void;
  logout: () => void;
  toast: (msg: string) => void;
  updateEvent: (id: string, patch: Partial<AdminEvent>) => void;
  approveEvent: (id: string) => void;
  rejectEvent: (id: string) => void;
  resolveRefund: (bookingId: string, approve: boolean) => void;
  toggleBlockCustomer: (id: string) => void;
  setOrganizerStatus: (id: string, status: Organizer['status']) => void;
  addOrganizer: (o: Organizer) => void;
  addVenue: (v: Venue) => void;
  addPromo: (p: Promo) => void;
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

function usePersisted<T>(key: string, seed: T) {
  const [value, setValue] = useState<T>(() => load(key, seed));
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = usePersisted<Session | null>('pba_session', null);
  const [events, setEvents] = usePersisted('pba_events', SEED_EVENTS);
  const [bookings, setBookings] = usePersisted('pba_bookings', SEED_BOOKINGS);
  const [customers, setCustomers] = usePersisted('pba_customers', SEED_CUSTOMERS);
  const [organizers, setOrganizers] = usePersisted('pba_organizers', SEED_ORGANIZERS);
  const [venues, setVenues] = usePersisted('pba_venues', SEED_VENUES);
  const [promos, setPromos] = usePersisted('pba_promos', SEED_PROMOS);
  const [banners, setBanners] = usePersisted('pba_banners', SEED_BANNERS);
  const [categories, setCategories] = usePersisted('pba_categories', SEED_CATEGORIES);
  const [blogs, setBlogs] = usePersisted('pba_blogs', SEED_BLOGS);
  const [pages, setPages] = usePersisted('pba_pages', SEED_PAGES);
  const [staff, setStaff] = usePersisted('pba_staff', SEED_STAFF);
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
      toastMsg,
      toast,
      login: (role, email) => {
        setSession({ role, email });
        toast('Welcome back ✓');
      },
      logout: () => setSession(null),
      updateEvent: (id, patch) =>
        setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e))),
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
      addVenue: (v) => {
        setVenues((prev) => [...prev, v]);
        toast('Venue added — Docs pending until license reviewed ✓');
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
    [session, events, bookings, customers, organizers, venues, promos, banners, categories, blogs, pages, staff, toastMsg, toast, setSession, setEvents, setBookings, setCustomers, setOrganizers, setVenues, setPromos, setBanners, setCategories, setBlogs, setPages, setStaff]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAdmin = () => useContext(Ctx);
