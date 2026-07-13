import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import LocationPicker, { emptyLocation } from '../../components/LocationPicker';

/** Promoter onboarding — same 2-step pattern as organizers: PR profile → identity KYC,
 * then Pending admin review. */
export default function PromoterOnboarding() {
  const { user, updateUser } = useApp();
  const [step, setStep] = useState<1 | 2>(1);

  const [logo, setLogo] = useState(false);
  const [brand, setBrand] = useState('');
  const [username, setUsername] = useState('');
  const [city, setCity] = useState(user?.city ?? '');
  const [loc, setLoc] = useState(emptyLocation);
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState('');
  const [audience, setAudience] = useState('');

  const [idDoc, setIdDoc] = useState(false);
  const [selfie, setSelfie] = useState(false);
  const [done, setDone] = useState(false);

  if (!user) return <Navigate to="/login" state={{ from: '/promoter/onboarding' }} replace />;

  const step1Valid = brand.trim() && username.trim() && bio.trim();
  const pct = done ? 100 : step === 1 ? 50 : 90;

  const submit = () => {
    updateUser({ isPromoter: true, promoterBrand: brand.trim(), promoterUsername: username.trim(), promoterPlan: 'free' });
    setDone(true);
  };

  if (done) {
    return (
      <main className="page">
        <div className="container confirm-hero">
          <div className="confirm-tick">✓</div>
          <h1 style={{ fontSize: 26 }}>You're a Prebooze promoter! 📣</h1>
          <p className="muted" style={{ margin: '8px 0 22px' }}>
            <b style={{ color: 'var(--text)' }}>{brand}</b> is submitted for review. Once approved, organizers
            can invite you to promote their events, you'll get affiliate links and free-entry guest lists, and
            guests can follow you.
          </p>
          <div className="card" style={{ textAlign: 'left', marginBottom: 18 }}>
            <div className="kv"><span className="k">Profile</span><span>{brand} · {city}</span></div>
            <div className="kv"><span className="k">Plan</span><span>Free · 25 guests / month</span></div>
            <div className="kv"><span className="k">Status</span><span className="badge badge-pending">Pending review ◌ · ~24h</span></div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/promoter" className="btn btn-pri">Go to my dashboard →</Link>
            <Link to="/promoter/nova-nights" className="btn btn-ghost">See an example profile</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ fontSize: 24 }}>{step === 1 ? 'Set up your promoter profile' : 'Verify your identity'}</h1>
          <span className="muted small bold">step {step} of 2</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 22px' }}>
          <div className="progress" style={{ flex: 1 }}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <span className="small muted bold">{pct}%</span>
        </div>

        {step === 1 ? (
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              if (step1Valid) setStep(2);
            }}
          >
            <div className={`upload-box ${logo ? 'done' : ''}`} onClick={() => setLogo((v) => !v)} style={{ marginBottom: 16 }}>
              {logo ? '✓ Logo / photo added' : '📷 logo + — a mark guests recognise on your lists and links'}
            </div>
            <div className="form-row">
              <div className="field">
                <span>Promoter / brand name</span>
                <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Nova Nights" autoFocus />
              </div>
              <div className="field">
                <span>Username</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@novanights" />
              </div>
            </div>
            <LocationPicker value={loc} onChange={(v) => { setLoc(v); setCity(v.city); }} />
            <div className="field">
              <span>Links (socials / WhatsApp)</span>
              <input value={links} onChange={(e) => setLinks(e.target.value)} placeholder="ig / wa / telegram" />
            </div>
            <div className="field">
              <span>Bio — what nights do you run?</span>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Rooftops, warehouses, free before 1 AM…" />
            </div>
            <div className="field">
              <span>Audience size / reach (optional)</span>
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. 8k on Instagram, 2k WhatsApp broadcast" />
            </div>
            <button className="btn btn-pri btn-block btn-lg" disabled={!step1Valid}>
              Save & continue → verification
            </button>
          </form>
        ) : (
          <div>
            <p className="muted small" style={{ marginBottom: 16 }}>
              Verified promoters get the <span className="verified">✓</span> badge and organizers approve them
              faster. KYC keeps fake guest lists off the platform.
            </p>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>1 · Government ID</h3>
              <div className={`upload-box ${idDoc ? 'done' : ''}`} onClick={() => setIdDoc((v) => !v)}>
                {idDoc ? '✓ ID uploaded · verified' : '⬆ upload Aadhaar / passport front'}
              </div>
            </div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>2 · Selfie match</h3>
              <div className={`upload-box ${selfie ? 'done' : ''}`} onClick={() => setSelfie((v) => !v)} style={{ padding: 30 }}>
                {selfie ? '✓ Selfie captured — matched' : '🤳 camera frame — face in oval · 📷 Capture selfie'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-pri btn-lg" style={{ flex: 1 }} disabled={!idDoc || !selfie} onClick={submit}>
                Submit for review 📣
              </button>
            </div>
            <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
              🔒 encrypted · reviewed by admin · usually approved within 24h
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
