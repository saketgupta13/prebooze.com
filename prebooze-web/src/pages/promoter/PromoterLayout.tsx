import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';

const NAV = [
  { to: '/promoter', label: '▦ Dashboard', end: true },
  { to: '/promoter/promotions', label: '📣 My promotions' },
  { to: '/promoter/earnings', label: '💰 Earnings' },
  { to: '/promoter/team', label: '👥 Team' },
  { to: '/promoter/leaderboard', label: '🏆 Leaderboard' },
  { to: '/promoter/subscription', label: '💳 Subscription' },
  { to: '/promoter/settings', label: '⚙ Profile & settings' },
];

export default function PromoterLayout() {
  const { user } = useApp();

  if (!user) return <Navigate to="/login" state={{ from: '/promoter' }} replace />;
  if (!user.isPromoter) return <Navigate to="/promoter/onboarding" replace />;

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side">
          <div className="cap">PROMOTER</div>
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
