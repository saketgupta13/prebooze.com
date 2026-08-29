import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const [logoUploading, setLogoUploading] = useState(false);
  const [form, setForm] = useState({
    lineupName: user?.lineupName ?? '',
    lineupCategory: user?.lineupCategory ?? 'DJ',
    username: user?.lineupUsername ?? '',
    bio: user?.bio ?? '',
  });
  const [links, setLinks] = useState<string[]>(['']);
  const [loc, setLoc] = useState<LocationValue>(emptyLocation());
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setLink = (i: number, v: string) => setLinks((prev) => prev.map((l, idx) => (idx === i ? v : l)));
  const addLink = () => setLinks((prev) => [...prev, '']);
  const removeLink = (i: number) => setLinks((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : ['']));

  // The dashboard used to seed itself from the guest User fields (city/bio/
  // socials), which went stale the moment an artist actually saved a profile
  // edit here — this is the real, current Lineup row instead.
  useEffect(() => {
    lineupApi.me()
      .then((l) => {
        setLogoUrl(l.logoUrl ?? '');
        setForm({ lineupName: l.name, lineupCategory: l.category, username: l.slug, bio: l.bio });
        setLinks(l.links.length ? l.links : ['']);
        setLoc({ city: l.city, state: l.state ?? '', country: l.country ?? 'India', pincode: l.pincode ?? '' });
        setVerified(l.verified);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (logoUploading) { setErr('Photo is still uploading — wait for it to finish before saving'); return; }
    setSaving(true);
    try {
      const updated = await lineupApi.updateMe({
        name: form.lineupName.trim(),
        category: form.lineupCategory,
        username: form.username.trim(),
        city: loc.city, state: loc.state, country: loc.country, pincode: loc.pincode,
        bio: form.bio,
        links: links.map((l) => l.trim()).filter(Boolean),
        logoUrl: logoUrl || undefined,
      });
      updateUser({ lineupName: updated.name, lineupCategory: updated.category, lineupUsername: updated.slug, lineupLogoUrl: updated.logoUrl ?? undefined, city: updated.city, bio: updated.bio });
      setForm((f) => ({ ...f, username: updated.slug }));
      setLinks(updated.links.length ? updated.links : ['']);
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

      {!loading && (
        <div className="evrow" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">
              Verification
              {verified && <span className="verified" style={{ marginLeft: 6 }}>✓</span>}
            </div>
            <div className="tiny muted">
              {verified ? 'Your identity is verified' : "ID + selfie — a one-time verified badge, doesn't affect your profile being live"}
            </div>
          </div>
          {!verified && <Link to="/artist/profile/verification" className="btn btn-pri btn-sm">Complete verification →</Link>}
        </div>
      )}

      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
      <form className="card" onSubmit={save}>
        <RealUploadBox
          value={logoUrl}
          onChange={setLogoUrl}
          upload={lineupApi.upload}
          onBusyChange={setLogoUploading}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {links.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 6 }}>
                <input
                  style={{ flex: 1 }}
                  value={l}
                  onChange={(e) => setLink(i, e.target.value)}
                  placeholder={i === 0 ? 'instagram.com/you, spotify, soundcloud…' : 'Another link'}
                  disabled={loading}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeLink(i)} title="Remove" disabled={loading}>✕</button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addLink} disabled={loading}>+ Add another link</button>
          </div>
        </div>
        <div className="field">
          <span>Bio — what do you play / do?</span>
          <WysiwygEditor value={form.bio} onChange={(html) => setForm((f) => ({ ...f, bio: html }))} minHeight={80} />
        </div>
        <button className="btn btn-pri btn-block btn-lg" style={{ marginTop: 8 }} disabled={saving || loading || logoUploading}>{logoUploading ? 'Uploading…' : saving ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  );
}
