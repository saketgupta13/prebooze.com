import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import PendingReview, { RejectedReview } from '../../components/PendingReview';
import { venuePartner } from '../../api';
import PanelSwitcher from './PanelSwitcher';

/** Same nav shape as OrganizerLayout's real NAV — Dashboard, Events,
 * Attendees, Scanner, Guest list, Live monitor, Promo codes, Abandoned
 * carts, Payouts, Promoters — minus Team & roles (venue deliberately has no
 * team system) and minus Reviews (kept as a single combined destination on
 * the venue panel instead of duplicated here). Only ever rendered once
 * hostingEnabled — before that this whole panel is just the request/status
 * page (VenueHosting.tsx, mounted as the index route), no sub-nav at all. */
const NAV = [
  { to: '/venue/hosting', label: '▦ Dashboard', end: true },
  { to: '/venue/hosting/events', label: '🎫 Events' },
  { to: '/venue/hosting/attendees', label: '👥 Attendees' },
  { to: '/venue/hosting/scanner', label: '📷 Scanner' },
  { to: '/venue/hosting/guest-list', label: '📋 Guest list' },
  { to: '/venue/hosting/live', label: '● Live monitor' },
  { to: '/venue/hosting/coupons', label: '🏷 Promo codes' },
  { to: '/venue/hosting/carts', label: '🛒 Abandoned carts' },
  { to: '/venue/hosting/ledger', label: '💰 Payouts' },
  { to: '/venue/hosting/promoters', label: '📣 Promoters' },
];

export default function VenueOrgLayout() {
  const { user } = useApp();
  const [hostingEnabled, setHostingEnabled] = useState(false);

  useEffect(() => {
    if (user?.isVenue) venuePartner.hostingStatus().then((s) => setHostingEnabled(s.hostingEnabled)).catch(() => {});
  }, [user?.isVenue]);

  if (!user) return <Navigate to="/login" state={{ from: '/venue/hosting' }} replace />;
  if (!user.isVenue) {
    if (user.pendingRole === 'venue' && user.roleStatus === 'pending') return <PendingReview role="venue" />;
    if (user.pendingRole === 'venue' && user.roleStatus === 'rejected') return <RejectedReview role="venue" reason={user.roleRejectionReason} />;
    return <Navigate to="/venue/onboarding" replace />;
  }

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side">
          <PanelSwitcher active="organizer" />
          <div className="cap">ORGANIZER</div>
          {hostingEnabled ? (
            NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
                {n.label}
              </NavLink>
            ))
          ) : (
            <div className="tiny muted-2" style={{ padding: '6px 4px' }}>
              Request to host events to unlock this panel.
            </div>
          )}
        </aside>
        <div style={{ minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
    </main>
  );
}
