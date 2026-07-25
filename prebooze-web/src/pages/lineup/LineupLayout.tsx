import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import PendingReview, { RejectedReview } from '../../components/PendingReview';

const NAV = [
  { to: '/artist', label: '▦ Dashboard', end: true },
  { to: '/artist/profile', label: '⚙ Profile & settings' },
  { to: '/artist/subscription', label: '💳 Subscription' },
];

export default function LineupLayout() {
  const { user } = useApp();

  if (!user) return <Navigate to="/login" state={{ from: '/artist' }} replace />;
  if (!user.isLineup) {
    if (user.pendingRole === 'lineup' && user.roleStatus === 'pending') return <PendingReview role="lineup" />;
    if (user.pendingRole === 'lineup' && user.roleStatus === 'rejected') return <RejectedReview role="lineup" reason={user.roleRejectionReason} />;
    return <Navigate to="/lineup/onboarding" replace />;
  }

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side">
          <div className="cap">LINE-UP</div>
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
