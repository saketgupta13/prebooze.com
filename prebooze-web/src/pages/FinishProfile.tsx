import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { INTEREST_TAGS } from '../data/mock';
import LocationPicker, { emptyLocation } from '../components/LocationPicker';
import WysiwygEditor from '../components/WysiwygEditor';
import { RealUploadBox } from '../components/RealUploadBox';
import { auth } from '../api';
import { ApiError } from '../api/client';
import { SOCIAL_PLATFORMS, type SocialLinks } from '../types';
import { ageFromDob } from '../lib/ageGate';

/** Soft-required "finish your profile" step — everything ProfileCompletion.tsx
 * used to force before a guest's first booking, moved here instead. Getting
 * to this page (a dismissible nudge, see Confirmation.tsx/Profile.tsx) and
 * leaving it are both entirely optional; the fields *within* it are still
 * required once someone actually opens it and hits Save, same validation the
 * old mandatory gate had. Completing it awards a one-time 10%-off coupon —
 * see AuthService.claimProfileCompletionReward. */
export default function FinishProfile() {
  const { user, updateUser } = useApp();
  const navigate = useNavigate();

  const [name] = useState(user?.name ?? '');
  const [dob, setDob] = useState(user?.dob ?? '');
  const [gender, setGender] = useState(user?.gender ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [profession, setProfession] = useState(user?.profession ?? '');
  const [languages, setLanguages] = useState(user?.languages ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(user?.socialLinks ?? {});
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [loc, setLoc] = useState({ ...emptyLocation(), city: user?.city ?? '', state: user?.state ?? '', pincode: user?.pincode ?? '' });
  const [photo, setPhoto] = useState(user?.avatarUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [reward, setReward] = useState<{ code: string; maxDiscount: number; validTill: string } | null>(null);

  if (!user) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!photo) return setErr('A profile photo is required');
    if (!dob.trim()) return setErr('Date of birth is required');
    if (!gender) return setErr('Gender is required');
    if (!username.trim()) return setErr('Username is required');
    if (!loc.city.trim()) return setErr('City is required');
    if (!loc.state.trim()) return setErr('State is required');
    if (!loc.country.trim()) return setErr('Country is required');
    if (!profession.trim()) return setErr('Profession is required');
    if (!languages.trim()) return setErr('Languages is required');
    if (!bio.trim()) return setErr('Bio is required');
    if (!Object.values(socialLinks).some((v) => v?.trim())) return setErr('At least one social link is required');
    if (interests.length === 0) return setErr('Pick at least one interest');

    setSaving(true);
    try {
      const updated = await auth.updateMe({
        dob: dob.trim(), gender,
        username: username.trim(), profession: profession.trim(), languages: languages.trim(), bio: bio.trim(),
        city: loc.city, state: loc.state, country: loc.country, pincode: loc.pincode,
        interests, avatarUrl: photo, socialLinks,
      });
      updateUser(updated);
      const claimed = await auth.claimProfileReward();
      updateUser({ profileRewardClaimedAt: new Date().toISOString(), profileRewardCode: claimed.code });
      setReward(claimed);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (reward || user.profileRewardClaimedAt) {
    const code = reward?.code ?? user.profileRewardCode ?? '';
    const validTill = reward ? new Date(reward.validTill).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : undefined;
    return (
      <main className="page">
        <div className="container center" style={{ maxWidth: 480, padding: '60px 0' }}>
          <h1 style={{ fontSize: 24 }}>🎉 Profile complete!</h1>
          <p className="muted small" style={{ marginTop: 6 }}>
            Here's 10% off (up to ₹100) your next booking{validTill ? ` — valid until ${validTill}` : ''}:
          </p>
          <div
            className="card"
            style={{ margin: '18px 0', padding: '18px', fontSize: 22, fontWeight: 800, letterSpacing: 1, borderColor: 'var(--accent)' }}
          >
            {code}
          </div>
          <p className="tiny muted-2">One-time use — apply it at checkout on your next booking. We've also sent it to you on WhatsApp{user.email ? ' and email' : ''}.</p>
          <button className="btn btn-pri" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
            Explore events →
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ fontSize: 24 }}>Complete your profile</h1>
          <Link to="/" className="link small">Maybe later</Link>
        </div>
        <p className="muted small" style={{ margin: '4px 0 16px' }}>
          Finish these and get 10% off (up to ₹100) your next booking — one-time code, valid for 15 days.
        </p>

        {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}

        <form className="card" onSubmit={save}>
          <RealUploadBox
            value={photo}
            onChange={setPhoto}
            upload={auth.upload}
            label="📷 photo + — Add a profile picture — it appears on your tickets and reviews"
            doneLabel="✓ Photo added — click to replace"
            style={{ marginBottom: 16, height: 120 }}
          />

          <div className="form-row">
            <div className="field">
              <span>Full name</span>
              <input value={name} disabled />
            </div>
            <div className="field">
              <span>Username *</span>
              <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <span>Date of birth *</span>
              <input required type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              {dob.trim() && ageFromDob(dob.trim()) != null && (
                <div className="tiny muted" style={{ marginTop: 4 }}>Age {ageFromDob(dob.trim())}</div>
              )}
            </div>
            <div className="field">
              <span>Gender *</span>
              <select required value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Select…</option>
                <option>Female</option>
                <option>Male</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            </div>
          </div>
          <LocationPicker value={loc} onChange={setLoc} />
          <div className="form-row">
            <div className="field">
              <span>Profession *</span>
              <input required value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="What do you do?" />
            </div>
            <div className="field">
              <span>Languages *</span>
              <input required value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Hindi…" />
            </div>
          </div>
          <div className="field">
            <span>Bio *</span>
            <WysiwygEditor value={bio} onChange={setBio} minHeight={70} />
          </div>
          <div className="field">
            <span>Social links * (add at least one — as many as you like)</span>
            {/* Grid, not .form-row — see the identical note in EditProfile.tsx's copy of this same field. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {SOCIAL_PLATFORMS.map((p) => (
                <div className="field" key={p.key}>
                  <span className="tiny muted-2">{p.label}</span>
                  <input
                    value={socialLinks[p.key] ?? ''}
                    onChange={(e) => setSocialLinks((s) => ({ ...s, [p.key]: e.target.value }))}
                    placeholder={p.placeholder}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="field">
            <span>Interests * (pick at least one)</span>
            <div className="chip-row">
              {INTEREST_TAGS.map((t) => (
                <button
                  type="button"
                  key={t}
                  className={`chip ${interests.includes(t) ? 'on' : ''}`}
                  onClick={() =>
                    setInterests((prev) =>
                      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                    )
                  }
                >
                  {t}
                  {interests.includes(t) ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-pri btn-block btn-lg" style={{ marginTop: 8 }} disabled={saving}>
            {saving ? 'Saving…' : 'Save & claim my 10% off →'}
          </button>
        </form>
      </div>
    </main>
  );
}
