import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { FileDropBox } from '../../components/FileDropBox';
import { dataUrlToFile } from '../../lib/fileUtils';
import { kyc } from '../../api';
import { ApiError } from '../../api/client';

/** Guest ID verification — the one part of KYC that's fully automatic. Used
 * to just be a 1.2s setTimeout that unconditionally marked everyone
 * verified regardless of what (if anything) was uploaded — POST /kyc/guest
 * already existed and does a real OCR + face-match check via our KYC
 * vendor (KycProviderService.checkGuest), it just wasn't called from here.
 * Every other role (organizer/promoter/lineup/venue) is manual-only by
 * design — see BACKEND.md "Identity & KYC". */
export default function IdVerification() {
  const { updateUser } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [idDoc, setIdDoc] = useState('');
  const [selfie, setSelfie] = useState('');
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState('');

  const canSubmit = idDoc && selfie && !checking;

  const submit = async () => {
    setErr('');
    setChecking(true);
    try {
      const [idDocFile, selfieFile] = await Promise.all([
        dataUrlToFile(idDoc, 'id-doc.jpg'),
        dataUrlToFile(selfie, 'selfie.jpg'),
      ]);
      const result = await kyc.submitGuest(idDocFile, selfieFile);
      if (result.status === 'approved') {
        updateUser({ idVerified: true, profilePct: 100 });
        navigate(from ?? '/profile');
      } else {
        setErr(result.reason || "Verification didn't pass — check the photos and try again");
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Verification failed — try again');
    } finally {
      setChecking(false);
    }
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

        {err && <div className="danger-text small" style={{ marginBottom: 16 }}>✕ {err}</div>}

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>1 · Government ID</h3>
          <FileDropBox
            value={idDoc}
            onChange={setIdDoc}
            label="⬆ upload Aadhaar, PAN, driving licence or passport"
            doneLabel="✓ ID uploaded — click to replace"
            style={{ marginBottom: 4 }}
          />
          <div className="tiny muted-2">Front side, all details clearly visible.</div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>2 · Selfie capture</h3>
          <FileDropBox
            value={selfie}
            onChange={setSelfie}
            label="🤳 camera frame — face in oval · 📷 Capture selfie"
            doneLabel="✓ Selfie captured — click to replace"
            style={{ padding: selfie ? undefined : 34 }}
          />
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
