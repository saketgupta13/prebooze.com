import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import {
  LayoutDashboard, LayoutGrid, Ticket, Users, Camera, ClipboardList, Radio, Star, Tag, ShoppingCart, Banknote, Receipt, Megaphone,
  ShieldCheck, Award, Settings as SettingsIcon, Rocket, CreditCard, LifeBuoy, Landmark, Calendar, Sparkles, Settings,
  QrCode, Activity, Percent, Shield, Globe, Trophy, MoreHorizontal, X, type LucideIcon,
} from 'lucide-react';

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; module?: string | 'owner' };

// These four arrays mirror OrganizerLayout/VenueLayout/VenueOrgLayout/
// PromoterLayout/LineupLayout's own NAV exactly (same "mirror, don't share"
// precedent already used by Header.tsx's ORG_NAV/VENUE_HOSTING_NAV) — kept
// in sync by hand rather than imported, since this file and every console
// layout it mirrors are all independently lazy-loaded.
const ORG_NAV: NavItem[] = [
  { to: '/organizer', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/organizer/events', label: 'Events', icon: Ticket, module: 'Events & wizard' },
  { to: '/organizer/bookings', label: 'Bookings', icon: Users, module: 'Attendees & check-in' },
  { to: '/organizer/scanner', label: 'Scanner', icon: Camera, module: 'Attendees & check-in' },
  { to: '/organizer/guestlist', label: 'Guest list', icon: ClipboardList, module: 'Guest list' },
  { to: '/organizer/live', label: 'Live monitor', icon: Radio, module: 'Attendees & check-in' },
  { to: '/organizer/reviews', label: 'Reviews', icon: Star, module: 'Reviews' },
  { to: '/organizer/coupons', label: 'Promo codes', icon: Tag, module: 'Coupons' },
  { to: '/organizer/carts', label: 'Abandoned carts', icon: ShoppingCart, module: 'Events & wizard' },
  { to: '/organizer/payouts', label: 'Payouts', icon: Banknote, module: 'Payouts & withdrawals' },
  { to: '/organizer/transactions', label: 'Transactions', icon: Receipt, module: 'Payouts & withdrawals' },
  { to: '/organizer/promoters', label: 'Promoters', icon: Megaphone, module: 'Payouts & withdrawals' },
  { to: '/organizer/team', label: 'Team & roles', icon: ShieldCheck, module: 'Settings & team' },
  { to: '/organizer/billing', label: 'Featured & billing', icon: Award, module: 'owner' },
  { to: '/organizer/marketing', label: 'Marketing', icon: Rocket, module: 'owner' },
  { to: '/organizer/settings', label: 'Settings', icon: SettingsIcon, module: 'Settings & team' },
  { to: '/payment-methods', label: 'Payment methods', icon: CreditCard },
  { to: '/help', label: 'Help center', icon: LifeBuoy },
];

const VENUE_NAV: NavItem[] = [
  { to: '/venue', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/venue/listing', label: 'My listing', icon: Landmark },
  { to: '/venue/events', label: 'Events here', icon: Calendar },
  { to: '/venue/reviews', label: 'Reviews', icon: Star },
  { to: '/venue/billing', label: 'Featured & billing', icon: Sparkles },
  { to: '/venue/settings', label: 'Settings', icon: Settings },
  { to: '/payment-methods', label: 'Payment methods', icon: CreditCard },
  { to: '/help', label: 'Help center', icon: LifeBuoy },
];

const VENUE_HOSTING_NAV: NavItem[] = [
  { to: '/venue/hosting', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/venue/hosting/events', label: 'Events', icon: Ticket, module: 'Events & wizard' },
  { to: '/venue/hosting/bookings', label: 'Bookings', icon: Users, module: 'Attendees & check-in' },
  { to: '/venue/hosting/scanner', label: 'Scanner', icon: QrCode, module: 'Attendees & check-in' },
  { to: '/venue/hosting/guest-list', label: 'Guest list', icon: ClipboardList, module: 'Guest list' },
  { to: '/venue/hosting/live', label: 'Live monitor', icon: Activity, module: 'Attendees & check-in' },
  { to: '/venue/hosting/coupons', label: 'Promo codes', icon: Percent, module: 'Coupons' },
  { to: '/venue/hosting/carts', label: 'Abandoned carts', icon: ShoppingCart, module: 'Events & wizard' },
  { to: '/venue/hosting/ledger', label: 'Payouts', icon: Banknote, module: 'Payouts & withdrawals' },
  { to: '/venue/hosting/marketing', label: 'Marketing', icon: Rocket, module: 'owner' },
  { to: '/venue/hosting/promoters', label: 'Promoters', icon: Megaphone, module: 'Payouts & withdrawals' },
  { to: '/venue/hosting/team', label: 'Team & roles', icon: Shield, module: 'Settings & team' },
  { to: '/venue/hosting/settings', label: 'Settings', icon: Settings, module: 'Settings & team' },
  { to: '/payment-methods', label: 'Payment methods', icon: CreditCard },
  { to: '/help', label: 'Help center', icon: LifeBuoy },
];

const PROMOTER_NAV: NavItem[] = [
  { to: '/promoter', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/promoter/promotions', label: 'My promotions', icon: Megaphone },
  { to: '/promoter/city-events', label: 'Promote any event', icon: Globe },
  { to: '/promoter/earnings', label: 'Earnings', icon: Banknote },
  { to: '/promoter/team', label: 'Team', icon: Users },
  { to: '/promoter/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/promoter/subscription', label: 'Subscription', icon: CreditCard },
  { to: '/promoter/settings', label: 'Profile & settings', icon: Settings },
  { to: '/payment-methods', label: 'Payment methods', icon: CreditCard },
  { to: '/help', label: 'Help center', icon: LifeBuoy },
];

const LINEUP_NAV: NavItem[] = [
  { to: '/artist', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/artist/profile', label: 'Profile & settings', icon: Settings },
  { to: '/artist/billing', label: 'Featured & billing', icon: Star },
  { to: '/payment-methods', label: 'Payment methods', icon: CreditCard },
  { to: '/help', label: 'Help center', icon: LifeBuoy },
];

const PINNED_COUNT = 4;

const canView = (module: string | 'owner' | undefined, perms: Record<string, { view: boolean }>) =>
  module === undefined || (module !== 'owner' && !!perms[module]?.view);

/** Wraps a page's content in the same real console sidebar (+ mobile bottom
 * tabs) every elevated role already sees on their own console pages — used
 * by pages that live outside any one console's own Outlet (Payment methods,
 * Help center) but should still feel like part of that console rather than
 * a bare orphan page. Guests (no role) get no sidebar, same as before —
 * they have no console to show. */
export default function RoleConsoleFrame({ children, maxWidth }: { children: ReactNode; maxWidth?: number }) {
  const { user, orgTeamAccess, venueTeamAccess } = useApp();

  let cap: string | null = null;
  let sub: string | null = null;
  let nav: NavItem[] = [];

  if (user?.isOrganizer) {
    cap = 'ORGANIZER';
    nav = ORG_NAV;
  } else if (orgTeamAccess) {
    cap = 'ORGANIZER';
    sub = `Managing ${orgTeamAccess.organizerBrand} as ${orgTeamAccess.roleName}`;
    nav = ORG_NAV.filter((n) => canView(n.module, orgTeamAccess.permissions));
  } else if (user?.isVenue) {
    cap = 'VENUE';
    nav = VENUE_NAV;
  } else if (venueTeamAccess) {
    cap = 'VENUE HOSTING';
    sub = `Managing ${venueTeamAccess.venueBrand} as ${venueTeamAccess.roleName}`;
    nav = VENUE_HOSTING_NAV.filter((n) => canView(n.module, venueTeamAccess.permissions));
  } else if (user?.isPromoter) {
    cap = 'PROMOTER';
    nav = PROMOTER_NAV;
  } else if (user?.isLineup) {
    cap = 'ARTIST';
    nav = LINEUP_NAV;
  }

  if (!cap) return <div className="container" style={maxWidth ? { maxWidth } : undefined}>{children}</div>;

  return (
    <>
      <div className="container org-layout">
        <aside className="org-side org-side-desktop-only">
          <div className="cap">{cap}</div>
          {sub && <div className="tiny muted" style={{ padding: '0 4px 10px', lineHeight: 1.5 }}>{sub}</div>}
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
              <n.icon size={15} /> {n.label}
            </NavLink>
          ))}
        </aside>
        <div className="org-mobile-content" style={{ minWidth: 0 }}>
          <div style={maxWidth ? { maxWidth } : undefined}>{children}</div>
        </div>
      </div>
      <MobileOrgNav navItems={nav} />
    </>
  );
}

function MobileOrgNav({ navItems }: { navItems: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pinned = navItems.slice(0, PINNED_COUNT);
  const rest = navItems.slice(PINNED_COUNT);

  return (
    <>
      <nav className="org-mobile-tabbar">
        {pinned.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
            <span className="ico"><n.icon size={16} /></span>
            {n.label}
          </NavLink>
        ))}
        {rest.length > 0 && (
          <button onClick={() => setOpen(true)}>
            <span className="ico"><MoreHorizontal size={16} /></span>
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
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'on' : '')}>
                <n.icon size={15} /> {n.label}
              </NavLink>
            ))}
          </div>
        </>
      )}
    </>
  );
}
