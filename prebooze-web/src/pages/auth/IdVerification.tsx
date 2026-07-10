import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';

export default function IdVerification() {
  const { updateUser } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [aadhaarUploaded, setAadhaarUploaded] = useState(false);
  const [aadhaarNo, setAadhaarNo] = useState('');
  const [selfie, setSelfie] = useState(false);

  const canSubmit = aadhaarUploaded && aadhaarNo.replace(/\D/g, '').length >= 4 && selfie;

  const submit = () => {
    updateUser({ idVerified: true, profilePct: 100 });
    navigate(from ?? '/profile');
  };

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ fontSize: 24 }}>Verify your identity</h1>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(from ?? '/')}>
            Do it later
          </button>
        </div>
        <p className="muted small" style={{ margin: '8px 0 22px' }}>
          step 2 of 2 — Verified guests get the <span className="verified">✓</span> badge and faster
          entry at gates
        </p>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>1 · Aadhaar card</h3>
          <div
            className={`upload-box ${aadhaarUploaded ? 'done' : ''}`}
            onClick={() => setAadhaarUploaded((v) => !v)}
            style={{ marginBottom: 12 }}
          >
            {aadhaarUploaded ? '✓ Front side uploaded' : '⬆ upload front side'}
          </div>
          <div className="field">
            <span>Aadhaar number</span>
            <input
              placeholder="•••• •••• 4821"
              value={aadhaarNo}
              onChange={(e) => setAadhaarNo(e.target.value)}
              inputMode="numeric"
            />
          </div>
          {aadhaarUploaded && aadhaarNo && (
            <div className="small" style={{ color: '#4fd394' }}>
              ✓ OTP verified with UIDAI
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>2 · Selfie capture</h3>
          <div
            className={`upload-box ${selfie ? 'done' : ''}`}
            onClick={() => setSelfie((v) => !v)}
            style={{ padding: 34 }}
          >
            {selfie ? '✓ Selfie captured — matching with Aadhaar photo… ✓ matched' : '🤳 camera frame — face in oval · 📷 Capture selfie'}
          </div>
        </div>

        <button className="btn btn-pri btn-block btn-lg" disabled={!canSubmit} onClick={submit}>
          Submit for verification
        </button>
        <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
          🔒 encrypted · used only for identity verification · usually approved in minutes
        </div>
      </div>
    </main>
  );
}
