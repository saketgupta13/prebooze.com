import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useApp } from './store/AppContext';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Browse from './pages/Browse';
import EventDetail from './pages/EventDetail';
import Checkout from './pages/Checkout';
import Confirmation from './pages/Confirmation';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import Venues from './pages/Venues';
import VenueDetail from './pages/VenueDetail';
import OrganizerProfile from './pages/OrganizerProfile';
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
import HostLanding from './pages/static/HostLanding';
import About from './pages/static/About';
import Contact from './pages/static/Contact';
import Legal from './pages/static/Legal';
import Blog from './pages/static/Blog';
import BlogPost from './pages/static/BlogPost';
import LineupProfile from './pages/LineupProfile';
import LineupOnboarding from './pages/LineupOnboarding';

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
        <Route path="/events/:slug" element={<EventDetail />} />
        <Route path="/venues" element={<Venues />} />
        <Route path="/venues/:id" element={<VenueDetail />} />
        <Route path="/organizers/:id" element={<OrganizerProfile />} />
        <Route path="/lineup/onboarding" element={<LineupOnboarding />} />
        <Route path="/lineup/:slug" element={<LineupProfile />} />

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
          <Route path="attendees" element={<Attendees />} />
          <Route path="scanner" element={<Scanner />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="payouts" element={<Payouts />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Company / static */}
        <Route path="/host" element={<HostLanding />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/legal/:page" element={<Legal />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}
