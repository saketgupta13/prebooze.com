import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';

export default function Otp() {
  const { pendingPhone, loginWithOtp } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [digits, setDigits] = useState(['', '', '', '']);
  const [timer, setTimer] = useState(24);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

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

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    if (digits.some((d) => !d)) return;
    const result = loginWithOtp();
    const from = (location.state as { from?: string } | null)?.from;
    if (result === 'new') {
      navigate('/complete-profile', { state: { from } });
    } else {
      navigate(from ?? '/');
    }
  };

  return (
    <main className="page">
      <div className="container auth-wrap">
        <div className="auth-visual">
          <img src="/prebooze-logo.png" alt="Prebooze" style={{ height: 66, width: 'auto' }} />
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
          <p className="tiny accent">Demo: any 4 digits work</p>

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

          <div className="small muted center" style={{ marginBottom: 16 }}>
            {timer > 0 ? (
              <>Resend in 0:{String(timer).padStart(2, '0')} · </>
            ) : (
              <>
                <button
                  type="button"
                  className="link bold"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
                  onClick={() => setTimer(24)}
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

          <button className="btn btn-pri btn-block btn-lg" disabled={digits.some((d) => !d)}>
            Verify & continue
          </button>
        </form>
      </div>
    </main>
  );
}
