import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import LocationPicker, { emptyLocation, type LocationValue } from '../../components/LocationPicker';
import RoleTaken from '../../components/RoleTaken';
import { existingRole } from '../../lib/roles';
import { loadDraft, saveDraft, clearDraft } from '../../lib/formDraft';
import WysiwygEditor from '../../components/WysiwygEditor';

const DRAFT_ID = 'promoter';
type Draft = {
  logo: boolean; brand: string; username: string; loc: LocationValue; bio: string; links: string;
  audience: string; idDoc: boolean; selfie: boolean;
};
const emptyDraft: Draft = {
  logo: false, brand: '', username: '', loc: emptyLocation(), bio: '', links: '', audience: '',
  idDoc: false, selfie: false,
};

/** Promoter onboarding — same 2-step pattern as organizers: PR profile → identity KYC,
 * then Pending admin review. */
export default function PromoterOnboarding() {
  const { user, submitRoleApplication } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  const draft0 = loadDraft(DRAFT_ID, emptyDraft);
  const [logo, setLogo] = useState(draft0.logo);
  const [brand, setBrand] = useState(draft0.brand);
  const [username, setUsername] = useState(draft0.username);
  const [loc, setLoc] = useState(draft0.loc);
  const [bio, setBio] = useState(draft0.bio);
  const [links, setLinks] = useState(draft0.links);
  const [audience, setAudience] = useState(draft0.audience);

  const [idDoc, setIdDoc] = useState(draft0.idDoc);
  const [selfie, setSelfie] = useState(draft0.selfie);
  const [done, setDone] = useState(false);

  useEffect(() => {
    saveDraft(DRAFT_ID, { logo, brand, username, loc, bio, links, audience, idDoc, selfie });
  }, [logo, brand, username, loc, bio, links, audience, idDoc, selfie]);

  if (!user) return <Navigate to="/login" state={{ from: '/promoter/onboarding' }} replace />;
  const otherRole = existingRole(user);
  if (otherRole && otherRole !== 'promoter') return <RoleTaken has={otherRole} />;

  const step1Valid = brand.trim() && username.trim() && bio.trim();
  const pct = done ? 100 : step === 1 ? 50 : 90;

  const submit = () => {
    submitRoleApplication('promoter', { promoterBrand: brand.trim(), promoterUsername: username.trim(), promoterPlan: 'free' });
    clearDraft(DRAFT_ID);
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
            <div className="kv"><span className="k">Profile</span><span>{brand} · {loc.city}</span></div>
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
            <LocationPicker value={loc} onChange={setLoc} />
            <div className="field">
              <span>Links (socials / WhatsApp)</span>
              <input value={links} onChange={(e) => setLinks(e.target.value)} placeholder="ig / wa / telegram" />
            </div>
            <div className="field">
              <span>Bio — what nights do you run?</span>
              <WysiwygEditor value={bio} onChange={setBio} minHeight={80} />
            </div>
            <div className="field">
              <span>Audience size / reach (optional)</span>
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. 8k on Instagram, 2k WhatsApp broadcast" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
                ← Back
              </button>
              <button className="btn btn-pri btn-lg" style={{ flex: 1 }} disabled={!step1Valid}>
                Save & continue → verification
              </button>
            </div>
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
                {idDoc ? '✓ ID uploaded' : '⬆ upload Aadhaar / passport front'}
              </div>
            </div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>2 · Selfie match</h3>
              <div className={`upload-box ${selfie ? 'done' : ''}`} onClick={() => setSelfie((v) => !v)} style={{ padding: 30 }}>
                {selfie ? '✓ Selfie captured' : '🤳 camera frame — face in oval · 📷 Capture selfie'}
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
