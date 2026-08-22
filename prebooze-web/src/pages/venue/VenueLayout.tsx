import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import PendingReview, { RejectedReview } from '../../components/PendingReview';
import { venuePartner } from '../../api';

const NAV = [
  { to: '/venue', label: '▦ Dashboard', end: true },
  { to: '/venue/listing', label: '🏛 My listing' },
  { to: '/venue/events', label: '📅 Events here' },
  { to: '/venue/reviews', label: '★ Reviews' },
  { to: '/venue/billing', label: '⭐ Featured & billing' },
  { to: '/venue/settings', label: '⚙ Settings' },
];

// Hosting nav is opt-in: "🎪 Host events" always shows (it's the request/
// status page — see VenueHosting.tsx), the two working pages under it only
// once admin has actually approved (hostingEnabled), matching "if enable
// then only show all new option otherwise nothing to show" from the plan.
const HOSTING_ENABLED_NAV = [
  { to: '/venue/hosting/events', label: '🎟 Events I host' },
  { to: '/venue/hosting/scanner', label: '📷 Scanner' },
  { to: '/venue/hosting/attendees', label: '🎫 Attendees' },
  { to: '/venue/hosting/guest-list', label: '📋 Guest list' },
  { to: '/venue/hosting/live', label: '📡 Live monitor' },
  { to: '/venue/hosting/carts', label: '🛒 Abandoned carts' },
  { to: '/venue/hosting/promoters', label: '📣 Promoters' },
  { to: '/venue/hosting/coupons', label: '🏷 Promo codes' },
  { to: '/venue/hosting/ledger', label: '💰 Hosting ledger' },
];

export default function VenueLayout() {
  const { user } = useApp();
  const [hostingEnabled, setHostingEnabled] = useState(false);

  useEffect(() => {
    if (user?.isVenue) venuePartner.hostingStatus().then((s) => setHostingEnabled(s.hostingEnabled)).catch(() => {});
  }, [user?.isVenue]);

  if (!user) return <Navigate to="/login" state={{ from: '/venue' }} replace />;
  if (!user.isVenue) {
    if (user.pendingRole === 'venue' && user.roleStatus === 'pending') return <PendingReview role="venue" />;
    if (user.pendingRole === 'venue' && user.roleStatus === 'rejected') return <RejectedReview role="venue" reason={user.roleRejectionReason} />;
    return <Navigate to="/venue/onboarding" replace />;
  }

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side">
          <div className="cap">VENUE</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
              {n.label}
            </NavLink>
          ))}
          <NavLink to="/venue/hosting" end className={({ isActive }) => (isActive ? 'on' : '')}>
            🎪 Host events
          </NavLink>
          {hostingEnabled && HOSTING_ENABLED_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'on' : '')}>
              {n.label}
            </NavLink>
          ))}
        </aside>
        <div style={{ minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
    </main>
  );
}
