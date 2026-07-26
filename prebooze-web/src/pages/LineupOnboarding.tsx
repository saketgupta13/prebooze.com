import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import LocationPicker, { emptyLocation, type LocationValue } from '../components/LocationPicker';
import RoleTaken from '../components/RoleTaken';
import { existingRole } from '../lib/roles';
import { loadDraft, saveDraft, clearDraft } from '../lib/formDraft';
import WysiwygEditor from '../components/WysiwygEditor';
import { FileDropBox } from '../components/FileDropBox';

const CATEGORIES = ['Artist', 'DJ', 'Band', 'Comedian', 'Sponsor', 'Promoter', 'Host'];
const DRAFT_ID = 'lineup';
type Draft = {
  photo: string; stageName: string; category: string; loc: LocationValue; bio: string; links: string;
  sample: string; idDoc: string; selfie: string;
};
const emptyDraft: Draft = {
  photo: '', stageName: '', category: 'DJ', loc: emptyLocation(), bio: '', links: '', sample: '',
  idDoc: '', selfie: '',
};

/** Line-up onboarding — same 2-step pattern as organizer onboarding:
 * 1 · stage profile → 2 · identity verification → profile goes live after review. */
export default function LineupOnboarding() {
  const { user, submitRoleApplication } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — stage profile
  const draft0 = loadDraft(DRAFT_ID, emptyDraft);
  const [photo, setPhoto] = useState(draft0.photo);
  const [stageName, setStageName] = useState(draft0.stageName);
  const [category, setCategory] = useState(draft0.category);
  const [loc, setLoc] = useState(draft0.loc);
  const [bio, setBio] = useState(draft0.bio);
  const [links, setLinks] = useState(draft0.links);
  const [sample, setSample] = useState(draft0.sample);

  // Step 2 — verification
  const [idDoc, setIdDoc] = useState(draft0.idDoc);
  const [selfie, setSelfie] = useState(draft0.selfie);
  const [done, setDone] = useState(false);

  useEffect(() => {
    saveDraft(DRAFT_ID, { photo, stageName, category, loc, bio, links, sample, idDoc, selfie });
  }, [photo, stageName, category, loc, bio, links, sample, idDoc, selfie]);

  // Same WhatsApp OTP login as guests — then this instead of the guest profile
  if (!user) return <Navigate to="/login" state={{ from: '/lineup/onboarding' }} replace />;
  const otherRole = existingRole(user);
  if (otherRole && otherRole !== 'lineup') return <RoleTaken has={otherRole} />;

  const step1Valid = stageName.trim() && bio.trim();
  const pct = done ? 100 : step === 1 ? 50 : 90;

  const submit = () => {
    const slug = stageName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    submitRoleApplication('lineup', { lineupName: stageName.trim(), lineupCategory: category, lineupUsername: slug, city: loc.city });
    clearDraft(DRAFT_ID);
    setDone(true);
  };

  if (done) {
    return (
      <main className="page">
        <div className="container confirm-hero">
          <div className="confirm-tick">✓</div>
          <h1 style={{ fontSize: 26 }}>You're on the roster! 🎤</h1>
          <p className="muted" style={{ margin: '8px 0 22px' }}>
            <b style={{ color: 'var(--text)' }}>{stageName}</b> ({category}) is submitted for review.
            Once approved, your profile goes live, organizers can add you to line-ups, and guests can
            follow you.
          </p>
          <div className="card" style={{ textAlign: 'left', marginBottom: 18 }}>
            <div className="kv"><span className="k">Profile</span><span>{stageName} · {category} · {loc.city}</span></div>
            <div className="kv"><span className="k">Status</span><span className="badge badge-pending">Pending review ◌ · ~24h</span></div>
            <div className="kv"><span className="k">Next</span><span>we WhatsApp you when you're live</span></div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/lineup/dj-nova" className="btn btn-ghost">See an example profile</Link>
            <Link to="/" className="btn btn-pri">Back to home</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ fontSize: 24 }}>
            {step === 1 ? 'Set up your line-up profile' : 'Verify your identity'}
          </h1>
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
            <FileDropBox
              value={photo}
              onChange={setPhoto}
              label="📷 photo + — Add a press shot — it headlines your profile and event chips"
              doneLabel="✓ Profile photo added — click to replace"
              style={{ marginBottom: 16 }}
            />
            <div className="field">
              <span>Stage / brand name</span>
              <input value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="e.g. DJ Nova" autoFocus />
            </div>
            <div className="field">
              <span>Line-up category</span>
              <div className="chip-row">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button" className={`chip ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>
                    {c}{category === c ? ' ✓' : ''}
                  </button>
                ))}
              </div>
            </div>
            <LocationPicker value={loc} onChange={setLoc} />
            <div className="field">
              <span>Links (socials / music)</span>
              <input value={links} onChange={(e) => setLinks(e.target.value)} placeholder="ig / spotify / soundcloud" />
            </div>
            <div className="field">
              <span>Bio — what do you play / do?</span>
              <WysiwygEditor value={bio} onChange={setBio} minHeight={80} />
            </div>
            <div className="field">
              <span>Sample set / showreel link (optional)</span>
              <input value={sample} onChange={(e) => setSample(e.target.value)} placeholder="youtube / soundcloud link" />
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
              Verified line-ups get the <span className="verified">✓</span> badge, show higher in
              search, and organizers book them faster.
            </p>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>1 · Government ID</h3>
              <FileDropBox value={idDoc} onChange={setIdDoc} label="⬆ upload Aadhaar / passport front" doneLabel="✓ ID uploaded — click to replace" />
            </div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>2 · Selfie match</h3>
              <FileDropBox
                value={selfie}
                onChange={setSelfie}
                label="🤳 camera frame — face in oval · 📷 Capture selfie"
                doneLabel="✓ Selfie captured — click to replace"
                style={{ padding: selfie ? undefined : 30 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-pri btn-lg" style={{ flex: 1 }} disabled={!idDoc || !selfie} onClick={submit}>
                Submit for review 🎤
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
