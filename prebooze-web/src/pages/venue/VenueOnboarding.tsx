import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import LocationPicker, { emptyLocation, type LocationValue } from '../../components/LocationPicker';
import RoleTaken from '../../components/RoleTaken';
import MapEmbed from '../../components/MapEmbed';
import { existingRole } from '../../lib/roles';
import { notify } from '../../lib/notify';
import { loadDraft, saveDraft, clearDraft } from '../../lib/formDraft';
import WysiwygEditor from '../../components/WysiwygEditor';
import { RealUploadBox } from '../../components/RealUploadBox';
import { auth, venuePartner, catalog } from '../../api';
import { isBackendEnabled, ApiError } from '../../api/client';
import { pushEvent } from '../../lib/gtm';
import { trackMeta } from '../../lib/meta';
import { CheckCircle2, Landmark, BadgeCheck, Check, Upload, Clock, Info, AlertCircle } from 'lucide-react';
import { useDraftLead } from '../../lib/useDraftLead';
import { cityVenues } from '../../lib/urls';

// Offline/dev-mode fallback only — the real, admin-managed list (Admin >
// Content > Venue types) is fetched below and used whenever a backend is
// configured, same "mock is never a loading placeholder in production"
// rule as every other real-taxonomy fetch in this app.
const VENUE_TYPES_FALLBACK = ['Nightclub', 'Bar & lounge', 'Rooftop', 'Warehouse', 'Live-music hall', 'Comedy club', 'Banquet / open ground', 'Cafe & brewery'];
const AMENITIES = ['Parking', 'Smoking area', 'Dance floor', 'Live sound rig', 'VIP tables', 'Outdoor seating', 'Food & kitchen', 'Full bar', 'Wheelchair access', 'Valet'];

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const DRAFT_ID = 'venue';
// license/addressProof/logo deliberately excluded — they're full-size photo
// data URLs (or, for logo, a real hosted URL that doesn't need draft
// persistence at all), and persisting a couple of MB-sized images into
// localStorage risks hitting the per-origin quota (~5-10MB total). When that
// write throws it used to take the whole draft down with it, which is what
// made switching steps look like it "forgot" the uploads. Photos now just
// live in React state — fine across step 1 <-> step 2 within the same visit.
type Draft = {
  name: string; vtypes: string[]; loc: LocationValue; address: string; capacity: string;
  amenities: string[]; timings: string; about: string;
};
const emptyDraft: Draft = {
  name: '', vtypes: [VENUE_TYPES_FALLBACK[0]], loc: emptyLocation(), address: '', capacity: '',
  amenities: [], timings: '', about: '',
};

/** Venue-partner onboarding — self-serve, minimal, single-step, same
 * pattern as organizer's Onboarding.tsx: listing details only, no
 * documents, no admin review — the venue is live and pickable by
 * organizers the moment this is submitted. Identity verification (license
 * + address proof) moved entirely to a separate, optional, self-serve step
 * — see VenueVerification.tsx, reachable from venue Settings whenever
 * ready, never blocking anything here. */
export default function VenueOnboarding() {
  const { user, submitRoleApplication, addMyVenue, updateUser } = useApp();
  const navigate = useNavigate();

  const draft0 = loadDraft(DRAFT_ID, emptyDraft);
  const [name, setName] = useState(draft0.name);
  const [vtypes, setVtypes] = useState<string[]>(draft0.vtypes ?? emptyDraft.vtypes);
  const [loc, setLoc] = useState(draft0.loc);
  const [address, setAddress] = useState(draft0.address);
  const [capacity, setCapacity] = useState(draft0.capacity);
  const [amenities, setAmenities] = useState<string[]>(draft0.amenities);
  const [timings, setTimings] = useState(draft0.timings);
  const [about, setAbout] = useState(draft0.about);
  const [logoUrl, setLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [contactPerson, setContactPerson] = useState('');
  const [contactPersonPhone, setContactPersonPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');

  const [venueTypeOptions, setVenueTypeOptions] = useState<string[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.venueTypes().then((rows) => setVenueTypeOptions(rows.map((r) => r.name))).catch(() => setVenueTypeOptions([]));
  }, []);
  const VENUE_TYPES = venueTypeOptions ?? (isBackendEnabled() ? [] : VENUE_TYPES_FALLBACK);

  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    try {
      saveDraft(DRAFT_ID, { name, vtypes, loc, address, capacity, amenities, timings, about });
    } catch {
      // best-effort — a full localStorage quota shouldn't block onboarding itself
    }
  }, [name, vtypes, loc, address, capacity, amenities, timings, about]);

  useDraftLead('venue', name, { city: loc.city, eventType: vtypes.join(', ') });

  if (!user) return <Navigate to="/login" state={{ from: '/venue/onboarding' }} replace />;
  const otherRole = existingRole(user);
  if (otherRole && otherRole !== 'venue') return <RoleTaken has={otherRole} />;
  if (user.isVenue && !done) return <Navigate to="/venue" replace />;

  const valid = name.trim() && vtypes.length > 0 && loc.city && address.trim() && Number(capacity) > 0 && about.trim();
  const pct = done ? 100 : 80;

  const toggleAmenity = (a: string) =>
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  const toggleVtype = (t: string) =>
    setVtypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const submit = async () => {
    if (!isBackendEnabled()) {
      const id = slugify(name) || `venue-${Date.now()}`;
      addMyVenue({
        id,
        name: name.trim(),
        verified: false,
        type: vtypes.join(', '),
        locality: '',
        city: loc.city,
        address: address.trim(),
        capacity: Number(capacity),
        rating: 0,
        followers: 0,
        amenities,
        about: about.trim(),
        timings: timings.trim() || undefined,
        photoHue: Math.floor(Math.random() * 360),
        logoUrl: logoUrl || undefined,
        contactPerson: contactPerson.trim() || undefined,
        contactPersonPhone: contactPersonPhone.trim() || undefined,
        socialLinks: (instagram.trim() || facebook.trim()) ? { instagram: instagram.trim() || undefined, facebook: facebook.trim() || undefined } : undefined,
      });
      submitRoleApplication('venue', { venueName: name.trim(), venueId: id });
      notify(user.phone, 'welcome', { name: name.trim() }, user.email || undefined);
      clearDraft(DRAFT_ID);
      setDone(true);
      return;
    }
    setErr('');
    if (logoUploading) { setErr('Logo is still uploading — wait for it to finish before saving'); return; }
    setSubmitting(true);
    try {
      await venuePartner.onboard({
        name: name.trim(), type: vtypes.join(', '), city: loc.city, state: loc.state || undefined, country: loc.country || undefined, pincode: loc.pincode || undefined, address: address.trim(),
        capacity: Number(capacity), amenities, timings: timings.trim() || undefined, about: about.trim(),
        logoUrl: logoUrl || undefined,
        contactPerson: contactPerson.trim() || undefined,
        contactPersonPhone: contactPersonPhone.trim() || undefined,
        socialLinks: (instagram.trim() || facebook.trim()) ? { instagram: instagram.trim() || undefined, facebook: facebook.trim() || undefined } : undefined,
      });
      // onboard() only returns the new Venue row — refetch /me for the
      // authoritative roleStatus/venueId the layout gate needs.
      const fresh = await auth.me();
      updateUser({ ...fresh, pendingRole: 'venue' });
      pushEvent('venue_onboarding_submitted');
      // eventId must match venue.service.ts's onboard server-side call.
      trackMeta('Lead', { content_name: 'venue_onboarding' }, `${user?.phone}_venue`);
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
          <div className="confirm-tick"><CheckCircle2 size={30} /></div>
          <h1 style={{ fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>Your venue is on Prebooze! <Landmark size={22} /></h1>
          <p className="muted" style={{ margin: '8px 0 22px' }}>
            <b style={{ color: 'var(--text)' }}>{name}</b> is live right now — it's in the {loc.city} venue
            directory and organizers can already pick it while creating events. Add the verified{' '}
            <span className="verified" style={{ display: 'inline-flex' }}><BadgeCheck size={13} /></span> badge whenever you're ready, from Settings.
          </p>
          <div className="card" style={{ textAlign: 'left', marginBottom: 18 }}>
            <div className="kv"><span className="k">Listing</span><span>{name} · {vtypes.join(', ')} · {loc.city}</span></div>
            <div className="kv"><span className="k">Capacity</span><span>{capacity} guests</span></div>
            <div className="kv"><span className="k">Status</span><span className="badge badge-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Live <Check size={12} /></span></div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/venue" className="btn btn-pri">Go to my venue dashboard →</Link>
            <Link to={cityVenues(loc.city)} className="btn btn-ghost">See the venue directory</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ fontSize: 24 }}>List your venue</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 22px' }}>
          <div className="progress" style={{ flex: 1 }}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <span className="small muted bold">{pct}%</span>
        </div>

        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) submit();
          }}
          >
            <div className="field">
              <span>Venue name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Neon Warehouse" autoFocus />
            </div>
            <div className="field">
              <span>Venue type — pick all that apply</span>
              <div className="chip-row">
                {VENUE_TYPES.map((t) => (
                  <button type="button" key={t} className={`chip ${vtypes.includes(t) ? 'on' : ''}`} onClick={() => toggleVtype(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span>Logo (optional) — shown next to your venue name in the directory</span>
              <RealUploadBox
                value={logoUrl}
                onChange={setLogoUrl}
                upload={venuePartner.upload}
                onBusyChange={setLogoUploading}
                label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Upload size={13} /> upload logo</span>}
                doneLabel={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={13} /> Logo uploaded — click to replace</span>}
                style={{ height: 100, width: 100 }}
              />
            </div>
            <LocationPicker value={loc} onChange={setLoc} />
            <div className="form-row">
              <div className="field">
                <span>Full address</span>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, locality, landmark" />
              </div>
              <div className="field">
                <span>Capacity (guests)</span>
                <input value={capacity} inputMode="numeric" onChange={(e) => setCapacity(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="e.g. 450" />
              </div>
            </div>
            {address.trim() && loc.city && <MapEmbed query={`${address}, ${loc.city}`} />}
            <div className="field">
              <span>Amenities</span>
              <div className="chip-row">
                {AMENITIES.map((a) => (
                  <button type="button" key={a} className={`chip ${amenities.includes(a) ? 'on' : ''}`} onClick={() => toggleAmenity(a)}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={13} /> Timings</span>
              <input value={timings} onChange={(e) => setTimings(e.target.value)} placeholder="e.g. Wed–Sun · 8 PM – 1 AM" />
            </div>
            <div className="field">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Info size={13} /> About the venue</span>
              <WysiwygEditor value={about} onChange={setAbout} minHeight={80} />
            </div>
            <div className="form-row">
              <div className="field">
                <span>Contact person name</span>
                <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Who should we reach out to?" />
              </div>
              <div className="field">
                <span>Contact person phone</span>
                <input value={contactPersonPhone} onChange={(e) => setContactPersonPhone(e.target.value)} placeholder="+91 …" inputMode="tel" />
              </div>
            </div>
            <div className="field">
              <span>Social media (optional) — shown on your public venue page</span>
              <div className="form-row">
                <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="instagram.com/yourvenue" />
                <input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="facebook.com/yourvenue" />
              </div>
            </div>
            {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={14} /> {err}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost" style={{ flexShrink: 0 }} onClick={() => navigate(-1)}>
                ← Back
              </button>
              <button className="btn btn-pri btn-lg" style={{ flex: 1, minWidth: 0, whiteSpace: 'normal' }} disabled={!valid || submitting || logoUploading}>
                {logoUploading ? 'Uploading…' : submitting ? 'Setting up…' : 'List my venue →'}
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
