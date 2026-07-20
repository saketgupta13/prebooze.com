import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';

/** Guest ID verification — the one part of KYC that's fully automatic.
 * Government ID + selfie are checked instantly (OCR + face-match via our KYC
 * vendor once wired to the backend — see BACKEND.md "Identity & KYC"); every
 * other role (organizer/promoter/lineup/venue) is manual-only by design. */
export default function IdVerification() {
  const { updateUser } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [idDoc, setIdDoc] = useState(false);
  const [selfie, setSelfie] = useState(false);
  const [checking, setChecking] = useState(false);

  const canSubmit = idDoc && selfie && !checking;

  const submit = () => {
    setChecking(true);
    // Simulated automatic OCR + face-match round trip (instant vendor check
    // once live — dev/offline mode approves well-formed submissions locally).
    setTimeout(() => {
      updateUser({ idVerified: true, profilePct: 100 });
      navigate(from ?? '/profile');
    }, 1200);
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
          step 2 of 2 — verified automatically in seconds. Verified guests get the{' '}
          <span className="verified">✓</span> badge and faster entry at gates.
        </p>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>1 · Government ID</h3>
          <div
            className={`upload-box ${idDoc ? 'done' : ''}`}
            onClick={() => setIdDoc((v) => !v)}
            style={{ marginBottom: 4 }}
          >
            {idDoc ? '✓ ID uploaded' : '⬆ upload Aadhaar, PAN, driving licence or passport'}
          </div>
          <div className="tiny muted-2">Front side, all details clearly visible.</div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>2 · Selfie capture</h3>
          <div
            className={`upload-box ${selfie ? 'done' : ''}`}
            onClick={() => setSelfie((v) => !v)}
            style={{ padding: 34 }}
          >
            {selfie ? '✓ Selfie captured' : '🤳 camera frame — face in oval · 📷 Capture selfie'}
          </div>
        </div>

        <button className="btn btn-pri btn-block btn-lg" disabled={!canSubmit} onClick={submit}>
          {checking ? 'Verifying automatically…' : 'Submit for verification'}
        </button>
        <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
          🔒 encrypted · checked automatically by our ID verification partner · result in seconds
        </div>
      </div>
    </main>
  );
}
