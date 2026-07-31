import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AbandonedCart,
  AdminBooking,
  AdminReview,
  FeaturedRequest,
  FeaturedRates,
  AdminReferral,
  ReferralRates,
  AdminJob,
  JobApplicant,
  Reel,
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
  KycApplication,
  EmailTemplateDef,
  EmailTemplateOverride,
  InvoiceRecord,
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
  SEED_FAQS,
  SEED_MENUS,
  SEED_POLICIES,
  SEED_PROMOS,
  SEED_PROMOTERS,
  SEED_ABANDONED_CARTS,
  SEED_LOCATIONS,
  SEED_FEATURED_REQUESTS,
  SEED_FEATURED_RATES,
  SEED_REFERRALS,
  SEED_REFERRAL_RATES,
  SEED_JOBS,
  SEED_APPLICANTS,
  SEED_REELS,
  SEED_SUB_TIERS,
  SEED_REVIEWS,
  SEED_TESTIMONIALS,
  SEED_ROLES,
  SEED_SETTINGS,
  SEED_STAFF,
  SEED_VENUES,
  SEED_KYC_APPLICATIONS,
  PERM_MODULES,
  EMAIL_TEMPLATE_DEFS,
  SEED_INVOICES,
} from './data';
import { liveApiEnabled, liveNotifications } from '../lib/liveApi';

/** Matches AbandonedCarts.tsx's own local timeAgo — not shared, same
 * scoped-inline-helper convention already used there. */
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

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
  kycApplications: KycApplication[];
  approveKycApplication: (id: string) => void;
  rejectKycApplication: (id: string, reason: string) => void;
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
  addReview: (r: Omit<AdminReview, 'id'>) => void;
  updateReview: (id: string, patch: Partial<AdminReview>) => void;
  removeReview: (id: string) => void;
  testimonials: Testimonial[];
  addTestimonial: (t: Testimonial) => void;
  updateTestimonial: (id: string, patch: Partial<Testimonial>) => void;
  removeTestimonial: (id: string) => void;
  emailTemplateDefs: EmailTemplateDef[];
  customEmailTemplates: EmailTemplateDef[];
  emailTemplateOverrides: EmailTemplateOverride[];
  addEmailTemplate: (input: { name: string; subject: string; bodyHtml: string }) => void;
  updateEmailTemplate: (id: string, patch: { subject: string; bodyHtml: string }) => void;
  resetEmailTemplate: (id: string) => void;
  removeCustomEmailTemplate: (id: string) => void;
  invoices: InvoiceRecord[];
  resendInvoiceEmail: (id: string) => void;
  resendInvoiceWhatsapp: (id: string) => void;
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
  featuredRequests: FeaturedRequest[];
  featuredRates: FeaturedRates;
  approveFeatured: (id: string) => void;
  rejectFeatured: (id: string) => void;
  remindFeatured: (id: string) => void;
  updateFeaturedRate: (patch: Partial<FeaturedRates>) => void;
  adminReferrals: AdminReferral[];
  referralRates: ReferralRates;
  updateReferralRate: (patch: Partial<ReferralRates>) => void;
  jobs: AdminJob[];
  addJob: (j: Omit<AdminJob, 'id' | 'status'>) => void;
  updateJob: (id: string, patch: Partial<AdminJob>) => void;
  teams: string[];
  addTeam: (name: string) => void;
  toggleJob: (id: string) => void;
  removeJob: (id: string) => void;
  applicants: JobApplicant[];
  reels: Reel[];
  addReel: (title: string, videoDataUrl: string) => void;
  toggleReel: (id: string) => void;
  removeReel: (id: string) => void;
  toggleTopCity: (path: LocPath) => void;
  setCityIcon: (path: LocPath, icon: string) => void;
  uploadCityIcon: (path: LocPath) => void;
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

/** Counterpart to mergeWithSeed for the "never mask phone numbers for
 * admin" fix: mergeWithSeed's "stored values win" rule means a bullet-
 * masked phone ('+91 98••• ••210') already sitting in someone's
 * localStorage from before that fix would keep winning over the now-real
 * seed value forever, since the field isn't missing, just wrong. Pulls the
 * real value from the matching seed record specifically when the stored
 * field still contains the mask, leaving every other stored edit alone. */
function unmaskStoredPhones<T extends object>(seed: T[], idKey: keyof T, phoneKeys: (keyof T)[]) {
  return (list: T[]) =>
    list.map((item) => {
      const base = seed.find((x) => x[idKey] === item[idKey]);
      if (!base) return item;
      const patch: Partial<T> = {};
      for (const k of phoneKeys) {
        const v = item[k];
        if (typeof v === 'string' && v.includes('••')) patch[k] = base[k];
      }
      return Object.keys(patch).length ? { ...item, ...patch } : item;
    });
}

const compose = <T,>(...fns: ((v: T) => T)[]) => (v: T) => fns.reduce((acc, fn) => fn(acc), v);

/** Appends any seed record whose id isn't already present in stored data.
 * mergeWithSeed only patches fields on records that already exist locally —
 * it never adds a brand-new seed row, so a seed addition (e.g. a new demo
 * venue/organizer/event) would never appear for anyone whose localStorage
 * predates it without this. */
function backfillMissingSeed<T extends object>(seed: T[], idKey: keyof T) {
  return (list: T[]) => [...list, ...seed.filter((s) => !list.some((l) => l[idKey] === s[idKey]))];
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
  const [events, setEvents] = usePersisted('pba_events', SEED_EVENTS, compose(mergeWithSeed(SEED_EVENTS, 'id'), backfillMissingSeed(SEED_EVENTS, 'id')));
  const [bookings, setBookings] = usePersisted('pba_bookings', SEED_BOOKINGS, (list) => {
    // Drop the very first demo booking set (#8412/#8420/#8419/#8415) —
    // predates both the structured-guests schema and the real-name refresh
    // — surgically, by id, rather than replacing the whole stored array.
    // A previous version of this migration did `return SEED_BOOKINGS`
    // whenever any stale id was found, which silently destroyed any real
    // booking a user had already created if it happened to be sitting
    // alongside the stale demo rows at the time — a real data-loss bug,
    // not just a display one. Filtering by id keeps every real booking
    // (Manual-booking ids are randomly generated in a different range, so
    // they never collide with the stale set) and only backfills the fresh
    // seed bookings that aren't already present, exactly once.
    const STALE_DEMO_IDS = new Set(['#8412', '#8420', '#8419', '#8415']);
    const withoutStale = list.filter((b) => !STALE_DEMO_IDS.has(b.id));
    const hadStale = withoutStale.length !== list.length;
    const withFreshSeed = hadStale
      ? [...SEED_BOOKINGS.filter((sb) => !withoutStale.some((b) => b.id === sb.id)), ...withoutStale]
      : withoutStale;
    // schema migration: bookings stored before `guests` was a structured
    // {name, phone, verified} array (either missing entirely, or an older
    // flat display-string array like "Sam Rivera ✓ (main)") — normalize
    // either shape into the current one instead of leaving raw strings
    // where BookingDetail.tsx now expects real objects.
    return withFreshSeed.map((b) => {
      const raw = (b.guests as unknown as (string | { name: string; phone?: string; verified?: boolean })[]) ?? [`${b.guest} (main)`];
      const guests = raw.map((g) =>
        typeof g === 'string'
          ? { name: g.replace(/\s*✓?\s*\(main\)\s*$/i, '').trim() || b.guest, phone: b.phone, verified: g.includes('✓') }
          : g
      );
      return { ...b, guests };
    });
  });
  const [customers, setCustomers] = usePersisted('pba_customers', SEED_CUSTOMERS, (list) =>
    // Customers is guests-only — the old "Organizers" segment was removed
    // (Organizers already has its own directory). mergeWithSeed backfills
    // new fields but never prunes a stored record that's no longer in the
    // seed at all, so anyone whose localStorage predates that removal would
    // keep seeing the old organizer-segment row (e.g. "LiveWire Ent.")
    // forever. Enforce the actual invariant directly instead of relying on
    // id-matching pruning: drop anything that isn't segment 'guests'.
    mergeWithSeed(SEED_CUSTOMERS, 'id')(list).filter((c) => c.segment === 'guests')
  );
  const [organizers, setOrganizers] = usePersisted(
    'pba_organizers', SEED_ORGANIZERS,
    compose(mergeWithSeed(SEED_ORGANIZERS, 'id'), unmaskStoredPhones(SEED_ORGANIZERS, 'id', ['phone']), backfillMissingSeed(SEED_ORGANIZERS, 'id'))
  );
  const [venues, setVenues] = usePersisted(
    'pba_venues', SEED_VENUES,
    compose(mergeWithSeed(SEED_VENUES, 'id'), unmaskStoredPhones(SEED_VENUES, 'id', ['contact']), backfillMissingSeed(SEED_VENUES, 'id'))
  );
  const [kycApplications, setKycApplications] = usePersisted<KycApplication[]>('pba_kyc', SEED_KYC_APPLICATIONS, mergeWithSeed<KycApplication>(SEED_KYC_APPLICATIONS, 'id'));
  const [promos, setPromos] = usePersisted('pba_promos', SEED_PROMOS, mergeWithSeed(SEED_PROMOS, 'code'));
  const [banners, setBanners] = usePersisted('pba_banners', SEED_BANNERS, (list) =>
    mergeWithSeed(SEED_BANNERS, 'title')(list).map((b, i) => ({ ...b, id: b.id ?? 'b' + (i + 1) }))
  );
  const [categories, setCategories] = usePersisted(
    'pba_categories', SEED_CATEGORIES,
    compose(mergeWithSeed(SEED_CATEGORIES, 'name'), backfillMissingSeed(SEED_CATEGORIES, 'name'))
  );
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
  const [guestList, setGuestList] = usePersisted<GuestEntry[]>('pba_guestlist', SEED_GUEST_LIST, (list) =>
    list.map((g) => {
      const base = SEED_GUEST_LIST.find((x) => x.id === g.id);
      if (!base) return g;
      const phone = typeof g.phone === 'string' && g.phone.includes('••') ? base.phone : g.phone;
      const companions = g.companions?.map((c, i) => {
        const baseC = base.companions?.[i];
        return baseC && typeof c.phone === 'string' && c.phone.includes('••') ? { ...c, phone: baseC.phone } : c;
      });
      return { ...g, phone, companions };
    })
  );
  const [roles, setRoles] = usePersisted('pba_roles', SEED_ROLES, (stored) => {
    // PERM_MODULES expanded from 7 broad buckets to 22 per-section modules
    // in an earlier slice — a role matrix stored before that change is
    // missing every one of the 15 new module keys entirely (not just
    // holding a stale value for them), and PermissionGuard's optional-
    // chained lookup treats a missing module as fail-closed, so every new
    // module would silently deny access for every role. Seed provides the
    // full current module set as the base; any stored per-module value
    // (including hand-edited custom permissions) overlays on top, so real
    // admin edits to the matrix survive, only the missing modules backfill.
    const merged: typeof SEED_ROLES = {};
    for (const roleName of Object.keys(SEED_ROLES)) {
      merged[roleName] = { ...SEED_ROLES[roleName], ...(stored[roleName] ?? {}) };
    }
    // preserve any custom role the admin created beyond the seeded set
    for (const roleName of Object.keys(stored)) {
      if (!merged[roleName]) merged[roleName] = stored[roleName];
    }
    return merged;
  });
  // Real /admin/notifications feed (KYC submissions, event approvals, refund
  // requests, payout batches, venue city changes — see NotificationsService
  // on the API side) — replaces the old localStorage-seeded mock array.
  // Polled every 60s so a new approval/refund shows up without a full reload.
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const refreshNotifications = useCallback(() => {
    if (!liveApiEnabled()) return;
    liveNotifications
      .list()
      .then((rows) => setNotifications(rows.map((n) => ({ id: n.id, icon: n.icon, text: n.text, time: timeAgo(n.createdAt), read: n.read, to: n.to ?? undefined }))))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshNotifications();
    const id = setInterval(refreshNotifications, 60000);
    return () => clearInterval(id);
  }, [refreshNotifications]);
  const [settings, setSettings] = usePersisted('pba_settings', SEED_SETTINGS, (v) => ({
    ...SEED_SETTINGS,
    ...v,
    socials: { ...SEED_SETTINGS.socials, ...(v as Partial<typeof SEED_SETTINGS>).socials },
    siteSeo: { ...SEED_SETTINGS.siteSeo, ...(v as Partial<typeof SEED_SETTINGS>).siteSeo },
    contact: { ...SEED_SETTINGS.contact, ...(v as Partial<typeof SEED_SETTINGS>).contact },
  }));
  const [lineups, setLineups] = usePersisted<Lineup[]>('pba_lineups', SEED_LINEUPS, backfillMissingSeed(SEED_LINEUPS, 'id'));
  const [reviews, setReviews] = usePersisted<AdminReview[]>('pba_reviews', SEED_REVIEWS, (list) =>
    // schema migration: reviews stored before targetType/targetName existed
    // were organizer-only, shaped { organizer: string, ... } — anything
    // still in that old shape is missing targetType entirely, which would
    // break TYPE_LABEL[r.targetType] lookups on the Reviews page. Convert
    // in place (organizer reviews only, since that was the only kind that
    // could exist under the old schema) rather than discarding real
    // admin-authored review content.
    list.map((r) => {
      if ('targetType' in r && r.targetType) return r;
      const old = r as unknown as { organizer?: string };
      return { ...r, targetType: 'organizer' as const, targetName: old.organizer ?? 'Unknown' };
    })
  );
  const [testimonials, setTestimonials] = usePersisted<Testimonial[]>('pba_testimonials', SEED_TESTIMONIALS);
  const [emailTemplateOverrides, setEmailTemplateOverrides] = usePersisted<EmailTemplateOverride[]>('pba_email_template_overrides', []);
  const [customEmailTemplates, setCustomEmailTemplates] = usePersisted<EmailTemplateDef[]>('pba_custom_email_templates', []);
  const [invoices, setInvoices] = usePersisted<InvoiceRecord[]>('pba_invoices', SEED_INVOICES);
  const [faqs, setFaqs] = usePersisted<FaqItem[]>('pba_faqs', SEED_FAQS);
  const [policies, setPolicies] = usePersisted<Policy[]>('pba_policies', SEED_POLICIES);
  const [menus, setMenusState] = usePersisted<MenuConfig>('pba_menus', SEED_MENUS);
  const [promoters, setPromoters] = usePersisted<Promoter[]>('pba_promoters', SEED_PROMOTERS, compose(mergeWithSeed<Promoter>(SEED_PROMOTERS, 'id'), backfillMissingSeed<Promoter>(SEED_PROMOTERS, 'id')));
  const [subTiers, setSubTiers] = usePersisted('pba_subtiers', SEED_SUB_TIERS);
  const [abandonedCarts, setAbandonedCarts] = usePersisted<AbandonedCart[]>(
    'pba_abandoned', SEED_ABANDONED_CARTS,
    compose(mergeWithSeed(SEED_ABANDONED_CARTS, 'id'), unmaskStoredPhones(SEED_ABANDONED_CARTS, 'id', ['phone']))
  );
  const [locations, setLocations] = usePersisted<LocCountry[]>('pba_locations', SEED_LOCATIONS);
  const [featuredRequests, setFeaturedRequests] = usePersisted<FeaturedRequest[]>('pba_featured', SEED_FEATURED_REQUESTS, mergeWithSeed<FeaturedRequest>(SEED_FEATURED_REQUESTS, 'id'));
  const [featuredRates, setFeaturedRates] = usePersisted<FeaturedRates>('pba_featured_rates', SEED_FEATURED_RATES, (v) => ({ ...SEED_FEATURED_RATES, ...v }));
  const [adminReferrals] = usePersisted<AdminReferral[]>(
    'pba_referrals', SEED_REFERRALS,
    compose(mergeWithSeed(SEED_REFERRALS, 'id'), unmaskStoredPhones(SEED_REFERRALS, 'id', ['referrerPhone', 'refereePhone']))
  );
  const [referralRates, setReferralRates] = usePersisted<ReferralRates>('pba_referral_rates', SEED_REFERRAL_RATES);
  const [jobs, setJobs] = usePersisted<AdminJob[]>('pba_jobs', SEED_JOBS, mergeWithSeed<AdminJob>(SEED_JOBS, 'id'));
  const [applicants] = usePersisted<JobApplicant[]>(
    'pba_applicants', SEED_APPLICANTS,
    compose(mergeWithSeed(SEED_APPLICANTS, 'id'), unmaskStoredPhones(SEED_APPLICANTS, 'id', ['phone']))
  );
  const [reels, setReels] = usePersisted<Reel[]>('pba_reels', SEED_REELS, mergeWithSeed(SEED_REELS, 'id'));
  const [teams, setTeams] = usePersisted<string[]>('pba_teams', ['Engineering', 'Design', 'Growth', 'Operations', 'Support']);
  const [lineupCategories, setLineupCategories] = usePersisted<string[]>('pba_lineupcats', LINEUP_CATEGORIES);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2200);
  }, []);

  // Reconcile customers against bookings once on mount: every real booking
  // guest should have a customer record (this is the one place admin looks
  // for guests), but the two are separately-seeded/persisted arrays with no
  // live link, so a booking added directly to the seed (or created before
  // this reconciliation existed) can leave its guest with no customer at
  // all. addBooking finds-or-creates going forward; this catches anything
  // that predates that fix, matched by name (case-insensitive), the same
  // key CustomerDetail already uses.
  useEffect(() => {
    setCustomers((prev) => {
      const existingNames = new Set(prev.map((c) => c.name.toLowerCase()));
      const missing: Customer[] = [];
      for (const b of bookings) {
        const key = b.guest.toLowerCase();
        if (existingNames.has(key)) continue;
        existingNames.add(key);
        const event = events.find((e) => e.id === b.eventId);
        missing.push({
          id: 'c-booking-' + key.replace(/[^a-z0-9]+/g, '-'), name: b.guest, verified: true, gender: '—',
          city: event?.city ?? '—', bookings: 1, spend: b.amount, status: 'active', segment: 'guests', phone: b.phone,
        });
      }
      return missing.length ? [...prev, ...missing] : prev;
    });
    // run once on mount only — addBooking keeps this in sync for anything created afterward
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AdminState>(
    () => ({
      session,
      events,
      bookings,
      customers,
      organizers,
      venues,
      kycApplications,
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
      approveKycApplication: (id) => {
        const app = kycApplications.find((k) => k.id === id);
        if (!app || app.status !== 'pending') return;
        const newId = `${app.kind}-${Date.now()}`;
        if (app.kind === 'organizer') {
          setOrganizers((prev) => [
            ...prev,
            {
              id: newId, name: app.payload.brand ?? app.applicantName, contact: app.applicantPhone, city: app.city,
              events: 0, kyc: 'verified', status: 'approved', contactPerson: app.applicantName,
              phone: app.applicantPhone, gstin: app.payload.gstin, pan: app.payload.pan, bankLast4: app.payload.bankLast4,
            },
          ]);
        } else if (app.kind === 'promoter') {
          setPromoters((prev) => [
            {
              id: newId, name: app.payload.brand ?? app.applicantName, contact: app.applicantPhone, city: app.city,
              status: 'approved', kyc: 'verified', plan: 'free', guestsThisMonth: 0, eventsPromoted: 0, showRate: 0,
              bio: app.payload.audience ?? '',
            },
            ...prev,
          ]);
        } else if (app.kind === 'lineup') {
          setLineups((prev) => [
            { id: newId, name: app.payload.name ?? app.applicantName, category: app.payload.category ?? 'Artist', description: '', city: app.city, links: app.payload.links, hasImage: false, followers: 0, verified: true },
            ...prev,
          ]);
        } else if (app.kind === 'venue') {
          setVenues((prev) => [
            ...prev,
            {
              id: newId, name: app.payload.name ?? app.applicantName, city: app.city,
              capacity: Number(app.payload.capacity) || app.payload.capacity || '—', events: 0,
              license: 'valid', verified: true, address: app.payload.address, type: app.payload.type,
            },
          ]);
        }
        setKycApplications((prev) => prev.map((k) => (k.id === id ? { ...k, status: 'approved', reviewedBy: 'admin@prebooze.com' } : k)));
        toast(`${app.applicantName} approved as ${app.kind} ✓`);
      },
      rejectKycApplication: (id, reason) => {
        setKycApplications((prev) =>
          prev.map((k) => (k.id === id ? { ...k, status: 'rejected', reviewedBy: 'admin@prebooze.com', reviewNote: reason } : k)),
        );
        toast('Application rejected');
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
        toast(`Payout batch of ${eventIds.length} processed ✓`);
      },
      notifications,
      markNotificationRead: (id) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        liveNotifications.markRead(id).catch(() => {});
      },
      markAllNotificationsRead: () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        liveNotifications.markAllRead().catch(() => {});
        toast('All notifications marked read ✓');
      },
      addCustomer: (c) => {
        setCustomers((prev) => [c, ...prev]);
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
        // find-or-create the matching customer by name (the same key
        // CustomerDetail already uses to match a customer to their booking
        // history) so every real booking guest shows up in Customers —
        // without this, a booking could exist for someone with no customer
        // record at all, invisible in the one place admin looks for guests.
        setCustomers((prev) => {
          const idx = prev.findIndex((c) => c.name.toLowerCase() === b.guest.toLowerCase());
          if (idx === -1) {
            const event = events.find((e) => e.id === b.eventId);
            return [
              ...prev,
              {
                id: 'c' + Date.now(), name: b.guest, verified: true, gender: '—',
                city: event?.city ?? '—', bookings: 1, spend: b.amount, status: 'active',
                segment: 'guests', phone: b.phone,
              },
            ];
          }
          return prev.map((c, i) => (i === idx ? { ...c, bookings: c.bookings + 1, spend: c.spend + b.amount, phone: c.phone ?? b.phone } : c));
        });
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
      addReview: (r) => {
        setReviews((prev) => [{ ...r, id: 'rv' + Date.now() }, ...prev]);
        toast('Review added ✓');
      },
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
      emailTemplateDefs: EMAIL_TEMPLATE_DEFS,
      customEmailTemplates,
      emailTemplateOverrides,
      // Mirrors prebooze-api's EmailTemplatesAdminService.create: id is a
      // generated "custom_<slug>" key, collision-checked against both the
      // fixed set and any other custom template already created. A brand
      // new custom template has no code-side default at all — its
      // subject/bodyHtml live directly on the def, not as an "override" of
      // anything (there's nothing to override yet).
      addEmailTemplate: (input) => {
        if (!input.name.trim() || !input.subject.trim() || !input.bodyHtml.trim()) {
          toast('Name, subject and body are all required');
          return;
        }
        const base = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '') || 'template';
        let id = `custom_${base}`;
        let n = 1;
        const taken = (candidate: string) =>
          EMAIL_TEMPLATE_DEFS.some((d) => d.id === candidate) || customEmailTemplates.some((d) => d.id === candidate);
        while (taken(id)) id = `custom_${base}_${++n}`;
        setCustomEmailTemplates((prev) => [
          ...prev,
          {
            id, name: input.name.trim(), category: 'Custom' as const,
            trigger: 'Manual — sent from admin, not tied to an automatic trigger',
            defaultSubject: input.subject, defaultBody: input.bodyHtml, tokens: [],
          },
        ]);
        toast('Email template created ✓');
      },
      updateEmailTemplate: (id, patch) => {
        setEmailTemplateOverrides((prev) => {
          const updatedAt = new Date().toISOString();
          const existing = prev.find((o) => o.id === id);
          if (existing) return prev.map((o) => (o.id === id ? { ...o, ...patch, updatedAt } : o));
          return [...prev, { id, ...patch, updatedAt }];
        });
        toast('Email template saved ✓');
      },
      resetEmailTemplate: (id) => {
        setEmailTemplateOverrides((prev) => prev.filter((o) => o.id !== id));
        toast('Reset to default ✓');
      },
      removeCustomEmailTemplate: (id) => {
        setCustomEmailTemplates((prev) => prev.filter((t) => t.id !== id));
        setEmailTemplateOverrides((prev) => prev.filter((o) => o.id !== id));
        toast('Email template removed');
      },
      invoices,
      // Real sending (email + WhatsApp) happens in prebooze-api's InvoicesService
      // once this page is wired to the live backend — admin is still 100% mock
      // (same boundary as the rest of this app), so this simulates the
      // outcome (marks lastSentAt) rather than actually delivering anything.
      resendInvoiceEmail: (id) => {
        const inv = invoices.find((i) => i.id === id);
        if (!inv?.payerEmail) { toast('This invoice has no email on file'); return; }
        setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, lastSentAt: new Date().toISOString() } : i)));
        toast(`Invoice ${inv.number} emailed to ${inv.payerEmail} ✓`);
      },
      resendInvoiceWhatsapp: (id) => {
        const inv = invoices.find((i) => i.id === id);
        if (!inv?.payerPhone) { toast('This invoice has no phone on file'); return; }
        setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, lastSentAt: new Date().toISOString() } : i)));
        toast(`Invoice ${inv.number} sent via WhatsApp to ${inv.payerPhone} ✓`);
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
            // toggling a country cascades to all its states + cities
            if (!path.state) {
              const en = !c.enabled;
              return { ...c, enabled: en, states: c.states.map((s) => ({ ...s, enabled: en, cities: s.cities.map((ci) => ({ ...ci, enabled: en })) })) };
            }
            return {
              ...c,
              states: c.states.map((s) => {
                if (s.name !== path.state) return s;
                // toggling a state cascades to all its cities
                if (!path.city) {
                  const en = !s.enabled;
                  return { ...s, enabled: en, cities: s.cities.map((ci) => ({ ...ci, enabled: en })) };
                }
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
      featuredRequests,
      featuredRates,
      approveFeatured: (id) => {
        setFeaturedRequests((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'active' as const } : f)));
        toast('Featured placement approved — now live ✓');
      },
      rejectFeatured: (id) => {
        setFeaturedRequests((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'rejected' as const } : f)));
        toast('Featured request rejected');
      },
      // Real endpoint: POST /admin/featured/:id/remind (sends a real email to
      // the placement owner). Admin has no live session to reach it yet — same
      // simulated-outcome pattern as invoices' resend-email/resend-whatsapp.
      remindFeatured: (id) => {
        setFeaturedRequests((prev) => prev.map((f) => (f.id === id ? { ...f, remindedAt: 'just now' } : f)));
        toast('Renewal reminder sent ✓');
      },
      updateFeaturedRate: (patch) => {
        setFeaturedRates((prev) => ({ ...prev, ...patch }));
        toast('Featured rate saved ✓');
      },
      adminReferrals,
      referralRates,
      updateReferralRate: (patch) => {
        setReferralRates((prev) => ({ ...prev, ...patch }));
        toast('Referral reward saved ✓');
      },
      jobs,
      addJob: (j) => {
        setJobs((prev) => [...prev, { ...j, id: 'job' + Date.now(), status: 'open' as const }]);
        toast('Job posted ✓ — live on the careers page');
      },
      updateJob: (id, patch) => {
        setJobs((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
        toast('Job updated ✓');
      },
      teams,
      addTeam: (name) => {
        const n = name.trim();
        if (!n) return;
        setTeams((prev) => (prev.includes(n) ? prev : [...prev, n]));
        toast(`Team "${n}" created ✓`);
      },
      toggleJob: (id) =>
        setJobs((prev) => prev.map((x) => (x.id === id ? { ...x, status: x.status === 'open' ? ('closed' as const) : ('open' as const) } : x))),
      removeJob: (id) => {
        setJobs((prev) => prev.filter((x) => x.id !== id));
        toast('Job removed');
      },
      applicants,
      reels,
      addReel: (title, videoDataUrl) => {
        setReels((prev) => [...prev, { id: 'rl' + Date.now(), title: title.trim() || 'Untitled reel', hue: Math.floor(Math.random() * 360), active: true, videoDataUrl }]);
        toast('Video uploaded ✓ — live in the guest reels slider');
      },
      toggleReel: (id) => setReels((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))),
      removeReel: (id) => {
        setReels((prev) => prev.filter((r) => r.id !== id));
        toast('Reel removed');
      },
      uploadCityIcon: (path) => {
        setLocations((prev) =>
          prev.map((cn) =>
            cn.name !== path.country
              ? cn
              : { ...cn, states: cn.states.map((st) => (st.name !== path.state ? st : { ...st, cities: st.cities.map((ci) => (ci.name === path.city ? { ...ci, iconUploaded: !ci.iconUploaded } : ci)) })) }
          )
        );
        toast('City icon image uploaded ✓');
      },
      setCityIcon: (path, icon) => {
        setLocations((prev) =>
          prev.map((c) =>
            c.name !== path.country
              ? c
              : { ...c, states: c.states.map((st) => (st.name !== path.state ? st : { ...st, cities: st.cities.map((ci) => (ci.name === path.city ? { ...ci, icon: icon.slice(0, 4) } : ci)) })) }
          )
        );
      },
      toggleTopCity: (path) => {
        const count = locations.flatMap((c) => c.states.flatMap((st) => st.cities)).filter((ci) => ci.top).length;
        const cur = locations.find((c) => c.name === path.country)?.states.find((st) => st.name === path.state)?.cities.find((ci) => ci.name === path.city);
        if (!cur?.top && count >= 12) {
          toast('Top-cities limit reached (12) — unstar one first');
          return;
        }
        setLocations((prev) =>
          prev.map((c) =>
            c.name !== path.country
              ? c
              : { ...c, states: c.states.map((st) => (st.name !== path.state ? st : { ...st, cities: st.cities.map((ci) => (ci.name === path.city ? { ...ci, top: !ci.top } : ci)) })) }
          )
        );
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
    [session, events, bookings, customers, organizers, venues, kycApplications, promos, banners, categories, blogs, pages, staff, roles, settings, notifications, blogCategories, ledger, ledgerCategories, guestList, lineups, lineupCategories, reviews, testimonials, emailTemplateOverrides, customEmailTemplates, invoices, faqs, policies, menus, promoters, subTiers, abandonedCarts, locations, featuredRequests, featuredRates, adminReferrals, referralRates, jobs, applicants, reels, teams, toastMsg, toast, setSession, setEvents, setBookings, setCustomers, setOrganizers, setVenues, setKycApplications, setPromos, setBanners, setCategories, setBlogs, setPages, setStaff, setRoles, setSettings, setNotifications, setBlogCategories, setLedger, setLedgerCategories, setGuestList, setLineups, setLineupCategories, setReviews, setTestimonials, setEmailTemplateOverrides, setCustomEmailTemplates, setInvoices, setFaqs, setPolicies, setMenusState, setPromoters, setSubTiers, setAbandonedCarts, setLocations, setFeaturedRequests, setFeaturedRates, setReferralRates, setJobs, setReels, setTeams]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAdmin = () => useContext(Ctx);
