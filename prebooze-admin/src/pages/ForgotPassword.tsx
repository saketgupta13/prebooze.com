import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ToastHost } from '../components/AdminLayout';
import { useBranding } from '../lib/useBranding';
import { liveAuth, LiveApiError, liveApiEnabled } from '../lib/liveApi';

/** Real POST /admin/auth/forgot-password — always shows the same generic
 * "check your email" message on submit, matching the backend's own
 * enumeration-safe design (StaffAuthService.forgotPassword never reveals
 * whether an email actually matches a Staff row). */
export default function ForgotPassword() {
  const { logoUrl } = useBranding();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await liveAuth.forgotPassword(email.trim());
      setSent(true);
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
        ) : sent ? (
          <div className="login-box">
            <div className="display" style={{ fontSize: 18 }}>Check your email</div>
            <div className="small muted">
              If <b>{email.trim()}</b> matches a staff account, we've sent a password reset link to it. The link expires in 30 minutes.
            </div>
          </div>
        ) : (
          <form className="login-box" onSubmit={submit}>
            <div className="display" style={{ fontSize: 18 }}>Forgot your password?</div>
            <div className="small muted" style={{ marginTop: -8 }}>Enter your staff email and we'll send you a reset link.</div>
            <div className="field">
              <label>Email</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staffname@prebooze.com" autoFocus />
            </div>
            {err && <div className="small red">{err}</div>}
            <button type="submit" className="btn btn-pri" style={{ padding: 11, fontSize: 13.5 }} disabled={busy || !email.trim()}>
              Send reset link
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
