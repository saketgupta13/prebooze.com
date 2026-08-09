import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useApp } from './store/AppContext';
import { usePlatformInfo } from './lib/usePlatformInfo';
import Header from './components/Header';
import Footer from './components/Footer';
import Toast from './components/Toast';
import CookieConsent from './components/CookieConsent';
import ComingSoonGate from './components/ComingSoonGate';
import SalesPausedBanner from './components/SalesPausedBanner';
import { PageLoader } from './components/Loader';
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
const ProfileCompletion = lazy(() => import('./pages/auth/ProfileCompletion'));
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
const PromoterGuestList = lazy(() => import('./pages/promoter/PromoterGuestList'));
const GuestLanding = lazy(() => import('./pages/promoter/GuestLanding'));
const GuestPass = lazy(() => import('./pages/promoter/GuestPass'));
const VenueOnboarding = lazy(() => import('./pages/venue/VenueOnboarding'));
const VenueLayout = lazy(() => import('./pages/venue/VenueLayout'));
const VenueDashboard = lazy(() => import('./pages/venue/VenueDashboard'));
const VenueListing = lazy(() => import('./pages/venue/VenueListing'));
const VenueEvents = lazy(() => import('./pages/venue/VenueEvents'));
const VenueSettings = lazy(() => import('./pages/venue/VenueSettings'));
const VenueBilling = lazy(() => import('./pages/venue/VenueBilling'));
const VenueHosting = lazy(() => import('./pages/venue/VenueHosting'));
const VenueHostedEvents = lazy(() => import('./pages/venue/VenueHostedEvents'));
const CreateHostedEvent = lazy(() => import('./pages/venue/CreateHostedEvent'));
const VenueLedger = lazy(() => import('./pages/venue/VenueLedger'));
const VenueWithdraw = lazy(() => import('./pages/venue/VenueWithdraw'));
const NotFound = lazy(() => import('./pages/static/NotFound'));

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

const SITE_ORIGIN = 'https://prebooze.com';

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
      <Header />
      <SalesPausedBanner />
      <MaintenanceGate>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Guest — discovery */}
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/events/:slug" element={<EventDetail />} />
        <Route path="/venues" element={<Venues />} />
        <Route path="/venues/:id" element={<VenueDetail />} />
        <Route path="/organizers" element={<Organizers />} />
        <Route path="/organizers/:id" element={<OrganizerProfile />} />
        <Route path="/promoters" element={<Promoters />} />
        <Route path="/people" element={<People />} />
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
        <Route path="/lineups" element={<Lineups />} />
        <Route path="/lineup/onboarding" element={<LineupOnboarding />} />
        <Route path="/lineup/:slug" element={<LineupProfile />} />
        <Route path="/promoter/onboarding" element={<PromoterOnboarding />} />
        <Route path="/promoter/:slug" element={<PromoterProfile />} />
        <Route path="/p/:eventSlug/:promoterSlug" element={<GuestLanding />} />
        <Route path="/pass/:id" element={<GuestPass />} />

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
        </Route>

        {/* Line-up (artist) console */}
        <Route path="/artist" element={<LineupLayout />}>
          <Route index element={<LineupDashboard />} />
          <Route path="profile" element={<LineupSettings />} />
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
        </Route>

        {/* Venue-partner console */}
        <Route path="/venue/onboarding" element={<VenueOnboarding />} />
        <Route path="/venue" element={<VenueLayout />}>
          <Route index element={<VenueDashboard />} />
          <Route path="listing" element={<VenueListing />} />
          <Route path="events" element={<VenueEvents />} />
          <Route path="billing" element={<VenueBilling />} />
          <Route path="settings" element={<VenueSettings />} />
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
      </MaintenanceGate>
      <Footer />
      <Toast />
      <CookieConsent />
    </ComingSoonGate>
  );
}
