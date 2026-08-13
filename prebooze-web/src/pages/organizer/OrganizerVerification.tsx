import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { organizer, kyc } from '../../api';
import { ApiError } from '../../api/client';
import { FileDropBox } from '../../components/FileDropBox';
import { dataUrlToFile } from '../../lib/fileUtils';
import Loader from '../../components/Loader';
import type { Organizer } from '../../types';

/** Self-serve financial + identity verification — everything Onboarding.tsx
 * used to collect up front (PAN, GSTIN, bank, Aadhaar, selfie), now moved
 * here so it can happen whenever the organizer's actually ready, typically
 * right before their first withdrawal (KycService.withdraw requires
 * `verified`). Submits into the exact same admin Verifications queue every
 * other role's KYC already goes through — see KycService.
 * submitOrganizerVerification / approve(). */
export default function OrganizerVerification() {
  const navigate = useNavigate();
  const [org, setOrg] = useState<Organizer | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const [gstin, setGstin] = useState('');
  const [noGst, setNoGst] = useState(false);
  const [pan, setPan] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [selfie, setSelfie] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [ifsc, setIfsc] = useState('');

  useEffect(() => {
    Promise.all([organizer.me(), kyc.myStatus()])
      .then(([o, submissions]) => {
        setOrg(o);
        setPending(submissions.some((s) => s.kind === 'organizer' && s.status === 'pending'));
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const valid = pan.trim() && (noGst || gstin.trim()) && bankName.trim() && bankAccount.trim() && accountHolder.trim() && ifsc.trim() && aadhaar.trim() && selfie;

  const submit = async () => {
    setErr('');
    setSubmitting(true);
    try {
      const selfieFile = await dataUrlToFile(selfie, 'selfie.jpg');
      await kyc.submitOrganizerVerification(
        {
          gstin: noGst ? undefined : gstin.trim().toUpperCase(),
          noGst,
          pan: pan.trim().toUpperCase(),
          bankName: bankName.trim(),
          bankAccount: bankAccount.trim(),
          accountHolderName: accountHolder.trim(),
          bankIfsc: ifsc.trim().toUpperCase(),
          aadhaar: aadhaar.trim(),
        },
        selfieFile,
      );
      setDone(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to submit — try again');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />;
  if (!org) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err || 'Failed to load'}</div>;

  if (org.verified) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="bold" style={{ marginBottom: 6 }}>You're verified <span className="verified">✓</span></div>
        <p className="muted small">Your account is fully verified — payouts are enabled.</p>
        <Link to="/organizer/settings" className="link small bold" style={{ display: 'inline-block', marginTop: 10 }}>← Back to Settings</Link>
      </div>
    );
  }

  if (pending || done) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="bold" style={{ marginBottom: 6 }}>🛡 Verification under review</div>
        <p className="muted small">
          We've got your details — our team usually reviews within 24h. You'll get a WhatsApp/email once you're verified.
        </p>
        <Link to="/organizer/settings" className="link small bold" style={{ display: 'inline-block', marginTop: 10 }}>← Back to Settings</Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24, marginBottom: 6 }}>Complete verification</h1>
        <Link to="/organizer/settings" className="link small bold">← Back to Settings</Link>
      </div>
      <p className="muted small" style={{ marginBottom: 18 }}>
        Required once, before your first withdrawal — gets you the <span className="verified">✓</span> verified badge and enables payouts.
      </p>

      <div className="card" style={{ marginBottom: 16, maxWidth: 640 }}>
        <h3 style={{ marginBottom: 12 }}>Business details</h3>
        <div className="form-row">
          <div className="field">
            <span>PAN number *</span>
            <input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} maxLength={10} />
          </div>
          <div className="field">
            <span>GSTIN *</span>
            <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} disabled={noGst} maxLength={15} />
            <label className="checkbox-row" style={{ marginTop: 6 }}>
              <input type="checkbox" checked={noGst} onChange={() => setNoGst((v) => !v)} />
              I don't have a GSTIN
            </label>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, maxWidth: 640 }}>
        <h3 style={{ marginBottom: 4 }}>Identity</h3>
        <p className="tiny muted" style={{ marginBottom: 12 }}>Used to confirm you're a real, accountable person before payouts are enabled.</p>
        <div className="field" style={{ marginBottom: 12 }}>
          <span>Aadhaar number *</span>
          <input value={aadhaar} onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" />
        </div>
        <FileDropBox value={selfie} onChange={setSelfie} label="📷 capture or upload a selfie" doneLabel="✓ Selfie captured — click to replace" />
      </div>

      <div className="card" style={{ marginBottom: 16, maxWidth: 640 }}>
        <h3 style={{ marginBottom: 12 }}>Bank for payouts</h3>
        <div className="form-row">
          <div className="field">
            <span>Bank name *</span>
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. HDFC Bank" />
          </div>
          <div className="field">
            <span>Account holder's name *</span>
            <input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <span>Account number *</span>
            <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} inputMode="numeric" />
          </div>
          <div className="field">
            <span>IFSC code *</span>
            <input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase' }} />
          </div>
        </div>
      </div>

      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
      <div style={{ display: 'flex', gap: 10, maxWidth: 640 }}>
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>← Back</button>
        <button className="btn btn-pri btn-lg" style={{ flex: 1 }} disabled={!valid || submitting} onClick={submit}>
          {submitting ? 'Submitting…' : 'Submit for verification →'}
        </button>
      </div>
      <div className="tiny muted-2" style={{ marginTop: 10 }}>🔒 reviewed manually by our team · usually approved within 24h</div>
    </div>
  );
}
