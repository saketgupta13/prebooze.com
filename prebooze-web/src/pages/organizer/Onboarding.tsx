import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import LocationPicker, { emptyLocation, type LocationValue } from '../../components/LocationPicker';
import RoleTaken from '../../components/RoleTaken';
import { existingRole } from '../../lib/roles';
import { loadDraft, saveDraft, clearDraft } from '../../lib/formDraft';
import { FileDropBox } from '../../components/FileDropBox';
import { kyc, organizer, catalog } from '../../api';
import { isBackendEnabled, ApiError } from '../../api/client';
import { pushEvent } from '../../lib/gtm';
import { trackMeta } from '../../lib/meta';
import { useDraftLead } from '../../lib/useDraftLead';

const DRAFT_ID = 'organizer';
const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Username is auto-derived from the brand name server-side (see
// KycService.quickSignupOrganizer) — no longer typed here. PAN/GSTIN/bank/
// Aadhaar/selfie all moved to the self-serve "Complete verification" step
// (Settings → Verification, whenever the organizer's ready — usually right
// before their first withdrawal) — signup only collects what's needed to
// start building events. "About" moved to Settings → Brand profile, editable
// any time rather than a one-shot signup field. See KycService.
// quickSignupOrganizer, OrganizerVerification.tsx and Settings.tsx.
type Draft = {
  brand: string; loc: LocationValue; types: string[];
  instagram: string; facebook: string; other: string[];
};
const emptyDraft: Draft = {
  brand: '', loc: emptyLocation(), types: [],
  instagram: '', facebook: '', other: [''],
};

export default function Onboarding() {
  const { user, submitRoleApplication, updateUser } = useApp();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const draft0 = loadDraft(DRAFT_ID, emptyDraft);
  const [logo, setLogo] = useState('');
  const [brand, setBrand] = useState(user?.orgBrand || draft0.brand);
  const [loc, setLoc] = useState(draft0.loc);
  const [types, setTypes] = useState<string[]>(draft0.types);
  const [instagram, setInstagram] = useState(draft0.instagram);
  const [facebook, setFacebook] = useState(draft0.facebook);
  const [other, setOther] = useState<string[]>(draft0.other.length ? draft0.other : ['']);
  // Real, admin-managed categories (Admin > Categories) — same source every
  // other "event type" picker in the app already reads from (CreateEvent.tsx,
  // Browse.tsx, Categories.tsx), so a category added there shows up here too
  // with no separate list to keep in sync.
  const [categories, setCategories] = useState<{ name: string; icon: string }[]>([]);
  useEffect(() => {
    catalog.categories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      saveDraft(DRAFT_ID, { brand, loc, types, instagram, facebook, other });
    } catch {
      // best-effort — a full localStorage quota shouldn't block onboarding itself
    }
  }, [brand, loc, types, instagram, facebook, other]);

  useDraftLead('organizer', brand, { city: loc.city, eventType: types.join(', ') });

  const otherRole = existingRole(user);
  if (otherRole && otherRole !== 'organizer') return <RoleTaken has={otherRole} />;

  const valid = brand.trim() && loc.city.trim() && types.length > 0;

  const toggleType = (t: string) => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const setOtherLink = (i: number, v: string) => setOther((prev) => prev.map((l, idx) => (idx === i ? v : l)));
  const addOtherLink = () => setOther((prev) => [...prev, '']);
  const removeOtherLink = (i: number) => setOther((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : ['']));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otherLinks = other.map((l) => l.trim()).filter(Boolean);
    if (!isBackendEnabled()) {
      submitRoleApplication('organizer', { orgBrand: brand.trim(), orgUsername: slugify(brand) });
      clearDraft(DRAFT_ID);
      navigate('/organizer');
      return;
    }
    setErr('');
    setSubmitting(true);
    try {
      const res = await kyc.quickSignupOrganizer({
        brand: brand.trim(),
        city: loc.city, country: loc.country, state: loc.state, pincode: loc.pincode,
        types,
        socialLinks: { instagram: instagram.trim() || undefined, facebook: facebook.trim() || undefined, other: otherLinks },
      });
      updateUser(res.user);
      // Logo is only a local preview (data URL) until now — organizer.upload
      // requires a real Organizer row to already exist (it checks ownership),
      // which only just happened above, so the real upload has to wait until
      // after signup succeeds. Best-effort: a failed/skipped logo shouldn't
      // block account creation itself — they can always add one in Settings.
      if (logo) {
        try {
          const blob = await fetch(logo).then((r) => r.blob());
          const file = new File([blob], 'logo.jpg', { type: blob.type || 'image/jpeg' });
          const { url } = await organizer.upload(file);
          const updated = await organizer.updateMe({ logoUrl: url });
          updateUser({ orgLogoUrl: updated.logoUrl ?? undefined });
        } catch {
          // logo upload failed — account still created fine, just no logo yet
        }
      }
      pushEvent('organizer_onboarding_submitted');
      trackMeta('Lead', { content_name: 'organizer_onboarding' }, `${user?.phone}_organizer`);
      clearDraft(DRAFT_ID);
      navigate('/organizer'); // straight to the real dashboard — no pending-review wait
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to submit — try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 24 }}>Set up your organizer profile</h1>
        <p className="muted small" style={{ margin: '6px 0 18px' }}>
          Just enough to start building your first event — add the rest later, whenever you're ready.
        </p>

        <form className="card" onSubmit={submit}>
          <FileDropBox
            value={logo}
            onChange={setLogo}
            label="logo + — Brand logo — shown on every event you publish"
            doneLabel="✓ Logo added — click to replace"
            style={{ marginBottom: 16 }}
          />

          <div className="field">
            <span>Organizer / brand name *</span>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand name" autoFocus />
          </div>
          <LocationPicker value={loc} onChange={setLoc} />
          <div className="field">
            <span>Event types you host *</span>
            <div className="chip-row">
              {categories.map((c) => (
                <button type="button" key={c.name} className={`chip ${types.includes(c.name) ? 'on' : ''}`} onClick={() => toggleType(c.name)}>
                  {c.icon} {c.name}{types.includes(c.name) ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Website & social links</span>
            <div className="form-row">
              <div className="field">
                <span>Instagram</span>
                <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="instagram.com/yourbrand" />
              </div>
              <div className="field">
                <span>Facebook</span>
                <input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="facebook.com/yourbrand" />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {other.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 6 }}>
                  <input
                    style={{ flex: 1 }}
                    value={l}
                    onChange={(e) => setOtherLink(i, e.target.value)}
                    placeholder={i === 0 ? 'Website, X, YouTube…' : 'Another link'}
                  />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeOtherLink(i)} title="Remove">✕</button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addOtherLink}>+ Add another link</button>
            </div>
          </div>

          {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <button className="btn btn-pri btn-lg" style={{ flex: 1 }} disabled={!valid || submitting}>
              {submitting ? 'Setting up…' : 'Create my organizer account →'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
