import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppContext';
import WysiwygEditor from '../../components/WysiwygEditor';
import { RealUploadBox } from '../../components/RealUploadBox';
import ChangePhoneNumber from '../../components/ChangePhoneNumber';
import LocationPicker, { emptyLocation, type LocationValue } from '../../components/LocationPicker';
import { lineup as lineupApi } from '../../api';
import { ApiError } from '../../api/client';

const CATEGORIES = ['Artist', 'DJ', 'Band', 'Comedian', 'Sponsor', 'Promoter', 'Host'];

/** Same field set, in the same order, as LineupOnboarding.tsx — the two
 * used to drift (chip-row category + full LocationPicker on onboarding vs.
 * a plain <select> and a bare city text input here), which made "edit your
 * profile" feel like a different, smaller form than "create your profile". */
export default function LineupSettings() {
  const { user, updateUser, toast } = useApp();
  const [logoUrl, setLogoUrl] = useState('');
  const [form, setForm] = useState({
    lineupName: user?.lineupName ?? '',
    lineupCategory: user?.lineupCategory ?? 'DJ',
    username: user?.lineupUsername ?? '',
    bio: user?.bio ?? '',
    socials: user?.socials ?? '',
  });
  const [loc, setLoc] = useState<LocationValue>(emptyLocation());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // The dashboard used to seed itself from the guest User fields (city/bio/
  // socials), which went stale the moment an artist actually saved a profile
  // edit here — this is the real, current Lineup row instead.
  useEffect(() => {
    lineupApi.me()
      .then((l) => {
        setLogoUrl(l.logoUrl ?? '');
        setForm({ lineupName: l.name, lineupCategory: l.category, username: l.slug, bio: l.bio, socials: l.links.join(', ') });
        setLoc((prev) => ({ ...prev, city: l.city }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const updated = await lineupApi.updateMe({
        name: form.lineupName.trim(),
        category: form.lineupCategory,
        username: form.username.trim(),
        city: loc.city,
        bio: form.bio,
        socials: form.socials,
        logoUrl: logoUrl || undefined,
      });
      updateUser({ lineupName: updated.name, lineupCategory: updated.category, lineupUsername: updated.slug, lineupLogoUrl: updated.logoUrl ?? undefined, city: updated.city, bio: updated.bio, socials: form.socials });
      setForm((f) => ({ ...f, username: updated.slug }));
      toast('Artist profile saved ✓');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Profile & settings</h1>
      <div style={{ marginBottom: 16 }}>
        <ChangePhoneNumber />
      </div>
      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
      <form className="card" onSubmit={save}>
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
          <input value={form.lineupName} onChange={set('lineupName')} placeholder="e.g. DJ Nova" disabled={loading} />
        </div>
        <div className="field">
          <span>Username</span>
          <input value={form.username} onChange={set('username')} placeholder="e.g. dj-nova — your profile URL" disabled={loading} />
        </div>
        <div className="field">
          <span>Line-up category</span>
          <div className="chip-row">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className={`chip ${form.lineupCategory === c ? 'on' : ''}`} onClick={() => setForm((f) => ({ ...f, lineupCategory: c }))} disabled={loading}>
                {c}{form.lineupCategory === c ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </div>
        <LocationPicker value={loc} onChange={setLoc} />
        <div className="field">
          <span>Links (socials / music)</span>
          <input value={form.socials} onChange={set('socials')} placeholder="instagram.com/you, open.spotify.com/artist/you" disabled={loading} />
        </div>
        <div className="field">
          <span>Bio — what do you play / do?</span>
          <WysiwygEditor value={form.bio} onChange={(html) => setForm((f) => ({ ...f, bio: html }))} minHeight={80} />
        </div>
        <button className="btn btn-pri btn-block btn-lg" style={{ marginTop: 8 }} disabled={saving || loading}>{saving ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  );
}
