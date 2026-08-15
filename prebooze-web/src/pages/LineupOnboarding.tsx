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
import { trackMeta } from '../lib/meta';
import { useDraftLead } from '../lib/useDraftLead';

const CATEGORIES = ['Artist', 'DJ', 'Band', 'Comedian', 'Sponsor', 'Promoter', 'Host'];
const DRAFT_ID = 'lineup';
// Deliberately excludes the press-shot logo — it's a real upload now (see
// RealUploadBox below), so it round-trips through the backend, not
// localStorage, the same reasoning organizer/Onboarding.tsx's draft gives
// for excluding logo/aadhaar/selfie.
type Draft = { stageName: string; category: string; loc: LocationValue; bio: string; links: string[] };
const emptyDraft: Draft = { stageName: '', category: 'DJ', loc: emptyLocation(), bio: '', links: [''] };

/** Line-up onboarding — self-serve, minimal, single-step, same pattern as
 * organizer's Onboarding.tsx: a stage profile is live and bookable the
 * moment this is submitted, no admin review. Username is auto-derived from
 * the stage name server-side (KycService.quickSignupLineup), not typed
 * here. Identity verification is now available as a separate, optional,
 * self-serve step too (LineupVerification.tsx, from lineup Settings) — a
 * genuinely new capability, since line-ups never touch payouts and never
 * had one before; it's purely a badge, same as every other role's. */
export default function LineupOnboarding() {
  const { user, submitRoleApplication, updateUser } = useApp();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const draft0 = loadDraft(DRAFT_ID, emptyDraft);
  const [logoUrl, setLogoUrl] = useState('');
  const [stageName, setStageName] = useState(draft0.stageName);
  const [category, setCategory] = useState(draft0.category);
  const [loc, setLoc] = useState(draft0.loc);
  const [bio, setBio] = useState(draft0.bio);
  const [links, setLinks] = useState<string[]>(draft0.links.length ? draft0.links : ['']);
  const [done, setDone] = useState(false);

  useEffect(() => {
    saveDraft(DRAFT_ID, { stageName, category, loc, bio, links });
  }, [stageName, category, loc, bio, links]);

  useDraftLead('lineup', stageName, { city: loc.city, eventType: category });

  const setLink = (i: number, v: string) => setLinks((prev) => prev.map((l, idx) => (idx === i ? v : l)));
  const addLink = () => setLinks((prev) => [...prev, '']);
  const removeLink = (i: number) => setLinks((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : ['']));

  // Same WhatsApp OTP login as guests — then this instead of the guest profile
  if (!user) return <Navigate to="/login" state={{ from: '/lineup/onboarding' }} replace />;
  const otherRole = existingRole(user);
  if (otherRole && otherRole !== 'lineup') return <RoleTaken has={otherRole} />;

  const step1Valid = stageName.trim() && bio.trim();
  const pct = done ? 100 : 80;

  const submit = async () => {
    if (!isBackendEnabled()) {
      const slug = stageName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      submitRoleApplication('lineup', { lineupName: stageName.trim(), lineupCategory: category, lineupUsername: slug, city: loc.city });
      clearDraft(DRAFT_ID);
      setDone(true);
      return;
    }
    setErr('');
    setSubmitting(true);
    try {
      const res = await kyc.quickSignupLineup({
        name: stageName.trim(), category,
        city: loc.city, state: loc.state, country: loc.country, pincode: loc.pincode,
        bio, links: links.map((l) => l.trim()).filter(Boolean), logoUrl: logoUrl || undefined,
      });
      updateUser(res.user);
      pushEvent('lineup_onboarding_submitted');
      // eventId must match kyc.service.ts's quickSignupLineup server-side call.
      trackMeta('Lead', { content_name: 'lineup_onboarding' }, `${user?.phone}_lineup`);
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
            <b style={{ color: 'var(--text)' }}>{stageName}</b> ({category}) is live right now — organizers can
            already add you to line-ups, and guests can follow you. Add the verified{' '}
            <span className="verified">✓</span> badge whenever you're ready, from Settings.
          </p>
          <div className="card" style={{ textAlign: 'left', marginBottom: 18 }}>
            <div className="kv"><span className="k">Profile</span><span>{stageName} · {category} · {loc.city}</span></div>
            <div className="kv"><span className="k">Status</span><span className="badge badge-ok">Live ✓</span></div>
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
              {submitting ? 'Setting up…' : 'Join the roster →'}
            </button>
          </div>
          <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
            live immediately · add the verified badge later from Settings, whenever you're ready
          </div>
        </form>
      </div>
    </main>
  );
}
