import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { INTEREST_TAGS } from '../data/mock';
import WysiwygEditor from '../components/WysiwygEditor';
import { RealUploadBox } from '../components/RealUploadBox';
import LocationPicker from '../components/LocationPicker';
import ChangePhoneNumber from '../components/ChangePhoneNumber';
import { auth, catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import { ApiError } from '../api/client';
import { SOCIAL_PLATFORMS, type SocialLinks } from '../types';
import { ageFromDob } from '../lib/ageGate';
import { XCircle, Camera, CheckCircle2, BadgeCheck } from 'lucide-react';

export default function EditProfile() {
  const { user, updateUser } = useApp();
  const navigate = useNavigate();

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
  const [loc, setLoc] = useState({
    country: user?.country ?? 'India', state: user?.state ?? '', city: user?.city ?? '', pincode: user?.pincode ?? '',
  });
  const [photo, setPhoto] = useState(user?.avatarUrl ?? '');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showAllSocials, setShowAllSocials] = useState(false);
  // Real, admin-managed categories (EventCategory — the same tree the
  // event browse filters and both event editors' pickers already use)
  // instead of a hardcoded frontend list — a category admin adds shows up
  // here too, with nothing to redeploy. INTEREST_TAGS is only the
  // offline/mock-mode fallback.
  const [liveCategories, setLiveCategories] = useState<string[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.categories().then((cats) => setLiveCategories(cats.map((c) => c.name))).catch(() => setLiveCategories([]));
  }, []);
  const interestTags = liveCategories ?? (isBackendEnabled() ? [] : INTEREST_TAGS);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [usernameErr, setUsernameErr] = useState('');

  if (!user) return null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Live from whatever's currently typed in the dob field above — falls
  // back to the stored value (which may have come from checkout's age
  // confirmation, not a dob at all) once that field is blank. Never itself
  // editable; age.ts's backend equivalent is what actually locks this in
  // on save.
  const displayAge = (form.dob.trim() ? ageFromDob(form.dob.trim()) : null) ?? user.age;

  // Instagram (always) plus anything already filled in (so a previously-
  // saved Facebook link, say, never silently disappears) — the rest stay
  // collapsed behind "+ Add another" instead of dumping all 7 platforms on
  // screen at once.
  const visiblePlatforms = SOCIAL_PLATFORMS.filter(
    (p, i) => i === 0 || showAllSocials || (socialLinks[p.key] ?? '').trim()
  );
  const hiddenPlatformCount = SOCIAL_PLATFORMS.length - visiblePlatforms.length;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setUsernameErr('');
    if (photoUploading) { setErr('Photo is still uploading — wait for it to finish before saving'); return; }
    setSaving(true);
    try {
      const updated = await auth.updateMe({
        ...form,
        city: loc.city, state: loc.state, country: loc.country, pincode: loc.pincode,
        interests, avatarUrl: photo || undefined, socialLinks,
      });
      updateUser(updated);
      navigate('/profile');
    } catch (e2) {
      const msg = e2 instanceof ApiError ? e2.message : 'Failed to save profile';
      // Same reasoning as FinishProfile.tsx's identical fix — tie a
      // username-taken error straight to the field instead of a generic
      // banner up top a guest scrolling this long form could easily miss.
      if (/username/i.test(msg)) {
        setUsernameErr(msg);
        document.getElementById('username-field')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setErr(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="breadcrumb">
          <Link to="/profile">← Profile</Link> / Edit profile ·{' '}
          <span className="accent">{user.profilePct}% complete</span>
        </div>
        <h1 style={{ fontSize: 24, marginBottom: 18 }}>Edit profile</h1>
        {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><XCircle size={13} /> {err}</div>}

        <form className="card" onSubmit={save}>
          <RealUploadBox
            value={photo}
            onChange={setPhoto}
            upload={auth.upload}
            onBusyChange={setPhotoUploading}
            label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Camera size={14} /> photo + — Add a profile picture</span>}
            doneLabel={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={14} /> Photo added — click to replace</span>}
            style={{ marginBottom: 18, height: 120 }}
          />

          <div className="form-row">
            <div className="field">
              <span>Full name</span>
              <input value={form.name} onChange={set('name')} />
            </div>
            <div className="field">
              <span>Username</span>
              <input
                id="username-field"
                value={form.username}
                onChange={(e) => { set('username')(e); setUsernameErr(''); }}
                placeholder="@username"
                style={usernameErr ? { borderColor: 'var(--danger)' } : undefined}
              />
              {usernameErr && <div className="tiny danger-text" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}><XCircle size={12} /> {usernameErr} — please choose a different one</div>}
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <span>Date of birth</span>
              <input type="date" value={form.dob} onChange={set('dob')} />
              {displayAge != null && <div className="tiny muted" style={{ marginTop: 4 }}>Age {displayAge}</div>}
            </div>
            <div className="field">
              <span>Gender</span>
              <select value={form.gender} onChange={set('gender')}>
                <option value="">Select…</option>
                <option>Female</option>
                <option>Male</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            </div>
          </div>
          <div className="field">
            <span>Email</span>
            <input type="email" value={form.email} onChange={set('email')} />
          </div>
          <LocationPicker value={loc} onChange={setLoc} />
          <div className="form-row">
            <div className="field">
              <span>Profession</span>
              <input value={form.profession} onChange={set('profession')} />
            </div>
            <div className="field">
              <span>Languages</span>
              <input value={form.languages} onChange={set('languages')} />
            </div>
          </div>
          <div className="field">
            <span>Bio</span>
            <WysiwygEditor value={form.bio} onChange={(html) => setForm((f) => ({ ...f, bio: html }))} minHeight={70} />
          </div>
          <div className="field">
            <span>Social links</span>
            {/* Grid, not .form-row — more than two platforms would wrap awkwardly in a row. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {visiblePlatforms.map((p) => (
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
            {hiddenPlatformCount > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10, width: 'fit-content' }} onClick={() => setShowAllSocials(true)}>
                + Add another social link
              </button>
            )}
          </div>

          <div className="field">
            <span>Interests</span>
            <div className="chip-row">
              {interestTags.map((t) => (
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
                  {interests.includes(t) ? <CheckCircle2 size={12} style={{ marginLeft: 4, verticalAlign: -1 }} /> : ''}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <ChangePhoneNumber />
            {user.idVerified && (
              <div className="tiny muted-2" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>Aadhaar verified <span className="verified" style={{ display: 'inline-flex' }}><BadgeCheck size={13} /></span></div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-pri" disabled={saving || photoUploading}>{photoUploading ? 'Uploading…' : saving ? 'Saving…' : 'Save changes'}</button>
            <Link to="/profile" className="btn btn-ghost">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
