import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { ToastHost } from '../components/AdminLayout';
import { useBranding } from '../lib/useBranding';
import { liveAuth, LiveApiError, liveApiEnabled } from '../lib/liveApi';

/** Real POST /admin/auth/reset-password — token comes from the
 * staff_password_reset email's CTA link ({{adminUrl}}/reset-password?token=
 * {{token}}, see email-templates.ts). The token is one-shot server-side
 * (StaffAuthService.resetPassword deletes it on any use), so a reused or
 * expired link just fails here with a clear error, not a silent no-op. */
export default function ResetPassword() {
  const { logoUrl } = useBranding();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (password.length < 8) { setErr('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setErr('Passwords don’t match'); return; }
    setBusy(true);
    try {
      await liveAuth.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap fade">
      <div className="login-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <img src={logoUrl || '/logo.png'} alt="Prebooze" style={{ height: 52, width: 'auto' }} />
          <div className="display" style={{ fontSize: 13, color: 'var(--muted)', letterSpacing: 0.5 }}>
            RESET PASSWORD
          </div>
        </div>

        {!liveApiEnabled() ? (
          <div className="login-box">
            <div className="small red">
              Live API not configured — set <code>VITE_API_URL</code> in <code>.env.local</code>.
            </div>
          </div>
        ) : !token ? (
          <div className="login-box">
            <div className="small red">This reset link is missing its token — request a new one from the sign-in page.</div>
          </div>
        ) : done ? (
          <div className="login-box">
            <div className="display" style={{ fontSize: 18 }}>Password updated</div>
            <div className="small muted">Redirecting you to sign in…</div>
          </div>
        ) : (
          <form className="login-box" onSubmit={submit}>
            <div className="display" style={{ fontSize: 18 }}>Set a new password</div>
            <div className="field">
              <label>New password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingRight: 40 }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 8,
                    color: 'var(--muted)', fontSize: 15, lineHeight: 1,
                  }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="field">
              <label>Confirm new password</label>
              <input className="input" type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
            </div>
            {err && <div className="small red">{err}</div>}
            <button type="submit" className="btn btn-pri" style={{ padding: 11, fontSize: 13.5 }} disabled={busy}>
              Reset password
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', fontSize: 12.5 }}>
          <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={13} /> Back to sign in</Link>
        </div>
      </div>
      <ToastHost />
    </div>
  );
}
