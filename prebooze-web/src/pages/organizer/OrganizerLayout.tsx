import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import PendingReview, { RejectedReview } from '../../components/PendingReview';

const NAV = [
  { to: '/organizer', label: '▦ Dashboard', end: true },
  { to: '/organizer/events', label: '🎫 Events' },
  { to: '/organizer/attendees', label: '👥 Attendees' },
  { to: '/organizer/scanner', label: '📷 Scanner' },
  { to: '/organizer/guestlist', label: '📋 Guest list' },
  { to: '/organizer/live', label: '● Live monitor' },
  { to: '/organizer/reviews', label: '★ Reviews' },
  { to: '/organizer/coupons', label: '🏷 Coupons' },
  { to: '/organizer/carts', label: '🛒 Abandoned carts' },
  { to: '/organizer/payouts', label: '💰 Payouts' },
  { to: '/organizer/team', label: '🛡 Team & roles' },
  { to: '/organizer/subscription', label: '💳 Subscription' },
  { to: '/organizer/settings', label: '⚙ Settings' },
];

export default function OrganizerLayout() {
  const { user } = useApp();

  if (!user) return <Navigate to="/login" state={{ from: '/organizer' }} replace />;
  if (!user.isOrganizer) {
    if (user.pendingRole === 'organizer' && user.roleStatus === 'pending') return <PendingReview role="organizer" />;
    if (user.pendingRole === 'organizer' && user.roleStatus === 'rejected') return <RejectedReview role="organizer" reason={user.roleRejectionReason} />;
    return <Navigate to="/organizer/onboarding" replace />;
  }

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side">
          <div className="cap">ORGANIZER</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
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
