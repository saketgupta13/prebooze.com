import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import LocationPicker, { emptyLocation } from '../components/LocationPicker';
import RoleTaken from '../components/RoleTaken';
import { existingRole } from '../lib/roles';

const CATEGORIES = ['Artist', 'DJ', 'Band', 'Comedian', 'Sponsor', 'Promoter', 'Host'];

/** Line-up onboarding — same 2-step pattern as organizer onboarding:
 * 1 · stage profile → 2 · identity verification → profile goes live after review. */
export default function LineupOnboarding() {
  const { user, updateUser } = useApp();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — stage profile
  const [photo, setPhoto] = useState(false);
  const [stageName, setStageName] = useState('');
  const [category, setCategory] = useState('DJ');
  const [city, setCity] = useState(user?.city ?? '');
  const [loc, setLoc] = useState(emptyLocation);
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState('');
  const [sample, setSample] = useState('');

  // Step 2 — verification
  const [idDoc, setIdDoc] = useState(false);
  const [selfie, setSelfie] = useState(false);
  const [done, setDone] = useState(false);

  // Same WhatsApp OTP login as guests — then this instead of the guest profile
  if (!user) return <Navigate to="/login" state={{ from: '/lineup/onboarding' }} replace />;
  const otherRole = existingRole(user);
  if (otherRole && otherRole !== 'lineup') return <RoleTaken has={otherRole} />;

  const step1Valid = stageName.trim() && bio.trim();
  const pct = done ? 100 : step === 1 ? 50 : 90;

  const submit = () => {
    const slug = stageName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    updateUser({ isLineup: true, lineupName: stageName.trim(), lineupCategory: category, lineupUsername: slug, city });
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
            <div className="kv"><span className="k">Profile</span><span>{stageName} · {category} · {city}</span></div>
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
            <div
              className={`upload-box ${photo ? 'done' : ''}`}
              onClick={() => setPhoto((p) => !p)}
              style={{ marginBottom: 16 }}
            >
              {photo ? '✓ Profile photo added' : '📷 photo + — Add a press shot — it headlines your profile and event chips'}
            </div>
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
            <LocationPicker value={loc} onChange={(v) => { setLoc(v); setCity(v.city); }} />
            <div className="field">
              <span>Links (socials / music)</span>
              <input value={links} onChange={(e) => setLinks(e.target.value)} placeholder="ig / spotify / soundcloud" />
            </div>
            <div className="field">
              <span>Bio — what do you play / do?</span>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Two lines that make a booker say yes…" />
            </div>
            <div className="field">
              <span>Sample set / showreel link (optional)</span>
              <input value={sample} onChange={(e) => setSample(e.target.value)} placeholder="youtube / soundcloud link" />
            </div>
            <button className="btn btn-pri btn-block btn-lg" disabled={!step1Valid}>
              Save & continue → verification
            </button>
          </form>
        ) : (
          <div>
            <p className="muted small" style={{ marginBottom: 16 }}>
              Verified line-ups get the <span className="verified">✓</span> badge, show higher in
              search, and organizers book them faster.
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
