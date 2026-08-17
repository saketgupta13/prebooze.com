import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { social } from '../api';
import { getToken } from '../api/client';
import { useApp } from '../store/AppContext';

const STORAGE_KEY = 'pb_cookie_consent'; // 'accepted' | 'rejected'
const REOPEN_EVENT = 'prebooze:manage-cookies';

declare global {
  interface Window {
    __prebooze_loadGtm?: () => void;
    __prebooze_loadFbPixel?: () => void;
  }
}

/** Call from anywhere (e.g. the Cookie Policy page's "Manage cookie
 * preferences" button) to reopen the panel even after a choice was already
 * made, so a guest can change their mind later. */
export function openCookiePreferences() {
  window.dispatchEvent(new Event(REOPEN_EVENT));
}

/** Cookie consent — shown once until the guest chooses, then remembered in
 * localStorage; reopenable later (see openCookiePreferences above) as a
 * granular preferences panel instead of just a yes/no banner. Only
 * essential cookies (session/auth) are ever required for Prebooze to
 * function; turning "Analytics & advertising" off genuinely skips it now —
 * GTM (GA4) and Meta Pixel (index.html) both only load their real tracking
 * scripts once consent is 'accepted', checked on every fresh page load.
 * Turning it off after it was already on this session stops it from
 * reloading on the next visit, but can't retroactively un-load a script
 * that already ran earlier in the current tab. */
export default function CookieConsent() {
  const [open, setOpen] = useState(() => !localStorage.getItem(STORAGE_KEY));
  const [managing, setManaging] = useState(false);
  // Defaults on for a first-time guest (no stored choice yet) — only an
  // explicit prior 'rejected' should show as off when the panel reopens.
  const [analyticsOn, setAnalyticsOn] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'rejected');
  const { updateUser } = useApp();

  useEffect(() => {
    const reopen = () => {
      setAnalyticsOn(localStorage.getItem(STORAGE_KEY) !== 'rejected');
      setManaging(true);
      setOpen(true);
    };
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_EVENT, reopen);
  }, []);

  if (!open) return null;

  const decide = (value: 'accepted' | 'rejected') => {
    const accepted = value === 'accepted';
    localStorage.setItem(STORAGE_KEY, value);
    setOpen(false);
    setManaging(false);
    if (accepted) {
      window.__prebooze_loadGtm?.();
      window.__prebooze_loadFbPixel?.();
    }
    if (getToken()) {
      // Real sync either direction — a guest who previously accepted and
      // now rejects (via the reopened Manage cookies panel) needs the
      // server-side Meta Conversions API actually turned back off too, not
      // just the browser-side scripts (see meta-conversions.service.ts).
      social.setMarketingConsent(accepted).catch(() => {});
      updateUser({ marketingConsent: accepted });
      // Default the "show me in the People directory" opt-in on when
      // cookies are accepted — reject never turns this back off
      // automatically (Profile settings has its own explicit toggle for it).
      if (accepted) {
        social.setDiscoverable(true).catch(() => {});
        updateUser({ discoverable: true });
      }
    } else if (accepted) {
      // Not logged in yet — nothing to sync marketingConsent/discoverable
      // onto. A brand-new signup already gets the real choice at creation
      // (auth.verifyOtp passes it directly); an existing-but-logged-out
      // account consumes this pending flag exactly once, right after its
      // next login (see AppContext.tsx's loginWithOtp).
      localStorage.setItem('pb_pending_discoverable', '1');
    }
    // Rejecting while logged out needs no pending flag at all — a new
    // signup defaults marketingConsent to false already, and an existing
    // account's stored value is simply left as whatever it already was.
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 70,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -4px 24px rgba(0,0,0,.25)',
        padding: '14px 16px',
        display: 'flex',
        gap: 14,
        alignItems: managing ? 'flex-start' : 'center',
        flexWrap: 'wrap',
      }}
    >
      {!managing ? (
        <>
          <p style={{ margin: 0, flex: '1 1 320px', fontSize: 13, color: 'var(--muted)' }}>
            We use cookies to keep you signed in and to remember your city and preferences. See our{' '}
            <Link to="/legal/cookies" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Cookie Policy</Link> for details.
          </p>
          <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
            <button className="btn btn-ghost" onClick={() => setManaging(true)}>Manage cookies</button>
            <button className="btn btn-pri" onClick={() => decide('accepted')}>Accept all</button>
          </div>
        </>
      ) : (
        <div style={{ flex: '1 1 100%', maxWidth: 520 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Cookie preferences</div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted)' }}>
            Choose what Prebooze can use on this device. See our{' '}
            <Link to="/legal/cookies" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Cookie Policy</Link> for what each category does.
          </p>
          <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Essential</div>
                <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>Sign-in, city, cart — always on, required to use Prebooze.</div>
              </div>
              <button className="btn btn-sm btn-ghost" disabled style={{ flex: 'none', opacity: 0.6 }}>Always on</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Analytics &amp; advertising</div>
                <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>Helps us see how Prebooze is used and how well our promotions work — also turns on the People directory by default (change anytime in Profile).</div>
              </div>
              <button
                className={`btn btn-sm ${analyticsOn ? 'btn-pri' : 'btn-ghost'}`}
                style={{ flex: 'none' }}
                onClick={() => setAnalyticsOn((v) => !v)}
              >
                {analyticsOn ? 'On' : 'Off'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setManaging(false)}>Back</button>
            <button className="btn btn-pri btn-sm" onClick={() => decide(analyticsOn ? 'accepted' : 'rejected')}>Save preferences</button>
          </div>
        </div>
      )}
    </div>
  );
}
