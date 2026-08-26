import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { ApiError } from '../../api/client';
import { usePlatformInfo } from '../../lib/usePlatformInfo';

export default function Otp() {
  const { pendingPhone, pendingExistingName, loginWithOtp, requestOtp } = useApp();
  const { logoUrl } = usePlatformInfo();
  const navigate = useNavigate();
  const location = useLocation();
  const [digits, setDigits] = useState(['', '', '', '']);
  const [name, setName] = useState(pendingExistingName);
  const [timer, setTimer] = useState(24);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // Covers "Resend code" (same mounted page, a fresh requestOtp call can
  // update pendingExistingName without a remount) — the useState initializer
  // above already handles the normal Login → Otp navigation.
  useEffect(() => {
    if (pendingExistingName) setName(pendingExistingName);
  }, [pendingExistingName]);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  if (!pendingPhone) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Session expired</h1>
          <Link to="/login" className="btn btn-pri" style={{ marginTop: 18 }}>
            Back to login
          </Link>
        </div>
      </main>
    );
  }

  const masked = pendingPhone.slice(0, 6) + '••• ••' + pendingPhone.slice(-3);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    if (d && i < 3) refs.current[i + 1]?.focus();
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (digits.some((d) => !d)) return;
    if (!name.trim()) {
      setErr('Your name is required to continue');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      const result = await loginWithOtp(digits.join(''), name.trim());
      const from = (location.state as { from?: string } | null)?.from;
      // Straight to whatever they came for (checkout, an event, home) — no
      // forced DOB/gender/photo detour, still a real regression once (see
      // 2026-08-15). Name is the one exception: it's collected right here,
      // on this same screen, rather than as a separate step — see the
      // required name field above.
      navigate(from ?? (result.isTeamMember ? '/organizer' : '/'));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Invalid code — please try again');
      setDigits(['', '', '', '']);
      refs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setTimer(24);
    setErr('');
    try {
      await requestOtp(pendingPhone);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't resend code — please try again");
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

        <form className="card card-shadow auth-card" onSubmit={verify} style={{ width: '100%' }}>
          <Link to="/login" className="small muted">
            ← Back
          </Link>
          <h1 style={{ fontSize: 24, marginTop: 8 }}>Enter the code</h1>
          <p className="muted small" style={{ margin: '6px 0 4px' }}>
            Sent via WhatsApp 💬 to <span className="bold">{masked}</span>
          </p>
          <div className="otp-boxes">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                inputMode="numeric"
                autoFocus={i === 0}
              />
            ))}
          </div>

          <div className="field" style={{ marginBottom: 4 }}>
            <span>Your name *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </div>

          {err && (
            <div className="danger-text small" style={{ marginBottom: 12 }}>
              ✕ {err}
            </div>
          )}

          <div className="small muted center" style={{ marginBottom: 16 }}>
            {timer > 0 ? (
              <>Resend in 0:{String(timer).padStart(2, '0')} · </>
            ) : (
              <>
                <button
                  type="button"
                  className="link bold"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
                  onClick={resend}
                >
                  Resend code
                </button>{' '}
                ·{' '}
              </>
            )}
            <Link to="/login" className="link">
              change number
            </Link>
          </div>

          <button className="btn btn-pri btn-block btn-lg" disabled={busy || digits.some((d) => !d) || !name.trim()}>
            {busy ? 'Verifying…' : 'Verify & continue'}
          </button>
        </form>
      </div>
    </main>
  );
}
