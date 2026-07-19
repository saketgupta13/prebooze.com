import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import LocationPicker, { emptyLocation } from '../../components/LocationPicker';
import RoleTaken from '../../components/RoleTaken';
import { existingRole } from '../../lib/roles';
import { notify } from '../../lib/notify';

const VENUE_TYPES = ['Nightclub', 'Bar & lounge', 'Rooftop', 'Warehouse', 'Live-music hall', 'Comedy club', 'Banquet / open ground', 'Cafe & brewery'];
const AMENITIES = ['Parking', 'Smoking area', 'Dance floor', 'Live sound rig', 'VIP tables', 'Outdoor seating', 'Food & kitchen', 'Full bar', 'Wheelchair access', 'Valet'];

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Venue-partner onboarding — same 2-step pattern as other roles:
 * listing details → license & documents, then Pending admin review. */
export default function VenueOnboarding() {
  const { user, updateUser, addMyVenue } = useApp();
  const [step, setStep] = useState<1 | 2>(1);

  const [photos, setPhotos] = useState(false);
  const [name, setName] = useState('');
  const [vtype, setVtype] = useState(VENUE_TYPES[0]);
  const [loc, setLoc] = useState(emptyLocation);
  const [address, setAddress] = useState('');
  const [capacity, setCapacity] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [timings, setTimings] = useState('');
  const [about, setAbout] = useState('');

  const [license, setLicense] = useState(false);
  const [addressProof, setAddressProof] = useState(false);
  const [done, setDone] = useState(false);

  if (!user) return <Navigate to="/login" state={{ from: '/venue/onboarding' }} replace />;
  const otherRole = existingRole(user);
  if (otherRole && otherRole !== 'venue') return <RoleTaken has={otherRole} />;
  if (user.isVenue && !done) return <Navigate to="/venue" replace />;

  const step1Valid = name.trim() && loc.city && address.trim() && Number(capacity) > 0 && about.trim();
  const pct = done ? 100 : step === 1 ? 50 : 90;

  const toggleAmenity = (a: string) =>
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const submit = () => {
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
      about: about.trim() + (timings.trim() ? ` · Timings: ${timings.trim()}` : ''),
      photoHue: Math.floor(Math.random() * 360),
    });
    updateUser({ isVenue: true, venueName: name.trim(), venueId: id });
    notify(user.phone, 'welcome', { name: name.trim() }, user.email || undefined);
    setDone(true);
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
            <div className={`upload-box ${photos ? 'done' : ''}`} onClick={() => setPhotos((v) => !v)} style={{ marginBottom: 16 }}>
              {photos ? '✓ Venue photos added' : '📷 upload venue photos — entrance, floor, stage (up to 8)'}
            </div>
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
              <span>Timings (optional)</span>
              <input value={timings} onChange={(e) => setTimings(e.target.value)} placeholder="e.g. Wed–Sun · 8 PM – 1 AM" />
            </div>
            <div className="field">
              <span>About the venue</span>
              <textarea value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Sound, vibe, what nights work best here…" />
            </div>
            <button className="btn btn-pri btn-block btn-lg" disabled={!step1Valid}>
              Save & continue → documents
            </button>
          </form>
        ) : (
          <div>
            <p className="muted small" style={{ marginBottom: 16 }}>
              Verified venues get the <span className="verified">✓</span> badge, rank in the city directory and
              can be picked by organizers. Documents are reviewed by the Prebooze team.
            </p>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>1 · Operating license</h3>
              <div className={`upload-box ${license ? 'done' : ''}`} onClick={() => setLicense((v) => !v)}>
                {license ? '✓ License uploaded' : '⬆ upload bar / entertainment operating license'}
              </div>
            </div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>2 · Address proof</h3>
              <div className={`upload-box ${addressProof ? 'done' : ''}`} onClick={() => setAddressProof((v) => !v)}>
                {addressProof ? '✓ Address proof uploaded' : '⬆ upload utility bill / lease / registration'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-pri btn-lg" style={{ flex: 1 }} disabled={!license || !addressProof} onClick={submit}>
                Submit for review 🏛
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
