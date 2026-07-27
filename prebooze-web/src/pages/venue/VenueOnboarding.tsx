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
import { FileDropBox } from '../../components/FileDropBox';
import { dataUrlToFile } from '../../lib/fileUtils';
import { auth, venuePartner } from '../../api';
import { isBackendEnabled, ApiError } from '../../api/client';

const VENUE_TYPES = ['Nightclub', 'Bar & lounge', 'Rooftop', 'Warehouse', 'Live-music hall', 'Comedy club', 'Banquet / open ground', 'Cafe & brewery'];
const AMENITIES = ['Parking', 'Smoking area', 'Dance floor', 'Live sound rig', 'VIP tables', 'Outdoor seating', 'Food & kitchen', 'Full bar', 'Wheelchair access', 'Valet'];

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const DRAFT_ID = 'venue';
// license/addressProof deliberately excluded — they're full-size photo data
// URLs, and persisting a couple of MB-sized images into localStorage risks
// hitting the per-origin quota (~5-10MB total). When that write throws it
// used to take the whole draft down with it, which is what made switching
// steps look like it "forgot" the uploads. Photos now just live in React
// state — fine across step 1 <-> step 2 within the same visit.
type Draft = {
  name: string; vtype: string; loc: LocationValue; address: string; capacity: string;
  amenities: string[]; timings: string; about: string;
};
const emptyDraft: Draft = {
  name: '', vtype: VENUE_TYPES[0], loc: emptyLocation(), address: '', capacity: '',
  amenities: [], timings: '', about: '',
};

/** Venue-partner onboarding — same 2-step pattern as other roles:
 * listing details → license & documents, then Pending admin review. */
export default function VenueOnboarding() {
  const { user, submitRoleApplication, addMyVenue, updateUser } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  const draft0 = loadDraft(DRAFT_ID, emptyDraft);
  const [name, setName] = useState(draft0.name);
  const [vtype, setVtype] = useState(draft0.vtype);
  const [loc, setLoc] = useState(draft0.loc);
  const [address, setAddress] = useState(draft0.address);
  const [capacity, setCapacity] = useState(draft0.capacity);
  const [amenities, setAmenities] = useState<string[]>(draft0.amenities);
  const [timings, setTimings] = useState(draft0.timings);
  const [about, setAbout] = useState(draft0.about);

  const [license, setLicense] = useState('');
  const [addressProof, setAddressProof] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    try {
      saveDraft(DRAFT_ID, { name, vtype, loc, address, capacity, amenities, timings, about });
    } catch {
      // best-effort — a full localStorage quota shouldn't block onboarding itself
    }
  }, [name, vtype, loc, address, capacity, amenities, timings, about]);

  if (!user) return <Navigate to="/login" state={{ from: '/venue/onboarding' }} replace />;
  const otherRole = existingRole(user);
  if (otherRole && otherRole !== 'venue') return <RoleTaken has={otherRole} />;
  if (user.isVenue && !done) return <Navigate to="/venue" replace />;

  const step1Valid = name.trim() && loc.city && address.trim() && Number(capacity) > 0 && about.trim();
  const pct = done ? 100 : step === 1 ? 50 : 90;

  const toggleAmenity = (a: string) =>
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const submit = async () => {
    if (!isBackendEnabled()) {
      const id = slugify(name) || `venue-${Date.now()}`;
      addMyVenue({
        id,
        name: name.trim(),
        verified: false,
        type: vtype,
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
      });
      submitRoleApplication('venue', { venueName: name.trim(), venueId: id });
      notify(user.phone, 'welcome', { name: name.trim() }, user.email || undefined);
      clearDraft(DRAFT_ID);
      setDone(true);
      return;
    }
    setErr('');
    setSubmitting(true);
    try {
      const [licenseFile, addressProofFile] = await Promise.all([
        dataUrlToFile(license, 'license.jpg'),
        dataUrlToFile(addressProof, 'address-proof.jpg'),
      ]);
      const [{ url: licenseUrl }, { url: addressProofUrl }] = await Promise.all([
        venuePartner.upload(licenseFile),
        venuePartner.upload(addressProofFile),
      ]);
      await venuePartner.onboard({
        name: name.trim(), type: vtype, city: loc.city, address: address.trim(),
        capacity: Number(capacity), amenities, timings: timings.trim() || undefined, about: about.trim(),
        licenseDoc: licenseUrl, addressProofDoc: addressProofUrl,
      });
      // onboard() only returns the new Venue row — refetch /me for the
      // authoritative roleStatus/venueId the layout gate needs.
      const fresh = await auth.me();
      updateUser({ ...fresh, pendingRole: 'venue' });
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
          <h1 style={{ fontSize: 26 }}>Your venue is on Prebooze! 🏛</h1>
          <p className="muted" style={{ margin: '8px 0 22px' }}>
            <b style={{ color: 'var(--text)' }}>{name}</b> is submitted for review. Once approved it gets the
            verified badge, appears in the {loc.city} venue directory, and organizers can pick it while creating events.
          </p>
          <div className="card" style={{ textAlign: 'left', marginBottom: 18 }}>
            <div className="kv"><span className="k">Listing</span><span>{name} · {vtype} · {loc.city}</span></div>
            <div className="kv"><span className="k">Capacity</span><span>{capacity} guests</span></div>
            <div className="kv"><span className="k">Status</span><span className="badge badge-pending">Pending review ◌ · ~24h</span></div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/venue" className="btn btn-pri">Go to my venue dashboard →</Link>
            <Link to="/venues" className="btn btn-ghost">See the venue directory</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ fontSize: 24 }}>{step === 1 ? 'List your venue' : 'License & documents'}</h1>
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
            <div className="form-row">
              <div className="field">
                <span>Venue name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Neon Warehouse" autoFocus />
              </div>
              <div className="field">
                <span>Venue type</span>
                <select value={vtype} onChange={(e) => setVtype(e.target.value)}>
                  {VENUE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
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
              <span>🕒 Timings</span>
              <input value={timings} onChange={(e) => setTimings(e.target.value)} placeholder="e.g. Wed–Sun · 8 PM – 1 AM" />
            </div>
            <div className="field">
              <span>ℹ️ About the venue</span>
              <WysiwygEditor value={about} onChange={setAbout} minHeight={80} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
                ← Back
              </button>
              <button className="btn btn-pri btn-lg" style={{ flex: 1 }} disabled={!step1Valid}>
                Save & continue → documents
              </button>
            </div>
          </form>
        ) : (
          <div>
            <p className="muted small" style={{ marginBottom: 16 }}>
              Verified venues get the <span className="verified">✓</span> badge, rank in the city directory and
              can be picked by organizers. Documents are reviewed by the Prebooze team.
            </p>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>1 · Operating license</h3>
              <FileDropBox value={license} onChange={setLicense} label="⬆ upload bar / entertainment operating license" doneLabel="✓ License uploaded — click to replace" />
            </div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>2 · Address proof</h3>
              <FileDropBox value={addressProof} onChange={setAddressProof} label="⬆ upload utility bill / lease / registration" doneLabel="✓ Address proof uploaded — click to replace" />
            </div>
            {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-pri btn-lg" style={{ flex: 1 }} disabled={!license || !addressProof || submitting} onClick={submit}>
                {submitting ? 'Submitting…' : 'Submit for review 🏛'}
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
