import { useState } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import PendingReview, { RejectedReview } from '../../components/PendingReview';
import { LayoutDashboard, Landmark, Calendar, Star, Sparkles, Settings, MoreHorizontal, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/venue', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/venue/listing', label: 'My listing', icon: Landmark },
  { to: '/venue/events', label: 'Events here', icon: Calendar },
  { to: '/venue/reviews', label: 'Reviews', icon: Star },
  { to: '/venue/billing', label: 'Featured & billing', icon: Sparkles },
  { to: '/venue/settings', label: 'Settings', icon: Settings },
];

const PINNED_COUNT = 4;

/** The venue's own identity/listing panel — nothing about hosting events
 * lives here any more (see VenueOrgLayout for that, a fully separate panel).
 * Keeping these two panels structurally separate, rather than one merged
 * sidebar, is a deliberate call: a venue and the events it might host are
 * different concerns with different audiences, and merging them read as
 * confusing in practice. Switching between the two panels lives in the
 * account dropdown menu (Header.tsx), not a sidebar/header control here. */
export default function VenueLayout() {
  const { user, venueTeamAccess } = useApp();

  if (!user) return <Navigate to="/login" state={{ from: '/venue' }} replace />;
  if (!user.isVenue) {
    // An invited hosting-team member has no access to the venue's own
    // panel (single-owner, unchanged) — send them to the one panel that
    // is theirs instead of the onboarding screen meant for a brand-new
    // applicant.
    if (venueTeamAccess) return <Navigate to="/venue/hosting" replace />;
    if (user.pendingRole === 'venue' && user.roleStatus === 'pending') return <PendingReview role="venue" />;
    if (user.pendingRole === 'venue' && user.roleStatus === 'rejected') return <RejectedReview role="venue" reason={user.roleRejectionReason} />;
    return <Navigate to="/venue/onboarding" replace />;
  }

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side org-side-desktop-only">
          <div className="cap">VENUE</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <n.icon size={15} /> {n.label}
            </NavLink>
          ))}
        </aside>
        <div className="org-mobile-content" style={{ minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
      <MobileOrgNav navItems={NAV} />
    </main>
  );
}

/** Mobile-only bottom tab bar + "More" drawer — same shape as
 * VenueOrgLayout/OrganizerLayout's own MobileOrgNav (see those for the full
 * rationale: mirrors prebooze-admin's real Drawer, not a bottom sheet).
 * Duplicated per-console rather than shared, same precedent. */
function MobileOrgNav({ navItems }: { navItems: typeof NAV }) {
  const [open, setOpen] = useState(false);
  const pinned = navItems.slice(0, PINNED_COUNT);
  const rest = navItems.slice(PINNED_COUNT);

  return (
    <>
      <nav className="org-mobile-tabbar">
        {pinned.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
            <span className="ico"><n.icon size={18} /></span>
            {n.label}
          </NavLink>
        ))}
        {rest.length > 0 && (
          <button onClick={() => setOpen(true)}>
            <span className="ico"><MoreHorizontal size={18} /></span>
            More
          </button>
        )}
      </nav>
      {open && (
        <>
          <div className="org-drawer-overlay" onClick={() => setOpen(false)} />
          <div className="org-drawer">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span className="cap" style={{ padding: 0 }}>MORE</span>
              <span onClick={() => setOpen(false)} style={{ cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}><X size={18} /></span>
            </div>
            {rest.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'on' : '')} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <n.icon size={15} /> {n.label}
              </NavLink>
            ))}
          </div>
        </>
      )}
    </>
  );
}
