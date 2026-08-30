import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { lineup, kyc } from '../../api';
import { ApiError } from '../../api/client';
import { FileDropBox } from '../../components/FileDropBox';
import { dataUrlToFile } from '../../lib/fileUtils';
import Loader from '../../components/Loader';
import type { LineupProfile } from '../../types';
import { CheckCircle2, ShieldCheck, ArrowLeft, ArrowRight, IdCard, Camera, X, Lock } from 'lucide-react';

/** Self-serve *identity* verification — badge-only, genuinely new for
 * line-ups (they never had one before, since they don't touch payouts).
 * Same guest-style ID + selfie check as promoter's, purely a badge — never
 * blocks booking or profile visibility. Submits into the same admin
 * Verifications queue every other role's KYC already goes through — see
 * KycService.submitLineupVerification / approve(). */
export default function LineupVerification() {
  const navigate = useNavigate();
  const [me, setMe] = useState<LineupProfile | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const [idDoc, setIdDoc] = useState('');
  const [selfie, setSelfie] = useState('');

  useEffect(() => {
    Promise.all([lineup.me(), kyc.myStatus()])
      .then(([m, submissions]) => {
        setMe(m);
        setPending(submissions.some((s) => s.kind === 'lineup' && s.status === 'pending'));
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const valid = !!idDoc && !!selfie;

  const submit = async () => {
    setErr('');
    setSubmitting(true);
    try {
      const docs = await Promise.all([idDoc, selfie].map((d, i) => dataUrlToFile(d, i === 0 ? 'id.jpg' : 'selfie.jpg')));
      await kyc.submitLineupVerification(docs);
      setDone(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to submit — try again');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />;
  if (!me) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err || 'Failed to load'}</div>;

  if (me.verified) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="bold" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>You're verified <span className="verified" style={{ display: 'inline-flex' }}><CheckCircle2 size={16} /></span></div>
        <p className="muted small">Your identity has been verified.</p>
        <Link to="/artist/profile" className="link small bold" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10 }}><ArrowLeft size={14} /> Back to Settings</Link>
      </div>
    );
  }

  if (pending || done) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="bold" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={17} /> Verification under review</div>
        <p className="muted small">
          We've got your details — our team usually reviews within 24h. You'll get a WhatsApp/email once you're verified.
        </p>
        <Link to="/artist/profile" className="link small bold" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10 }}><ArrowLeft size={14} /> Back to Settings</Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24, marginBottom: 6 }}>Complete verification</h1>
        <Link to="/artist/profile" className="link small bold" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={14} /> Back to Settings</Link>
      </div>
      <p className="muted small" style={{ marginBottom: 18 }}>
        Identity verification only — gets you the <span className="verified" style={{ display: 'inline-flex', verticalAlign: 'middle' }}><CheckCircle2 size={13} /></span> verified badge. Doesn't affect
        your profile being live or bookable.
      </p>

      <div className="card" style={{ marginBottom: 16, maxWidth: 640 }}>
        <h3 style={{ marginBottom: 4 }}>Documents</h3>
        <p className="tiny muted" style={{ marginBottom: 12 }}>
          We don't have a way to validate these automatically — a real person on our team reviews them.
        </p>
        <FileDropBox value={idDoc} onChange={setIdDoc} accept="image/*,.pdf" label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IdCard size={15} /> Upload Aadhaar / passport front</span>} doneLabel={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={15} /> ID uploaded — click to replace</span>} style={{ marginBottom: 12 }} />
        <FileDropBox
          value={selfie}
          onChange={setSelfie}
          label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Camera size={15} /> capture or upload a selfie</span>}
          doneLabel={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={15} /> Selfie captured — click to replace</span>}
        />
      </div>

      {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><X size={14} /> {err}</div>}
      <div style={{ display: 'flex', gap: 10, maxWidth: 640 }}>
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={15} /> Back</button>
        <button className="btn btn-pri btn-lg" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} disabled={!valid || submitting} onClick={submit}>
          {submitting ? 'Submitting…' : <>Submit for verification <ArrowRight size={16} /></>}
        </button>
      </div>
      <div className="tiny muted-2" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}><Lock size={12} /> reviewed manually by our team · usually approved within 24h</div>
    </div>
  );
}
