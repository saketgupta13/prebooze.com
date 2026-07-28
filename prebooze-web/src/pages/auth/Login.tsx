import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { enabledCountries } from '../../data/locations';
import { ApiError } from '../../api/client';
import { usePlatformInfo } from '../../lib/usePlatformInfo';

export default function Login() {
  const { requestOtp } = useApp();
  const { logoUrl } = usePlatformInfo();
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('+91');
  const [agreed, setAgreed] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 10) return setErr('Enter a valid 10-digit mobile number');
    if (!agreed) return setErr('Please accept the Terms & Privacy Policy');
    setErr('');
    setBusy(true);
    try {
      await requestOtp(`${code} ${phone}`);
      navigate('/verify-otp', { state: location.state });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't send code — please try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <div className="container auth-wrap">
        <div className="auth-visual">
          <img src={logoUrl || '/prebooze-logo.png'} alt="Prebooze" style={{ height: 66, width: 'auto' }} />
          <p className="muted small">
            Concerts · comedy · festivals · warehouse parties — from verified organizers only.
          </p>
        </div>

        <form className="card card-shadow auth-card" onSubmit={submit} style={{ width: '100%' }}>
          <h1 style={{ fontSize: 24 }}>Welcome 👋</h1>
          <p className="muted small" style={{ margin: '6px 0 18px' }}>
            Login or sign up — no password needed
          </p>

          <div className="field">
            <span>Phone number</span>
            <div className="form-row phone-row">
              <select value={code} onChange={(e) => setCode(e.target.value)}>
                {enabledCountries.map((c) => (
                  <option key={c.iso} value={c.dial}>{c.flag} {c.dial}</option>
                ))}
              </select>
              <input
                placeholder="10-digit mobile number"
                inputMode="numeric"
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setErr(''); }}
                autoFocus
              />
            </div>
          </div>

          <label className="checkbox-row" style={{ marginBottom: 16 }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              I agree with the{' '}
              <Link to="/legal/terms" className="link">
                Terms & Conditions
              </Link>{' '}
              and{' '}
              <Link to="/legal/privacy" className="link">
                Privacy Policy
              </Link>
            </span>
          </label>

          {err && (
            <div className="danger-text small" style={{ marginBottom: 12 }}>
              ✕ {err}
            </div>
          )}

          <button className="btn btn-whatsapp btn-block btn-lg" disabled={busy}>
            {busy ? 'Sending…' : 'Get OTP on WhatsApp 💬'}
          </button>
          <div className="tiny muted-2 center" style={{ marginTop: 12 }}>
            WhatsApp OTP only — no password, no SMS
          </div>
        </form>
      </div>
    </main>
  );
}
