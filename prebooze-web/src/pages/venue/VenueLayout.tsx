import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import PendingReview, { RejectedReview } from '../../components/PendingReview';

const NAV = [
  { to: '/venue', label: '▦ Dashboard', end: true },
  { to: '/venue/listing', label: '🏛 My listing' },
  { to: '/venue/events', label: '📅 Events here' },
  { to: '/venue/subscription', label: '💳 Subscription' },
  { to: '/venue/settings', label: '⚙ Settings' },
];

export default function VenueLayout() {
  const { user } = useApp();

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
        </aside>
        <div style={{ minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
    </main>
  );
}
