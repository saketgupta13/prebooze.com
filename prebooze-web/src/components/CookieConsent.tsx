import { useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'pb_cookie_consent'; // 'accepted' | 'rejected'

/** Cookie consent banner — shown once until the guest chooses, then
 * remembered in localStorage. Only essential cookies (session/auth) are
 * ever required for Prebooze to function; "reject" just skips analytics —
 * there's no analytics SDK wired up yet for this to actually gate, but the
 * choice is recorded for when there is. */
export default function CookieConsent() {
  const [choice, setChoice] = useState(() => localStorage.getItem(STORAGE_KEY));

  if (choice) return null;

  const decide = (value: 'accepted' | 'rejected') => {
    localStorage.setItem(STORAGE_KEY, value);
    setChoice(value);
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
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <p style={{ margin: 0, flex: '1 1 320px', fontSize: 13, color: 'var(--muted)' }}>
        We use cookies to keep you signed in and to remember your city and preferences. See our{' '}
        <Link to="/legal/cookies" style={{ color: 'var(--accent)' }}>Cookie Policy</Link> for details.
      </p>
      <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
        <button className="btn btn-ghost" onClick={() => decide('rejected')}>Reject non-essential</button>
        <button className="btn btn-pri" onClick={() => decide('accepted')}>Accept all</button>
      </div>
    </div>
  );
}
