import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { ToastHost } from '../components/AdminLayout';
import { GUEST_SITE_URL } from '../store/data';
import type { Role } from '../types';

// Single hard-coded owner account — this panel isn't backed by a real auth
// service yet, so lock the admin tab to these exact credentials rather than
// accepting any non-empty email/password (that let anyone in).
const ADMIN_EMAIL = 'admin@prebooze.com';
const ADMIN_PASSWORD = 'Krusa@1323@';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Navigate to="/" replace />;

  const copy = COPY[role];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Enter both email and password.');
      return;
    }
    if (role === 'admin' && (email.trim().toLowerCase() !== ADMIN_EMAIL || password !== ADMIN_PASSWORD)) {
      setError('Invalid email or password.');
      return;
    }
    login(role, email.trim());
    navigate('/');
  };

  return (
    <div className="login-wrap fade">
      <div className="login-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="Prebooze" style={{ height: 52, width: 'auto' }} />
          <div className="display" style={{ fontSize: 13, color: 'var(--muted)', letterSpacing: 0.5 }}>
            TEAM SIGN IN
          </div>
        </div>

        <div className="login-tabs">
          <button
            className={role === 'admin' ? 'on' : ''}
            onClick={() => {
              setRole('admin');
              setError(null);
            }}
          >
            Admin login
          </button>
          <button
            className={role === 'staff' ? 'on' : ''}
            onClick={() => {
              setRole('staff');
              setError(null);
            }}
          >
            Staff login
          </button>
        </div>

        <form className="login-box" onSubmit={submit}>
          <div className="display" style={{ fontSize: 18 }}>{copy.heading}</div>
          <div className="small muted" style={{ marginTop: -8 }}>{copy.sub}</div>
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              style={error && !email.trim() ? { borderColor: 'var(--red)' } : undefined}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder={copy.placeholder}
              autoFocus
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="input"
              style={error && !password.trim() ? { borderColor: 'var(--red)' } : undefined}
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="••••••••"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
              <input type="checkbox" checked={remember} onChange={() => setRemember((r) => !r)} />
              Remember me
            </label>
            <a>Forgot password?</a>
          </div>
          {error && <div className="small red">{error}</div>}
          <button type="submit" className="btn btn-pri" style={{ padding: 11, fontSize: 13.5 }}>
            {copy.button}
          </button>
          <div className="tiny hint" style={{ textAlign: 'center' }}>{copy.footnote}</div>
        </form>

        <div style={{ textAlign: 'center', fontSize: 12.5 }}>
          <a href={GUEST_SITE_URL}>Not staff? Browse events as a guest →</a>
        </div>
      </div>
      <ToastHost />
    </div>
  );
}
