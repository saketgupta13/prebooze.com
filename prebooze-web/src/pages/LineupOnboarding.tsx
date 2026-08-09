import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import LocationPicker, { emptyLocation, type LocationValue } from '../components/LocationPicker';
import RoleTaken from '../components/RoleTaken';
import { existingRole } from '../lib/roles';
import { loadDraft, saveDraft, clearDraft } from '../lib/formDraft';
import WysiwygEditor from '../components/WysiwygEditor';
import { RealUploadBox } from '../components/RealUploadBox';
import { kyc, lineup as lineupApi } from '../api';
import { isBackendEnabled, ApiError } from '../api/client';
import { pushEvent } from '../lib/gtm';

const CATEGORIES = ['Artist', 'DJ', 'Band', 'Comedian', 'Sponsor', 'Promoter', 'Host'];
const DRAFT_ID = 'lineup';
// Deliberately excludes the press-shot logo — it's a real upload now (see
// RealUploadBox below), so it round-trips through the backend, not
// localStorage, the same reasoning organizer/Onboarding.tsx's draft gives
// for excluding logo/aadhaar/selfie.
type Draft = { stageName: string; username: string; category: string; loc: LocationValue; bio: string; links: string[] };
const emptyDraft: Draft = { stageName: '', username: '', category: 'DJ', loc: emptyLocation(), bio: '', links: [''] };

/** Line-up onboarding — single-step submission straight to manual admin
 * review. No ID-doc/selfie step: unlike organizer/promoter/venue, line-ups
 * never touch payouts (no bank fields on the Lineup model at all), so the
 * guest-style identity-verification step that used to live here as step 2
 * didn't apply and has been removed — a stage profile is all a reviewer
 * needs to approve a directory listing. */
export default function LineupOnboarding() {
  const { user, submitRoleApplication, updateUser } = useApp();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const draft0 = loadDraft(DRAFT_ID, emptyDraft);
  const [logoUrl, setLogoUrl] = useState('');
  const [stageName, setStageName] = useState(draft0.stageName);
  const [username, setUsername] = useState(user?.lineupUsername || draft0.username);
  const [category, setCategory] = useState(draft0.category);
  const [loc, setLoc] = useState(draft0.loc);
  const [bio, setBio] = useState(draft0.bio);
  const [links, setLinks] = useState<string[]>(draft0.links.length ? draft0.links : ['']);
  const [done, setDone] = useState(false);

  useEffect(() => {
    saveDraft(DRAFT_ID, { stageName, username, category, loc, bio, links });
  }, [stageName, username, category, loc, bio, links]);

  const setLink = (i: number, v: string) => setLinks((prev) => prev.map((l, idx) => (idx === i ? v : l)));
  const addLink = () => setLinks((prev) => [...prev, '']);
  const removeLink = (i: number) => setLinks((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : ['']));

  // Same WhatsApp OTP login as guests — then this instead of the guest profile
  if (!user) return <Navigate to="/login" state={{ from: '/lineup/onboarding' }} replace />;
  const otherRole = existingRole(user);
  if (otherRole && otherRole !== 'lineup') return <RoleTaken has={otherRole} />;

  const step1Valid = stageName.trim() && username.trim() && bio.trim();
  const pct = done ? 100 : 70;

  const submit = async () => {
    if (!isBackendEnabled()) {
      const slug = username.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      submitRoleApplication('lineup', { lineupName: stageName.trim(), lineupCategory: category, lineupUsername: slug, city: loc.city });
      clearDraft(DRAFT_ID);
      setDone(true);
      return;
    }
    setErr('');
    setSubmitting(true);
    try {
      const payload = {
        name: stageName.trim(), category, username: username.trim(),
        city: loc.city, state: loc.state, country: loc.country, pincode: loc.pincode,
        bio, links: links.map((l) => l.trim()).filter(Boolean), logoUrl: logoUrl || undefined,
      };
      const res = await kyc.submitRole('lineup', payload, []);
      updateUser({ ...res.user, pendingRole: 'lineup' });
      pushEvent('lineup_onboarding_submitted');
      clearDraft(DRAFT_ID);
      setDone(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to submit — try again');
    } finally {
      setSubmitting(false);
    }
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
          <h1 style={{ fontSize: 24 }}>Set up your line-up profile</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 22px' }}>
          <div className="progress" style={{ flex: 1 }}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <span className="small muted bold">{pct}%</span>
        </div>

        {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}

        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            if (step1Valid) submit();
          }}
        >
          <RealUploadBox
            value={logoUrl}
            onChange={setLogoUrl}
            upload={lineupApi.upload}
            label="📷 photo + — Add a press shot — it headlines your profile and event chips"
            doneLabel="✓ Profile photo added — click to replace"
            style={{ marginBottom: 16, height: 120 }}
          />
          <div className="field">
            <span>Stage / brand name</span>
            <input value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="e.g. DJ Nova" autoFocus />
          </div>
          <div className="field">
            <span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. dj-nova — your profile URL" />
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {links.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 6 }}>
                  <input
                    style={{ flex: 1 }}
                    value={l}
                    onChange={(e) => setLink(i, e.target.value)}
                    placeholder={i === 0 ? 'instagram.com/you, spotify, soundcloud…' : 'Another link'}
                  />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeLink(i)} title="Remove">✕</button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addLink}>+ Add another link</button>
            </div>
          </div>
          <div className="field">
            <span>Bio — what do you play / do?</span>
            <WysiwygEditor value={bio} onChange={setBio} minHeight={80} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <button className="btn btn-pri btn-lg" style={{ flex: 1 }} disabled={!step1Valid || submitting}>
              {submitting ? 'Submitting…' : 'Submit for review 🎤'}
            </button>
          </div>
          <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
            🔒 reviewed by admin · usually approved within 24h
          </div>
        </form>
      </div>
    </main>
  );
}
