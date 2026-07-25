import type { useLiveSession } from '../lib/useLiveSession';
import { liveApiEnabled } from '../lib/liveApi';

type Session = ReturnType<typeof useLiveSession>;

/** Shared chrome for every real "-live" admin page: the not-configured
 * notice, the login/2FA form, and the signed-in header bar. Pages render
 * this, then their own real content once `session.token` exists. */
export function LiveNotConfigured({ title }: { title: string }) {
  return (
    <div className="stack fade">
      <h1 className="page-title">{title}</h1>
      <div className="card">Live API not configured — set `VITE_API_URL` in `.env.local` to reach the real backend.</div>
    </div>
  );
}

export function LiveLoginScreen({ title, session }: { title: string; session: Session }) {
  return (
    <div className="stack fade" style={{ maxWidth: 380 }}>
      <h1 className="page-title">{title}</h1>
      <div className="tiny hint" style={{ marginTop: -6 }}>
        This page talks to the real backend — sign in with your real staff account (separate from the mock admin
        session above).
      </div>
      {!session.staffId ? (
        <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={session.submitLogin}>
          <div className="field">
            <label>Staff email</label>
            <input className="input" value={session.email} onChange={(e) => session.setEmail(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" value={session.password} onChange={(e) => session.setPassword(e.target.value)} />
          </div>
          {session.loginErr && <div className="tiny" style={{ color: 'var(--red)' }}>{session.loginErr}</div>}
          <button type="submit" className="btn btn-pri">Sign in</button>
        </form>
      ) : (
        <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={session.submit2fa}>
          <div className="field">
            <label>6-digit code (emailed to you)</label>
            <input className="input" value={session.code} onChange={(e) => session.setCode(e.target.value)} autoFocus />
          </div>
          {session.loginErr && <div className="tiny" style={{ color: 'var(--red)' }}>{session.loginErr}</div>}
          <button type="submit" className="btn btn-pri">Verify</button>
        </form>
      )}
    </div>
  );
}

export function LiveHeaderBar({ title, session }: { title: string; session: Session }) {
  return (
    <div className="page-hd">
      <h1 className="page-title">{title}</h1>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="tiny muted">signed in as {session.staffName || 'staff'}</span>
        <button className="btn btn-ghost btn-sm" onClick={session.logout}>Sign out</button>
      </div>
    </div>
  );
}

/** Convenience gate — returns the right screen for "not configured" / "not
 * signed in", or null once the page should render its real content. */
export function useLiveGate(title: string, session: Session) {
  if (!liveApiEnabled()) return <LiveNotConfigured title={title} />;
  if (!session.token) return <LiveLoginScreen title={title} session={session} />;
  return null;
}
