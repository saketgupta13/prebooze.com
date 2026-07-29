import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { INTEREST_TAGS } from '../../data/mock';
import LocationPicker, { emptyLocation } from '../../components/LocationPicker';
import WysiwygEditor from '../../components/WysiwygEditor';
import { RealUploadBox } from '../../components/RealUploadBox';
import { auth } from '../../api';
import { ApiError } from '../../api/client';
import { SOCIAL_PLATFORMS, type SocialLinks } from '../../types';

/** First-touch guest profile step, right after signup. Used to only ever
 * save to local AppContext state (updateUser) — none of it reached the real
 * backend until a guest separately visited /profile/edit later. Now calls
 * the same real PATCH /me EditProfile.tsx uses, with a real photo upload
 * and the full location (not just city) actually persisted. */
export default function ProfileCompletion() {
  const { user, updateUser } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [form, setForm] = useState({
    name: user?.name ?? '',
    username: user?.username ?? '',
    dob: user?.dob ?? '',
    gender: user?.gender ?? '',
    email: user?.email ?? '',
    profession: user?.profession ?? '',
    languages: user?.languages ?? '',
    bio: user?.bio ?? '',
  });
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(user?.socialLinks ?? {});
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [loc, setLoc] = useState({ ...emptyLocation(), city: user?.city ?? '' });
  const [photo, setPhoto] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const pct = useMemo(() => {
    const fields = Object.values(form).filter((v) => v.trim()).length + (Object.values(socialLinks).some((v) => v?.trim()) ? 1 : 0);
    return Math.min(100, 20 + fields * 7 + (interests.length ? 8 : 0) + (photo ? 8 : 0));
  }, [form, socialLinks, interests, photo]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!photo) return setErr('A profile photo is required');
    if (!form.name.trim()) return setErr('Full name is required');
    if (!form.username.trim()) return setErr('Username is required');
    if (!form.dob) return setErr('Date of birth is required');
    if (!form.gender) return setErr('Gender is required');
    if (!EMAIL_RE.test(form.email.trim())) return setErr('A valid email is required');
    if (!loc.city.trim()) return setErr('City is required');
    if (!loc.state.trim()) return setErr('State is required');
    if (!loc.country.trim()) return setErr('Country is required');
    if (!form.profession.trim()) return setErr('Profession is required');
    if (!form.languages.trim()) return setErr('Languages is required');
    if (!form.bio.trim()) return setErr('Bio is required');
    if (!Object.values(socialLinks).some((v) => v?.trim())) return setErr('At least one social link is required');
    if (interests.length === 0) return setErr('Pick at least one interest');

    setSaving(true);
    try {
      const updated = await auth.updateMe({
        ...form,
        city: loc.city, state: loc.state, country: loc.country, pincode: loc.pincode,
        interests, avatarUrl: photo || undefined, socialLinks,
      });
      updateUser(updated);
      // ID verification is paused platform-wide for now (no live KYC vendor
      // key yet — see BACKEND.md "Identity & KYC") — this used to force
      // every new guest straight into that step; skip it and land wherever
      // they were headed instead. Booking itself was never gated on
      // idVerified, so this doesn't block ticket sales either way.
      navigate(from ?? '/');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 24 }}>Complete your profile</h1>
        <p className="muted small" style={{ marginTop: 4 }}>All fields are required — this is your one-time setup.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 22px' }}>
          <div className="progress" style={{ flex: 1 }}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <span className="small muted bold">{pct}% complete</span>
        </div>

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
              <span>Full name *</span>
              <input required value={form.name} onChange={set('name')} placeholder="Full name" />
            </div>
            <div className="field">
              <span>Username *</span>
              <input required value={form.username} onChange={set('username')} placeholder="@username" />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <span>Date of birth *</span>
              <input required type="date" value={form.dob} onChange={set('dob')} />
            </div>
            <div className="field">
              <span>Gender *</span>
              <select required value={form.gender} onChange={set('gender')}>
                <option value="">Select…</option>
                <option>Female</option>
                <option>Male</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            </div>
          </div>
          <div className="field">
            <span>Email *</span>
            <input required type="email" value={form.email} onChange={set('email')} placeholder="you@mail.com" />
          </div>
          <LocationPicker value={loc} onChange={setLoc} />
          <div className="form-row">
            <div className="field">
              <span>Profession *</span>
              <input required value={form.profession} onChange={set('profession')} placeholder="What do you do?" />
            </div>
            <div className="field">
              <span>Languages *</span>
              <input required value={form.languages} onChange={set('languages')} placeholder="English, Hindi…" />
            </div>
          </div>
          <div className="field">
            <span>Bio *</span>
            <WysiwygEditor value={form.bio} onChange={(html) => setForm((f) => ({ ...f, bio: html }))} minHeight={70} />
          </div>
          <div className="field">
            <span>Social links * (add at least one — as many as you like)</span>
            {/* Grid, not .form-row — .form-row switches to flex-direction:
                column on mobile, which turns a flex-basis meant as a MIN
                WIDTH into a min HEIGHT once the main axis is vertical,
                leaving each field 220px tall with a blank gap under it.
                A grid's column sizing doesn't depend on any ancestor's flex
                direction, so it's naturally correct at every width without
                needing a separate mobile override. */}
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
            {saving ? 'Saving…' : 'Save & continue →'}
          </button>
        </form>
      </div>
    </main>
  );
}
