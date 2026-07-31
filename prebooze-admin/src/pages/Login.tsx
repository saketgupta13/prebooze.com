import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { ToastHost } from '../components/AdminLayout';
import { GUEST_SITE_URL } from '../store/data';
import type { Role } from '../types';
import { useBranding } from '../lib/useBranding';
import { useLiveSession } from '../lib/useLiveSession';
import { liveApiEnabled } from '../lib/liveApi';

const COPY: Record<Role, { heading: string; sub: string; placeholder: string; button: string; footnote: string }> = {
  admin: {
    heading: 'Admin sign in',
    sub: 'Full access to the Prebooze control center.',
    placeholder: 'admin@prebooze.com',
    button: 'Sign in to admin panel',
    footnote: 'Owners & managers only. Contact IT for access issues.',
  },
  staff: {
    heading: 'Staff sign in',
    sub: 'Scoped access — bookings, refunds & gate check-in.',
    placeholder: 'staffname@prebooze.com',
    button: 'Sign in as staff',
    footnote: "Ask your manager for an invite if you don't have an account.",
  },
};

export default function Login() {
  const { session, login } = useAdmin();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>('admin');
  const live = useLiveSession();
  const { logoUrl } = useBranding();

  // Bridges a real staff login into the app's own session — most pages
  // still read role/email off this for display, while liveApiEnabled()
  // slices (notifications, subscriptions, etc.) now work because a real
  // pba_live_staff_token exists too, set by useLiveSession's submitLogin.
  useEffect(() => {
    if (live.token) {
      login(role, live.staffName || live.email);
      navigate('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.token]);

  if (session) return <Navigate to="/" replace />;

  const copy = COPY[role];

  return (
    <div className="login-wrap fade">
      <div className="login-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <img src={logoUrl || '/logo.png'} alt="Prebooze" style={{ height: 52, width: 'auto' }} />
          <div className="display" style={{ fontSize: 13, color: 'var(--muted)', letterSpacing: 0.5 }}>
            TEAM SIGN IN
          </div>
        </div>

        <div className="login-tabs">
          <button className={role === 'admin' ? 'on' : ''} onClick={() => setRole('admin')}>
            Admin login
          </button>
          <button className={role === 'staff' ? 'on' : ''} onClick={() => setRole('staff')}>
            Staff login
          </button>
        </div>

        {!liveApiEnabled() ? (
          <div className="login-box">
            <div className="small red">
              Live API not configured — set <code>VITE_API_URL</code> in <code>.env.local</code> to sign in.
            </div>
          </div>
        ) : !live.staffId ? (
          <form className="login-box" onSubmit={live.submitLogin}>
            <div className="display" style={{ fontSize: 18 }}>{copy.heading}</div>
            <div className="small muted" style={{ marginTop: -8 }}>{copy.sub}</div>
            <div className="field">
              <label>Email</label>
              <input
                className="input"
                value={live.email}
                onChange={(e) => live.setEmail(e.target.value)}
                placeholder={copy.placeholder}
                autoFocus
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                className="input"
                type="password"
                value={live.password}
                onChange={(e) => live.setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {live.loginErr && <div className="small red">{live.loginErr}</div>}
            <button type="submit" className="btn btn-pri" style={{ padding: 11, fontSize: 13.5 }}>
              {copy.button}
            </button>
            <div className="tiny hint" style={{ textAlign: 'center' }}>{copy.footnote}</div>
          </form>
        ) : (
          <form className="login-box" onSubmit={live.submit2fa}>
            <div className="display" style={{ fontSize: 18 }}>Verification code</div>
            <div className="small muted" style={{ marginTop: -8 }}>Enter the 6-digit code emailed to you.</div>
            <div className="field">
              <label>Code</label>
              <input className="input" value={live.code} onChange={(e) => live.setCode(e.target.value)} autoFocus />
            </div>
            {live.loginErr && <div className="small red">{live.loginErr}</div>}
            <button type="submit" className="btn btn-pri" style={{ padding: 11, fontSize: 13.5 }}>
              Verify
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', fontSize: 12.5 }}>
          <a href={GUEST_SITE_URL}>Not staff? Browse events as a guest →</a>
        </div>
      </div>
      <ToastHost />
    </div>
  );
}
