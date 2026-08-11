import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { usePlatformInfo } from '../lib/usePlatformInfo';
import ProfileCompletion from '../pages/auth/ProfileCompletion';

/** Same visual anchors as the real Header/Footer (logo, copyright) so the
 * takeover doesn't feel like a broken page — just non-interactive, since
 * there's nowhere for them to lead until the form's saved. */
function GateChrome({ children }: { children: ReactNode }) {
  const { logoUrl, footerCopyright } = usePlatformInfo();
  return (
    <>
      <header className="hdr">
        <div className="container hdr-in">
          <span className="hdr-logo" style={{ cursor: 'default' }}>
            <img src={logoUrl || '/prebooze-logo.png'} alt="Prebooze" width={203} height={42} fetchPriority="high" />
          </span>
        </div>
      </header>
      {children}
      <footer className="ftr">
        <div className="container ftr-base">
          <img src={logoUrl || '/prebooze-logo.png'} alt="" />
          <span>{footerCopyright}</span>
        </div>
      </footer>
    </>
  );
}

// Role applicants get their own onboarding form as their "profile" (brand
// name, KYC, etc. — separate from User.name/dob/gender, see Otp.tsx's
// skipsGuestFunnel) — exempt while they're actually on it, before they've
// submitted and picked up a roleStatus that exempts them everywhere else.
const ONBOARDING_PATHS = ['/organizer/onboarding', '/venue/onboarding', '/lineup/onboarding', '/promoter/onboarding'];

/** Guest signup used to end at a skippable redirect to /complete-profile —
 * real data showed 61% of new guests verified OTP and never came back to
 * fill it in, every one of them with zero activity afterward. This makes
 * name/DOB/gender a genuine takeover gate, same pattern as ComingSoonGate:
 * nothing else renders, on any route, until a plain guest saves them. */
export default function CompleteProfileGate({ children }: { children: ReactNode }) {
  const { user, orgTeamAccess, orgTeamAccessLoaded } = useApp();
  const { pathname } = useLocation();

  if (!user) return <>{children}</>;
  const missing = !user.name?.trim() || !user.dob || !user.gender;
  if (!missing) return <>{children}</>;
  if (ONBOARDING_PATHS.includes(pathname)) return <>{children}</>;

  const hasElevatedRole = user.isOrganizer || user.isPromoter || user.isLineup || user.isVenue || !!user.pendingRole || !!user.roleStatus;
  if (hasElevatedRole) return <>{children}</>;

  // Team members skip the guest funnel too (Otp.tsx), but that's only known
  // once orgTeamAccess resolves — only worth waiting for on this rare path
  // (missing fields + no role flags yet), not on every page load.
  if (!orgTeamAccessLoaded) return null;
  if (orgTeamAccess) return <>{children}</>;

  return (
    <GateChrome>
      <ProfileCompletion />
    </GateChrome>
  );
}
