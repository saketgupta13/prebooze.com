import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useApp } from './store/AppContext';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Browse from './pages/Browse';
import Categories from './pages/Categories';
import EventDetail from './pages/EventDetail';
import Checkout from './pages/Checkout';
import Confirmation from './pages/Confirmation';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import Venues from './pages/Venues';
import VenueDetail from './pages/VenueDetail';
import OrganizerProfile from './pages/OrganizerProfile';
import Organizers from './pages/Organizers';
import Promoters from './pages/Promoters';
import People from './pages/People';
import PersonProfile from './pages/PersonProfile';
import Testimonials from './pages/Testimonials';
import ReferralLanding from './pages/ReferralLanding';
import Wallet from './pages/Wallet';
import ReferEarn from './pages/ReferEarn';
import Wishlist from './pages/Wishlist';
import HelpCenter from './pages/HelpCenter';
import Careers from './pages/Careers';
import PaymentMethods from './pages/PaymentMethods';
import Login from './pages/auth/Login';
import Otp from './pages/auth/Otp';
import ProfileCompletion from './pages/auth/ProfileCompletion';
import IdVerification from './pages/auth/IdVerification';
import Onboarding from './pages/organizer/Onboarding';
import OrganizerLayout from './pages/organizer/OrganizerLayout';
import Dashboard from './pages/organizer/Dashboard';
import MyEvents from './pages/organizer/MyEvents';
import CreateEvent from './pages/organizer/CreateEvent';
import Attendees from './pages/organizer/Attendees';
import Scanner from './pages/organizer/Scanner';
import Coupons from './pages/organizer/Coupons';
import Payouts from './pages/organizer/Payouts';
import Settings from './pages/organizer/Settings';
import Withdraw from './pages/organizer/Withdraw';
import OrgGuestList from './pages/organizer/OrgGuestList';
import OrgAbandonedCarts from './pages/organizer/OrgAbandonedCarts';
import OrgLiveMonitor from './pages/organizer/OrgLiveMonitor';
import OrgReviews from './pages/organizer/OrgReviews';
import OrgTeamRoles from './pages/organizer/OrgTeamRoles';
import HostLanding from './pages/static/HostLanding';
import About from './pages/static/About';
import Contact from './pages/static/Contact';
import Legal from './pages/static/Legal';
import Faqs from './pages/static/Faqs';
import Blog from './pages/static/Blog';
import BlogPost from './pages/static/BlogPost';
import LineupProfile from './pages/LineupProfile';
import Lineups from './pages/Lineups';
import LineupOnboarding from './pages/LineupOnboarding';
import LineupLayout from './pages/lineup/LineupLayout';
import LineupDashboard from './pages/lineup/LineupDashboard';
import LineupSettings from './pages/lineup/LineupSettings';
import PromoterProfile from './pages/PromoterProfile';
import PromoterOnboarding from './pages/promoter/PromoterOnboarding';
import PromoterLayout from './pages/promoter/PromoterLayout';
import PromoterDashboard from './pages/promoter/PromoterDashboard';
import PromoterPromotions from './pages/promoter/PromoterPromotions';
import PromoterSubscription from './pages/promoter/PromoterSubscription';
import PromoterEarnings from './pages/promoter/PromoterEarnings';
import PromoterTeam from './pages/promoter/PromoterTeam';
import PromoterLeaderboard from './pages/promoter/PromoterLeaderboard';
import PromoterSettings from './pages/promoter/PromoterSettings';
import PromoterGuestList from './pages/promoter/PromoterGuestList';
import GuestLanding from './pages/promoter/GuestLanding';
import GuestPass from './pages/promoter/GuestPass';

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

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Header />
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
          <Route path="guestlist" element={<OrgGuestList />} />
          <Route path="live" element={<OrgLiveMonitor />} />
          <Route path="reviews" element={<OrgReviews />} />
          <Route path="team" element={<OrgTeamRoles />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Line-up (artist) console */}
        <Route path="/artist" element={<LineupLayout />}>
          <Route index element={<LineupDashboard />} />
          <Route path="profile" element={<LineupSettings />} />
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

        {/* Company / static */}
        <Route path="/host" element={<HostLanding />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faqs" element={<Faqs />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/legal/:page" element={<Legal />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}
