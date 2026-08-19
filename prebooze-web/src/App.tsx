import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { useApp } from './store/AppContext';
import { usePlatformInfo } from './lib/usePlatformInfo';
import { useJsonLd } from './lib/useJsonLd';
import { buildOrganizationSchema } from './lib/schema';
import { useCityList } from './lib/useCityList';
import { toCitySlug, cityHome, SITE_ORIGIN } from './lib/urls';
import Header from './components/Header';
import Footer from './components/Footer';
import Toast from './components/Toast';
import CookieConsent from './components/CookieConsent';
import ComingSoonGate from './components/ComingSoonGate';
import ProfileCompletion from './pages/auth/ProfileCompletion';
import SalesPausedBanner from './components/SalesPausedBanner';
import { PageLoader } from './components/Loader';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';
// Home stays a static import — it's the entry route almost every visitor
// hits first, so lazy-loading it would trade the single main-bundle
// download for a request waterfall (route chunk fetched only after the
// router itself evaluates) on the exact page the Lighthouse LCP finding
// was about. Every other route below is code-split: a 967KB single bundle
// (Lighthouse: 621KB unused JS) shipped every page's code on every visit,
// most of it never touched (nobody hits an organizer's payout console on
// their first pageview).
import Home from './pages/Home';

const Browse = lazy(() => import('./pages/Browse'));
const Categories = lazy(() => import('./pages/Categories'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Confirmation = lazy(() => import('./pages/Confirmation'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const Profile = lazy(() => import('./pages/Profile'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const FinishProfile = lazy(() => import('./pages/FinishProfile'));
const Venues = lazy(() => import('./pages/Venues'));
const VenueDetail = lazy(() => import('./pages/VenueDetail'));
const OrganizerProfile = lazy(() => import('./pages/OrganizerProfile'));
const Organizers = lazy(() => import('./pages/Organizers'));
const Promoters = lazy(() => import('./pages/Promoters'));
const People = lazy(() => import('./pages/People'));
const PersonProfile = lazy(() => import('./pages/PersonProfile'));
const Testimonials = lazy(() => import('./pages/Testimonials'));
const ReferralLanding = lazy(() => import('./pages/ReferralLanding'));
const Wallet = lazy(() => import('./pages/Wallet'));
const ReferEarn = lazy(() => import('./pages/ReferEarn'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const Careers = lazy(() => import('./pages/Careers'));
const JobDetail = lazy(() => import('./pages/JobDetail'));
const PaymentMethods = lazy(() => import('./pages/PaymentMethods'));
const Login = lazy(() => import('./pages/auth/Login'));
const Otp = lazy(() => import('./pages/auth/Otp'));
const IdVerification = lazy(() => import('./pages/auth/IdVerification'));
const Onboarding = lazy(() => import('./pages/organizer/Onboarding'));
const OrganizerLayout = lazy(() => import('./pages/organizer/OrganizerLayout'));
const Dashboard = lazy(() => import('./pages/organizer/Dashboard'));
const MyEvents = lazy(() => import('./pages/organizer/MyEvents'));
const CreateEvent = lazy(() => import('./pages/organizer/CreateEvent'));
const Attendees = lazy(() => import('./pages/organizer/Attendees'));
const Scanner = lazy(() => import('./pages/organizer/Scanner'));
const Coupons = lazy(() => import('./pages/organizer/Coupons'));
const Payouts = lazy(() => import('./pages/organizer/Payouts'));
const OrganizerPromoters = lazy(() => import('./pages/organizer/OrganizerPromoters'));
const Settings = lazy(() => import('./pages/organizer/Settings'));
const OrganizerVerification = lazy(() => import('./pages/organizer/OrganizerVerification'));
const PaymentProfiles = lazy(() => import('./pages/organizer/PaymentProfiles'));
const Withdraw = lazy(() => import('./pages/organizer/Withdraw'));
const OrgGuestList = lazy(() => import('./pages/organizer/OrgGuestList'));
const OrgAbandonedCarts = lazy(() => import('./pages/organizer/OrgAbandonedCarts'));
const OrgLiveMonitor = lazy(() => import('./pages/organizer/OrgLiveMonitor'));
const OrgReviews = lazy(() => import('./pages/organizer/OrgReviews'));
const OrgTeamRoles = lazy(() => import('./pages/organizer/OrgTeamRoles'));
const OrganizerBilling = lazy(() => import('./pages/organizer/OrganizerBilling'));
const HostLanding = lazy(() => import('./pages/static/HostLanding'));
const About = lazy(() => import('./pages/static/About'));
const Contact = lazy(() => import('./pages/static/Contact'));
const Legal = lazy(() => import('./pages/static/Legal'));
const Faqs = lazy(() => import('./pages/static/Faqs'));
const Blog = lazy(() => import('./pages/static/Blog'));
const BlogPost = lazy(() => import('./pages/static/BlogPost'));
const LineupProfile = lazy(() => import('./pages/LineupProfile'));
const Lineups = lazy(() => import('./pages/Lineups'));
const LineupOnboarding = lazy(() => import('./pages/LineupOnboarding'));
const LineupLayout = lazy(() => import('./pages/lineup/LineupLayout'));
const LineupDashboard = lazy(() => import('./pages/lineup/LineupDashboard'));
const LineupSettings = lazy(() => import('./pages/lineup/LineupSettings'));
const LineupVerification = lazy(() => import('./pages/lineup/LineupVerification'));
const LineupBilling = lazy(() => import('./pages/lineup/LineupBilling'));
const PromoterProfile = lazy(() => import('./pages/PromoterProfile'));
const PromoterOnboarding = lazy(() => import('./pages/promoter/PromoterOnboarding'));
const PromoterLayout = lazy(() => import('./pages/promoter/PromoterLayout'));
const PromoterDashboard = lazy(() => import('./pages/promoter/PromoterDashboard'));
const PromoterPromotions = lazy(() => import('./pages/promoter/PromoterPromotions'));
const PromoterSubscription = lazy(() => import('./pages/promoter/PromoterSubscription'));
const PromoterEarnings = lazy(() => import('./pages/promoter/PromoterEarnings'));
const PromoterTeam = lazy(() => import('./pages/promoter/PromoterTeam'));
const PromoterLeaderboard = lazy(() => import('./pages/promoter/PromoterLeaderboard'));
const PromoterSettings = lazy(() => import('./pages/promoter/PromoterSettings'));
const PromoterVerification = lazy(() => import('./pages/promoter/PromoterVerification'));
const PromoterGuestList = lazy(() => import('./pages/promoter/PromoterGuestList'));
const GuestLanding = lazy(() => import('./pages/promoter/GuestLanding'));
const GuestPass = lazy(() => import('./pages/promoter/GuestPass'));
const VipPass = lazy(() => import('./pages/organizer/VipPass'));
const VenueOnboarding = lazy(() => import('./pages/venue/VenueOnboarding'));
const VenueLayout = lazy(() => import('./pages/venue/VenueLayout'));
const VenueDashboard = lazy(() => import('./pages/venue/VenueDashboard'));
const VenueListing = lazy(() => import('./pages/venue/VenueListing'));
const VenueEvents = lazy(() => import('./pages/venue/VenueEvents'));
const VenueSettings = lazy(() => import('./pages/venue/VenueSettings'));
const VenueVerification = lazy(() => import('./pages/venue/VenueVerification'));
const VenueBilling = lazy(() => import('./pages/venue/VenueBilling'));
const VenueHosting = lazy(() => import('./pages/venue/VenueHosting'));
const VenueHostedEvents = lazy(() => import('./pages/venue/VenueHostedEvents'));
const CreateHostedEvent = lazy(() => import('./pages/venue/CreateHostedEvent'));
const VenueLedger = lazy(() => import('./pages/venue/VenueLedger'));
const VenueWithdraw = lazy(() => import('./pages/venue/VenueWithdraw'));
const NotFound = lazy(() => import('./pages/static/NotFound'));

/** The 13 city-scoped discovery routes, declared once and rendered twice
 * below — nested under /:city (the real, canonical shape) and again at the
 * bare top level (back-compat for already-indexed/bookmarked unprefixed
 * links, see LegacyCityRedirect and each entity page's useCityReconcile). */
type CityRouteEntry =
  | { kind: 'listing'; path: string; Component: ComponentType }
  | { kind: 'entity'; path: string; Component: ComponentType };

const CITY_ROUTES: CityRouteEntry[] = [
  { kind: 'listing', path: '', Component: Home },
  { kind: 'listing', path: 'browse', Component: Browse },
  { kind: 'listing', path: 'categories', Component: Categories },
  { kind: 'entity', path: 'events/:slug', Component: EventDetail },
  { kind: 'listing', path: 'venues', Component: Venues },
  { kind: 'entity', path: 'venues/:id', Component: VenueDetail },
  { kind: 'listing', path: 'organizers', Component: Organizers },
  { kind: 'entity', path: 'organizers/:id', Component: OrganizerProfile },
  { kind: 'listing', path: 'promoters', Component: Promoters },
  { kind: 'entity', path: 'promoter/:slug', Component: PromoterProfile },
  { kind: 'listing', path: 'lineups', Component: Lineups },
  { kind: 'entity', path: 'lineup/:slug', Component: LineupProfile },
  { kind: 'listing', path: 'people', Component: People },
];

/** Resolves the URL's :city segment against the real, admin-managed city
 * list and keeps AppContext's `city` state in sync with it — the single
 * mechanism that makes every city-scoped page's existing
 * catalog.events({city})/venues(city)/etc calls filter correctly, with zero
 * changes needed to those pages themselves. */
function CityScope() {
  const { city: citySlugParam } = useParams<{ city: string }>();
  const { city: contextCity, setCity } = useApp();
  const { cities } = useCityList();
  const match = cities?.find((c) => toCitySlug(c.name) === citySlugParam);

  useEffect(() => {
    if (match && match.name !== contextCity) setCity(match.name);
  }, [match, contextCity, setCity]);

  if (cities === null) return <PageLoader />;
  // A real, non-empty city list that genuinely doesn't contain this slug
  // means an invalid/typo'd city segment — bounce to a known-good one. An
  // empty list (fetch failed, or offline mode with none seeded) can't
  // distinguish "invalid" from "we just don't know yet," so render through
  // rather than risk redirecting back to a city that will never resolve.
  if (cities.length > 0 && !match) return <Navigate to={cityHome(contextCity)} replace />;

  return <Outlet />;
}

/** Bare/legacy listing URLs (already-indexed or bookmarked before city
 * prefixes existed) redirect to the visitor's last-known/default city —
 * no data fetch needed, `city` is already synchronously available.
 * Entity pages (events/:slug, venues/:id, etc.) deliberately do NOT use
 * this — they render the real page directly and let useCityReconcile
 * redirect based on the entity's OWN city once it loads, not the
 * visitor's browsing city (see each entity page's useCityReconcile call). */
function LegacyCityRedirect({ subpath }: { subpath: string }) {
  const { city } = useApp();
  const location = useLocation();
  const to = `${cityHome(city)}${subpath ? '/' + subpath : ''}${location.search}`;
  return <Navigate to={to} replace />;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useApp();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Keeps <link rel="canonical"> in sync with the real route on every
 * navigation — index.html's copy was a single static tag (the homepage
 * URL) that silently applied to every page, telling search engines every
 * route's canonical page was the homepage. This is a router-level effect
 * (not a per-page useSeo call) specifically so every route gets a correct
 * canonical automatically, including pages that don't call useSeo today
 * and any added later — no per-page wiring to remember. */
function CanonicalUrl() {
  const { pathname } = useLocation();
  useEffect(() => {
    const href = SITE_ORIGIN + (pathname === '/' ? '' : pathname);
    let tag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!tag) {
      tag = document.createElement('link');
      tag.setAttribute('rel', 'canonical');
      document.head.appendChild(tag);
    }
    tag.setAttribute('href', href);
  }, [pathname]);
  return null;
}

/** Site-wide Schema.org Organization markup — present on every route, one
 * effect, built from live platform settings so it can't drift from
 * whatever admin has actually configured in Settings. Ties search results
 * back to a real brand entity for Google's Knowledge Panel data. */
function OrganizationSchema() {
  const info = usePlatformInfo();
  useJsonLd(buildOrganizationSchema(info));
  return null;
}

/** Real gate for Settings → Danger zone → "Maintenance mode" — the
 * platform-wide toggle already blocks booking creation server-side
 * (BookingsService.priceHold), this is the other half the setting's own
 * hint text promises ("guest site shows a 'back soon' page"), which never
 * existed until now. Header/Footer stay up (branding, contact info, socials
 * still useful to show), only the actual page content is replaced. */
function MaintenanceGate({ children }: { children: ReactNode }) {
  const { maintenanceMode } = usePlatformInfo();
  if (!maintenanceMode) return <>{children}</>;
  return (
    <main className="page" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛠️</div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>We'll be right back</h1>
        <p className="muted">Prebooze is down for scheduled maintenance — ticket bookings are paused. Check back shortly.</p>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <ComingSoonGate>
      <ScrollToTop />
      <CanonicalUrl />
      <OrganizationSchema />
      <Header />
      <SalesPausedBanner />
      <MaintenanceGate>
      <ChunkErrorBoundary>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Guest — discovery, city-scoped (canonical /:city/... shape) */}
        <Route path="/:city" element={<CityScope />}>
          {CITY_ROUTES.map((r) =>
            r.path === '' ? (
              <Route key="home" index element={<r.Component />} />
            ) : (
              <Route key={r.path} path={r.path} element={<r.Component />} />
            )
          )}
        </Route>

        {/* Guest — discovery, bare/legacy unprefixed shape (back-compat for
            already-indexed/bookmarked links — see LegacyCityRedirect and
            useCityReconcile) */}
        {CITY_ROUTES.map((r) =>
          r.kind === 'entity' ? (
            <Route key={'legacy-' + r.path} path={'/' + r.path} element={<r.Component />} />
          ) : (
            <Route key={'legacy-' + r.path} path={r.path ? '/' + r.path : '/'} element={<LegacyCityRedirect subpath={r.path} />} />
          )
        )}

        <Route path="/u/:username" element={<PersonProfile />} />
        <Route path="/testimonials" element={<Testimonials />} />
        <Route path="/r/:code" element={<ReferralLanding />} />
        <Route path="/help" element={<HelpCenter />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/careers/:jobId" element={<JobDetail />} />
        <Route
          path="/wishlist"
          element={
            <RequireAuth>
              <Wishlist />
            </RequireAuth>
          }
        />
        <Route
          path="/payment-methods"
          element={
            <RequireAuth>
              <PaymentMethods />
            </RequireAuth>
          }
        />
        <Route
          path="/wallet"
          element={
            <RequireAuth>
              <Wallet />
            </RequireAuth>
          }
        />
        <Route
          path="/refer"
          element={
            <RequireAuth>
              <ReferEarn />
            </RequireAuth>
          }
        />
        <Route path="/lineup/onboarding" element={<LineupOnboarding />} />
        <Route path="/promoter/onboarding" element={<PromoterOnboarding />} />
        <Route path="/p/:eventSlug/:promoterSlug" element={<GuestLanding />} />
        <Route path="/pass/:id" element={<GuestPass />} />
        <Route path="/vip/:id" element={<VipPass />} />

        {/* Guest — auth & identity */}
        <Route path="/login" element={<Login />} />
        <Route path="/verify-otp" element={<Otp />} />
        <Route
          path="/complete-profile"
          element={
            <RequireAuth>
              <ProfileCompletion />
            </RequireAuth>
          }
        />
        <Route
          path="/finish-profile"
          element={
            <RequireAuth>
              <FinishProfile />
            </RequireAuth>
          }
        />
        <Route
          path="/verify-id"
          element={
            <RequireAuth>
              <IdVerification />
            </RequireAuth>
          }
        />

        {/* Guest — booking & account */}
        <Route
          path="/checkout"
          element={
            <RequireAuth>
              <Checkout />
            </RequireAuth>
          }
        />
        <Route
          path="/confirmation/:id"
          element={
            <RequireAuth>
              <Confirmation />
            </RequireAuth>
          }
        />
        <Route
          path="/bookings"
          element={
            <RequireAuth>
              <MyBookings />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <RequireAuth>
              <EditProfile />
            </RequireAuth>
          }
        />

        {/* Organizer — onboarding & console */}
        <Route
          path="/organizer/onboarding"
          element={
            <RequireAuth>
              <Onboarding />
            </RequireAuth>
          }
        />
        <Route path="/organizer" element={<OrganizerLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="events" element={<MyEvents />} />
          <Route path="events/create" element={<CreateEvent />} />
          <Route path="events/:id/edit" element={<CreateEvent />} />
          <Route path="attendees" element={<Attendees />} />
          <Route path="scanner" element={<Scanner />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="carts" element={<OrgAbandonedCarts />} />
          <Route path="payouts" element={<Payouts />} />
          <Route path="payouts/withdraw" element={<Withdraw />} />
          <Route path="promoters" element={<OrganizerPromoters />} />
          <Route path="guestlist" element={<OrgGuestList />} />
          <Route path="live" element={<OrgLiveMonitor />} />
          <Route path="reviews" element={<OrgReviews />} />
          <Route path="team" element={<OrgTeamRoles />} />
          <Route path="billing" element={<OrganizerBilling />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/verification" element={<OrganizerVerification />} />
          <Route path="settings/payment-profiles" element={<PaymentProfiles />} />
        </Route>

        {/* Line-up (artist) console */}
        <Route path="/artist" element={<LineupLayout />}>
          <Route index element={<LineupDashboard />} />
          <Route path="profile" element={<LineupSettings />} />
          <Route path="profile/verification" element={<LineupVerification />} />
          <Route path="billing" element={<LineupBilling />} />
        </Route>

        {/* Promoter console */}
        <Route path="/promoter" element={<PromoterLayout />}>
          <Route index element={<PromoterDashboard />} />
          <Route path="promotions" element={<PromoterPromotions />} />
          <Route path="guests/:eventId" element={<PromoterGuestList />} />
          <Route path="earnings" element={<PromoterEarnings />} />
          <Route path="team" element={<PromoterTeam />} />
          <Route path="leaderboard" element={<PromoterLeaderboard />} />
          <Route path="subscription" element={<PromoterSubscription />} />
          <Route path="settings" element={<PromoterSettings />} />
          <Route path="settings/verification" element={<PromoterVerification />} />
        </Route>

        {/* Venue-partner console */}
        <Route path="/venue/onboarding" element={<VenueOnboarding />} />
        <Route path="/venue" element={<VenueLayout />}>
          <Route index element={<VenueDashboard />} />
          <Route path="listing" element={<VenueListing />} />
          <Route path="events" element={<VenueEvents />} />
          <Route path="billing" element={<VenueBilling />} />
          <Route path="settings" element={<VenueSettings />} />
          <Route path="settings/verification" element={<VenueVerification />} />
          <Route path="hosting" element={<VenueHosting />} />
          <Route path="hosting/events" element={<VenueHostedEvents />} />
          <Route path="hosting/events/create" element={<CreateHostedEvent />} />
          <Route path="hosting/events/:id/edit" element={<CreateHostedEvent />} />
          <Route path="hosting/ledger" element={<VenueLedger />} />
          <Route path="hosting/ledger/withdraw" element={<VenueWithdraw />} />
        </Route>

        {/* Company / static */}
        <Route path="/host" element={<HostLanding />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faqs" element={<Faqs />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/legal/:page" element={<Legal />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </ChunkErrorBoundary>
      </MaintenanceGate>
      <Footer />
      <Toast />
      <CookieConsent />
    </ComingSoonGate>
  );
}
