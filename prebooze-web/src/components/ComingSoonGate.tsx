import { useEffect, useState } from 'react';
import type { ReactNode, FormEvent } from 'react';
import { usePlatformInfo } from '../lib/usePlatformInfo';
import { getBypassToken, setBypassToken, verifyBypassToken, staffAuth, StaffAuthError } from '../lib/staffBypass';

/** Soft-launch gate — when Settings > Danger zone > "Coming soon mode" is on,
 * the public sees a coming-soon page and nothing else (no header/footer/nav,
 * full takeover), while real staff can still see the actual site by logging
 * in with their real staff account right here. Distinct from MaintenanceGate
 * (a temporary-outage toggle with no bypass, for everyone including staff). */
export default function ComingSoonGate({ children }: { children: ReactNode }) {
  const { comingSoonMode } = usePlatformInfo();
  const [bypassed, setBypassed] = useState<boolean | null>(null); // null = still checking

  useEffect(() => {
    const token = getBypassToken();
    if (!token) {
      setBypassed(false);
      return;
    }
    verifyBypassToken(token).then(setBypassed);
  }, []);

  if (!comingSoonMode) return <>{children}</>;
  if (bypassed) return <>{children}</>;
  if (bypassed === null) return null; // brief check, avoids a flash of the login page for already-bypassed staff

  return <ComingSoonPage onBypass={() => setBypassed(true)} />;
}

function ComingSoonPage({ onBypass }: { onBypass: () => void }) {
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staffId, setStaffId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const res = await staffAuth.login(email.trim(), password);
      if (res.requires2fa && res.staffId) {
        setStaffId(res.staffId);
      } else if (res.token) {
        setBypassToken(res.token);
        onBypass();
      }
    } catch (e) {
      setErr(e instanceof StaffAuthError ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const submit2fa = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const res = await staffAuth.verify2fa(staffId!, code.trim());
      setBypassToken(res.token);
      onBypass();
    } catch (e) {
      setErr(e instanceof StaffAuthError ? e.message : 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg, #0e0f0a)', color: 'var(--text, #f1f3ea)', padding: 24, textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 44, marginBottom: 16 }}>🎟️</div>
      <h1 style={{ fontSize: 28, marginBottom: 10 }}>Prebooze is almost here</h1>
      <p style={{ opacity: 0.7, maxWidth: 420, marginBottom: 28 }}>
        We're putting the finishing touches on your city's next favorite way to find events. Check back soon.
      </p>

      {!showLogin ? (
        <button
          onClick={() => setShowLogin(true)}
          style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.4, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
        >
          Team login
        </button>
      ) : !staffId ? (
        <form onSubmit={submitLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }}>
          <input
            className="input" placeholder="Staff email" value={email} autoFocus
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(139,195,74,.3)', background: 'transparent', color: 'inherit' }}
          />
          <input
            className="input" placeholder="Password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(139,195,74,.3)', background: 'transparent', color: 'inherit' }}
          />
          {err && <div style={{ fontSize: 12, color: '#e57373' }}>{err}</div>}
          <button type="submit" disabled={busy} className="btn btn-pri" style={{ padding: 10 }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      ) : (
        <form onSubmit={submit2fa} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }}>
          <input
            className="input" placeholder="6-digit code" value={code} autoFocus
            onChange={(e) => setCode(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(139,195,74,.3)', background: 'transparent', color: 'inherit' }}
          />
          {err && <div style={{ fontSize: 12, color: '#e57373' }}>{err}</div>}
          <button type="submit" disabled={busy} className="btn btn-pri" style={{ padding: 10 }}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
        </form>
      )}
    </main>
  );
}
