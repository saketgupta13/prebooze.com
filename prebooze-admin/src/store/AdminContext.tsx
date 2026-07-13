import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AbandonedCart,
  AdminBooking,
  AdminReview,
  LocCountry,
  LocPath,
  Promoter,
  BlogCategory,
  FaqItem,
  MenuConfig,
  Policy,
  Testimonial,
  Lineup,
  GuestEntry,
  LedgerEntry,
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
  LINEUP_CATEGORIES,
  SEED_BANNERS,
  SEED_BLOGS,
  SEED_BOOKINGS,
  SEED_CATEGORIES,
  SEED_CUSTOMERS,
  SEED_EVENTS,
  SEED_ORGANIZERS,
  SEED_PAGES,
  SEED_BLOG_CATEGORIES,
  SEED_GUEST_LIST,
  SEED_LEDGER,
  SEED_LEDGER_CATEGORIES,
  SEED_LINEUPS,
  SEED_NOTIFICATIONS,
  SEED_FAQS,
  SEED_MENUS,
  SEED_POLICIES,
  SEED_PROMOS,
  SEED_PROMOTERS,
  SEED_ABANDONED_CARTS,
  SEED_LOCATIONS,
  SEED_SUB_TIERS,
  SEED_REVIEWS,
  SEED_TESTIMONIALS,
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
  updateBanner: (id: string, patch: Partial<Banner>) => void;
  removeBanner: (id: string) => void;
  addCategory: (c: Category) => void;
  updateCategory: (name: string, patch: Partial<Category>) => void;
  addBlog: (b: Blog) => void;
  updateBlog: (id: string, patch: Partial<Blog>) => void;
  blogCategories: BlogCategory[];
  addBlogCategory: (c: BlogCategory) => void;
  addPage: (p: SitePage) => void;
  updatePage: (slug: string, patch: Partial<SitePage>) => void;
  addStaff: (s: StaffMember) => void;
  ledger: LedgerEntry[];
  ledgerCategories: { income: string[]; expense: string[] };
  addLedgerEntry: (e: LedgerEntry) => void;
  removeLedgerEntry: (id: string) => void;
  addLedgerCategory: (kind: 'income' | 'expense', name: string) => void;
  guestList: GuestEntry[];
  addGuestEntry: (g: GuestEntry) => void;
  removeGuestEntry: (id: string) => void;
  toggleGuestArrived: (id: string) => void;
  addBooking: (b: AdminBooking) => void;
  lineups: Lineup[];
  lineupCategories: string[];
  addLineup: (l: Lineup) => void;
  updateLineup: (id: string, patch: Partial<Lineup>) => void;
  removeLineup: (id: string) => void;
  addLineupCategory: (name: string) => void;
  removeEvent: (id: string) => void;
  removeCustomer: (id: string) => void;
  removeOrganizer: (id: string) => void;
  removeBooking: (id: string) => void;
  removePromo: (code: string) => void;
  removeBlog: (id: string) => void;
  removePage: (slug: string) => void;
  removeCategory: (name: string) => void;
  removeRole: (name: string) => void;
  removeVenue: (id: string) => void;
  reviews: AdminReview[];
  updateReview: (id: string, patch: Partial<AdminReview>) => void;
  removeReview: (id: string) => void;
  testimonials: Testimonial[];
  addTestimonial: (t: Testimonial) => void;
  updateTestimonial: (id: string, patch: Partial<Testimonial>) => void;
  removeTestimonial: (id: string) => void;
  faqs: FaqItem[];
  addFaq: (f: FaqItem) => void;
  updateFaq: (id: string, patch: Partial<FaqItem>) => void;
  removeFaq: (id: string) => void;
  policies: Policy[];
  updatePolicy: (id: string, patch: Partial<Policy>) => void;
  menus: MenuConfig;
  setMenus: (m: MenuConfig) => void;
  promoters: Promoter[];
  setPromoterStatus2: (id: string, status: Promoter['status']) => void;
  addPromoter: (p: Promoter) => void;
  updatePromoter: (id: string, patch: Partial<Promoter>) => void;
  removePromoter2: (id: string) => void;
  subTiers: { id: string; name: string; price: number; guests: number }[];
  updateSubTier: (id: string, patch: { name?: string; price?: number; guests?: number }) => void;
  abandonedCarts: AbandonedCart[];
  remindCart2: (id: string) => void;
  bulkRemind: (ids: string[]) => void;
  locations: LocCountry[];
  addLocation: (level: 'country' | 'state' | 'city', path: LocPath, name: string) => void;
  toggleLocation: (path: LocPath) => void;
  removeLocation: (path: LocPath) => void;
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
  const [events, setEvents] = usePersisted('pba_events', SEED_EVENTS, mergeWithSeed(SEED_EVENTS, 'id'));
  const [bookings, setBookings] = usePersisted('pba_bookings', SEED_BOOKINGS, (list) =>
    // schema migration: bookings stored before the guests field existed
    list.map((b) => ({ ...b, guests: b.guests ?? [`${b.guest} (main)`] }))
  );
  const [customers, setCustomers] = usePersisted('pba_customers', SEED_CUSTOMERS);
  const [organizers, setOrganizers] = usePersisted('pba_organizers', SEED_ORGANIZERS, mergeWithSeed(SEED_ORGANIZERS, 'id'));
  const [venues, setVenues] = usePersisted('pba_venues', SEED_VENUES, mergeWithSeed(SEED_VENUES, 'id'));
  const [promos, setPromos] = usePersisted('pba_promos', SEED_PROMOS, mergeWithSeed(SEED_PROMOS, 'code'));
  const [banners, setBanners] = usePersisted('pba_banners', SEED_BANNERS, (list) =>
    mergeWithSeed(SEED_BANNERS, 'title')(list).map((b, i) => ({ ...b, id: b.id ?? 'b' + (i + 1) }))
  );
  const [categories, setCategories] = usePersisted('pba_categories', SEED_CATEGORIES);
  const [blogs, setBlogs] = usePersisted('pba_blogs', SEED_BLOGS, (list) =>
    mergeWithSeed(SEED_BLOGS, 'title')(list).map((b, i) => ({ ...b, id: b.id ?? 'bl' + (i + 1) }))
  );
  const [pages, setPages] = usePersisted('pba_pages', SEED_PAGES, (list) => [
    ...list,
    ...SEED_PAGES.filter((sp) => !list.some((p) => p.slug === sp.slug)),
  ]);
  const [staff, setStaff] = usePersisted('pba_staff', SEED_STAFF, mergeWithSeed(SEED_STAFF, 'name'));
  const [blogCategories, setBlogCategories] = usePersisted<BlogCategory[]>('pba_blogcats', SEED_BLOG_CATEGORIES);
  const [ledger, setLedger] = usePersisted<LedgerEntry[]>('pba_ledger', SEED_LEDGER);
  const [ledgerCategories, setLedgerCategories] = usePersisted('pba_ledgercats', SEED_LEDGER_CATEGORIES);
  const [guestList, setGuestList] = usePersisted<GuestEntry[]>('pba_guestlist', SEED_GUEST_LIST);
  const [roles, setRoles] = usePersisted('pba_roles', SEED_ROLES);
  const [notifications, setNotifications] = usePersisted<Notification[]>('pba_notifications', SEED_NOTIFICATIONS);
  const [settings, setSettings] = usePersisted('pba_settings', SEED_SETTINGS, (v) => ({
    ...SEED_SETTINGS,
    ...v,
    socials: { ...SEED_SETTINGS.socials, ...(v as Partial<typeof SEED_SETTINGS>).socials },
    siteSeo: { ...SEED_SETTINGS.siteSeo, ...(v as Partial<typeof SEED_SETTINGS>).siteSeo },
    contact: { ...SEED_SETTINGS.contact, ...(v as Partial<typeof SEED_SETTINGS>).contact },
  }));
  const [lineups, setLineups] = usePersisted<Lineup[]>('pba_lineups', SEED_LINEUPS);
  const [reviews, setReviews] = usePersisted<AdminReview[]>('pba_reviews', SEED_REVIEWS);
  const [testimonials, setTestimonials] = usePersisted<Testimonial[]>('pba_testimonials', SEED_TESTIMONIALS);
  const [faqs, setFaqs] = usePersisted<FaqItem[]>('pba_faqs', SEED_FAQS);
  const [policies, setPolicies] = usePersisted<Policy[]>('pba_policies', SEED_POLICIES);
  const [menus, setMenusState] = usePersisted<MenuConfig>('pba_menus', SEED_MENUS);
  const [promoters, setPromoters] = usePersisted<Promoter[]>('pba_promoters', SEED_PROMOTERS, mergeWithSeed(SEED_PROMOTERS, 'id'));
  const [subTiers, setSubTiers] = usePersisted('pba_subtiers', SEED_SUB_TIERS);
  const [abandonedCarts, setAbandonedCarts] = usePersisted<AbandonedCart[]>('pba_abandoned', SEED_ABANDONED_CARTS, mergeWithSeed(SEED_ABANDONED_CARTS, 'id'));
  const [locations, setLocations] = usePersisted<LocCountry[]>('pba_locations', SEED_LOCATIONS);
  const [lineupCategories, setLineupCategories] = usePersisted<string[]>('pba_lineupcats', LINEUP_CATEGORIES);
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
      updateBanner: (id, patch) => {
        setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
        toast('Banner saved ✓');
      },
      removeBanner: (id) => {
        setBanners((prev) => prev.filter((b) => b.id !== id));
        toast('Banner removed');
      },
      updateCategory: (name, patch) => {
        setCategories((prev) => prev.map((c) => (c.name === name ? { ...c, ...patch } : c)));
        toast('Category saved ✓');
      },
      updateBlog: (id, patch) => {
        setBlogs((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
        toast('Post saved ✓');
      },
      blogCategories,
      addBlogCategory: (c) => {
        setBlogCategories((prev) => [...prev, c]);
        toast(`Blog category "${c.name}" created ✓`);
      },
      updatePage: (slug, patch) => {
        setPages((prev) => prev.map((p) => (p.slug === slug ? { ...p, ...patch } : p)));
        toast('Page saved ✓');
      },
      ledger,
      ledgerCategories,
      addLedgerEntry: (e) => {
        setLedger((prev) => [e, ...prev]);
        toast(`${e.kind === 'income' ? 'Income' : 'Expense'} of ₹${e.amount.toLocaleString('en-IN')} recorded ✓`);
      },
      removeLedgerEntry: (id) => {
        setLedger((prev) => prev.filter((e) => e.id !== id));
        toast('Entry removed');
      },
      addLedgerCategory: (kind, name) => {
        setLedgerCategories((prev) => ({ ...prev, [kind]: [...prev[kind], name] }));
        toast(`Category "${name}" added ✓`);
      },
      guestList,
      addGuestEntry: (g) => {
        setGuestList((prev) => [g, ...prev]);
        toast(`${g.name} added to guest list ✓`);
      },
      removeGuestEntry: (id) => {
        setGuestList((prev) => prev.filter((g) => g.id !== id));
        toast('Removed from guest list');
      },
      toggleGuestArrived: (id) =>
        setGuestList((prev) => prev.map((g) => (g.id === id ? { ...g, arrived: !g.arrived } : g))),
      addBooking: (b) => {
        setBookings((prev) => [b, ...prev]);
        toast(`Manual booking ${b.id} created ✓`);
      },
      lineups,
      lineupCategories,
      addLineup: (l) => {
        setLineups((prev) => [l, ...prev]);
        toast(`${l.name} added to line-ups ✓`);
      },
      updateLineup: (id, patch) => {
        setLineups((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
        toast('Line-up saved ✓');
      },
      removeLineup: (id) => {
        setLineups((prev) => prev.filter((l) => l.id !== id));
        toast('Line-up removed');
      },
      addLineupCategory: (name) => {
        setLineupCategories((prev) => (prev.includes(name) ? prev : [...prev, name]));
        toast(`Line-up category "${name}" added ✓`);
      },
      removeEvent: (id) => {
        setEvents((prev) => prev.filter((e) => e.id !== id));
        toast('Event removed');
      },
      removeCustomer: (id) => {
        setCustomers((prev) => prev.filter((c) => c.id !== id));
        toast('Customer removed');
      },
      removeOrganizer: (id) => {
        setOrganizers((prev) => prev.filter((o) => o.id !== id));
        toast('Organizer removed');
      },
      removeBooking: (id) => {
        setBookings((prev) => prev.filter((b) => b.id !== id));
        toast('Booking removed');
      },
      removePromo: (code) => {
        setPromos((prev) => prev.filter((p) => p.code !== code));
        toast(`Promo ${code} removed`);
      },
      removeBlog: (id) => {
        setBlogs((prev) => prev.filter((b) => b.id !== id));
        toast('Post removed');
      },
      removePage: (slug) => {
        setPages((prev) => prev.filter((p) => p.slug !== slug));
        toast('Page removed');
      },
      removeCategory: (name) => {
        setCategories((prev) => prev.filter((c) => c.name !== name));
        toast(`Category "${name}" removed`);
      },
      removeVenue: (id) => {
        setVenues((prev) => prev.filter((v) => v.id !== id));
        toast('Venue removed');
      },
      reviews,
      updateReview: (id, patch) => {
        setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
        toast('Review updated ✓');
      },
      removeReview: (id) => {
        setReviews((prev) => prev.filter((r) => r.id !== id));
        toast('Review removed');
      },
      testimonials,
      addTestimonial: (t) => {
        setTestimonials((prev) => [t, ...prev]);
        toast('Testimonial added ✓');
      },
      updateTestimonial: (id, patch) => {
        setTestimonials((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
        toast('Testimonial saved ✓');
      },
      removeTestimonial: (id) => {
        setTestimonials((prev) => prev.filter((t) => t.id !== id));
        toast('Testimonial removed');
      },
      faqs,
      addFaq: (f) => {
        setFaqs((prev) => [...prev, f]);
        toast('FAQ added ✓');
      },
      updateFaq: (id, patch) => {
        setFaqs((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
        toast('FAQ saved ✓');
      },
      removeFaq: (id) => {
        setFaqs((prev) => prev.filter((f) => f.id !== id));
        toast('FAQ removed');
      },
      policies,
      updatePolicy: (id, patch) => {
        setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch, updated: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) } : p)));
        toast('Policy saved ✓');
      },
      menus,
      setMenus: (m) => {
        setMenusState(m);
        toast('Menu saved ✓');
      },
      promoters,
      setPromoterStatus2: (id, status) => {
        setPromoters((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
        const name = promoters.find((p) => p.id === id)?.name ?? 'Promoter';
        toast(status === 'approved' ? `${name} approved ✓` : `${name} ${status}`);
      },
      addPromoter: (p) => {
        setPromoters((prev) => [p, ...prev]);
        toast('Promoter added — Pending review ✓');
      },
      updatePromoter: (id, patch) => {
        setPromoters((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
        toast('Promoter saved ✓');
      },
      removePromoter2: (id) => {
        setPromoters((prev) => prev.filter((p) => p.id !== id));
        toast('Promoter removed');
      },
      subTiers,
      updateSubTier: (id, patch) => {
        setSubTiers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
        toast('Subscription tier saved ✓');
      },
      abandonedCarts,
      remindCart2: (id) => {
        setAbandonedCarts((prev) => prev.map((c) => (c.id === id ? { ...c, reminded: true } : c)));
        toast('WhatsApp reminder sent ✓');
      },
      bulkRemind: (ids) => {
        setAbandonedCarts((prev) => prev.map((c) => (ids.includes(c.id) ? { ...c, reminded: true } : c)));
        toast(`Reminder sent to ${ids.length} guest${ids.length === 1 ? '' : 's'} ✓`);
      },
      locations,
      addLocation: (level, path, name) => {
        const n = name.trim();
        if (!n) return;
        setLocations((prev) => {
          if (level === 'country') {
            return prev.some((c) => c.name === n) ? prev : [...prev, { name: n, enabled: true, states: [] }];
          }
          return prev.map((c) => {
            if (c.name !== path.country) return c;
            if (level === 'state') {
              return c.states.some((s) => s.name === n) ? c : { ...c, states: [...c.states, { name: n, enabled: true, cities: [] }] };
            }
            return {
              ...c,
              states: c.states.map((s) =>
                s.name !== path.state ? s : (s.cities.some((ci) => ci.name === n) ? s : { ...s, cities: [...s.cities, { name: n, enabled: true }] })
              ),
            };
          });
        });
        toast(`${n} added ✓`);
      },
      toggleLocation: (path) => {
        setLocations((prev) =>
          prev.map((c) => {
            if (c.name !== path.country) return c;
            if (!path.state) return { ...c, enabled: !c.enabled };
            return {
              ...c,
              states: c.states.map((s) => {
                if (s.name !== path.state) return s;
                if (!path.city) return { ...s, enabled: !s.enabled };
                return { ...s, cities: s.cities.map((ci) => (ci.name === path.city ? { ...ci, enabled: !ci.enabled } : ci)) };
              }),
            };
          })
        );
      },
      removeLocation: (path) => {
        setLocations((prev) => {
          if (!path.state) return prev.filter((c) => c.name !== path.country);
          return prev.map((c) => {
            if (c.name !== path.country) return c;
            if (!path.city) return { ...c, states: c.states.filter((s) => s.name !== path.state) };
            return { ...c, states: c.states.map((s) => (s.name !== path.state ? s : { ...s, cities: s.cities.filter((ci) => ci.name !== path.city) })) };
          });
        });
        toast('Location removed');
      },
      removeRole: (name) => {
        if (name === 'Owner') {
          toast("The Owner role can't be removed");
          return;
        }
        if (staff.some((m) => m.role === name)) {
          toast(`Reassign members using "${name}" first`);
          return;
        }
        setRoles((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
        toast(`Role "${name}" removed`);
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
    [session, events, bookings, customers, organizers, venues, promos, banners, categories, blogs, pages, staff, roles, settings, notifications, blogCategories, ledger, ledgerCategories, guestList, lineups, lineupCategories, reviews, testimonials, faqs, policies, menus, promoters, subTiers, abandonedCarts, locations, toastMsg, toast, setSession, setEvents, setBookings, setCustomers, setOrganizers, setVenues, setPromos, setBanners, setCategories, setBlogs, setPages, setStaff, setRoles, setSettings, setNotifications, setBlogCategories, setLedger, setLedgerCategories, setGuestList, setLineups, setLineupCategories, setReviews, setTestimonials, setFaqs, setPolicies, setMenusState, setPromoters, setSubTiers, setAbandonedCarts, setLocations]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAdmin = () => useContext(Ctx);
