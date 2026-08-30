import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
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
  // Captured once, at mount — true only for the genuine "no choice exists
  // yet" case. openCookiePreferences() (the Cookie Policy page's "Manage
  // cookie preferences" button) can only ever be reached by a guest who
  // already has a stored choice — the site is inert while blocking, so
  // there's no way to navigate there and trigger a reopen while it's true.
  const [blocking] = useState(() => !localStorage.getItem(STORAGE_KEY));
  const [managing, setManaging] = useState(false);
  // Defaults on for a first-time guest (no stored choice yet) — only an
  // explicit prior 'rejected' should show as off when the panel reopens.
  const [analyticsOn, setAnalyticsOn] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'rejected');
  const { updateUser } = useApp();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reopen = () => {
      setAnalyticsOn(localStorage.getItem(STORAGE_KEY) !== 'rejected');
      setManaging(true);
      setOpen(true);
    };
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_EVENT, reopen);
  }, []);

  // Real blocking, not just visual — page scroll is locked and focus is
  // pulled into (and held inside) the dialog, so a guest can't scroll past
  // or tab/keyboard-focus their way into the page underneath. A plain
  // mount-time .focus() alone isn't enough: another element with its own
  // autoFocus (e.g. CityPicker's city-search input, for a guest who also
  // has no city set yet) can win that race depending on effect order —
  // pointer-events blocking from the backdrop doesn't stop a keyboard user
  // from typing into whatever already has DOM focus, so this also
  // re-claims focus on every focusin that lands outside the dialog, for as
  // long as blocking stays active.
  useEffect(() => {
    if (!blocking || !open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFirst = () => dialogRef.current?.querySelector<HTMLElement>('button, a[href], input')?.focus();
    focusFirst();
    const id = requestAnimationFrame(focusFirst);
    const onFocusIn = (e: FocusEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) focusFirst();
    };
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(id);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [blocking, open]);

  const trapFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input')
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

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
    // Single wrapper handles backdrop + centering + click-capture — styled
    // like .modal-ov (index.css, used by CityPicker) rather than that class
    // itself, since its dimming/pointer-capture need to be conditional on
    // `blocking` rather than always-on. When blocking, this is dimmed and
    // blurred enough that CityPicker's own modal (which can show at the
    // same time for a first-time guest with no city set — it lives inside
    // .hdr's z-index:50 stacking context and can never paint above this
    // root-level wrapper regardless of its own z-index) reads as inert
    // background, not as something still clickable. When not blocking (the
    // reopened-later case, via "Manage cookie preferences" on the Cookie
    // Policy page), the wrapper is transparent and pointer-events: none, so
    // only the card itself is interactive and everything else on the page
    // stays fully clickable/scrollable underneath — no outside-click
    // dismiss here (pointer-events: none means the wrapper itself never
    // receives that click to begin with), close via Back/Save as before.
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '8vh 16px 16px',
        overflowY: 'auto',
        background: blocking ? 'rgba(5,6,4,.78)' : 'transparent',
        backdropFilter: blocking ? 'blur(3px)' : undefined,
        pointerEvents: blocking ? 'auto' : 'none',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-label="Cookie consent"
        aria-modal={blocking ? true : undefined}
        onKeyDown={blocking ? trapFocus : undefined}
        className="card card-shadow"
        style={{ width: '100%', maxWidth: 420, pointerEvents: 'auto' }}
      >
        {!managing ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>Cookies <Cookie size={16} /></div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
              We use cookies to keep you signed in and to remember your city and preferences. See our{' '}
              <Link to="/legal/cookies" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Cookie Policy</Link> for details.
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              <button className="btn btn-pri btn-block" onClick={() => decide('accepted')}>Accept all</button>
              <button className="btn btn-ghost btn-block" onClick={() => setManaging(true)}>Manage cookies</button>
            </div>
          </>
        ) : (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Cookie preferences</div>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)' }}>
              Choose what Prebooze can use on this device. See our{' '}
              <Link to="/legal/cookies" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Cookie Policy</Link> for what each category does.
            </p>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
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
              <button className="btn btn-pri btn-sm" style={{ flex: 1 }} onClick={() => decide(analyticsOn ? 'accepted' : 'rejected')}>Save preferences</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
