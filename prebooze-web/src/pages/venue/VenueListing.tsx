import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { VENUES } from '../../data/mock';

const VENUE_TYPES = ['Nightclub', 'Bar & lounge', 'Rooftop', 'Warehouse', 'Live-music hall', 'Comedy club', 'Banquet / open ground', 'Cafe & brewery'];
const AMENITIES = ['Parking', 'Smoking area', 'Dance floor', 'Live sound rig', 'VIP tables', 'Outdoor seating', 'Food & kitchen', 'Full bar', 'Wheelchair access', 'Valet'];

/** Edit the public venue listing — what guests and organizers see. */
export default function VenueListing() {
  const { user, updateUser, updateMyVenue, toast } = useApp();
  const venue = VENUES.find((v) => v.id === user?.venueId);

  const [name, setName] = useState(venue?.name ?? user?.venueName ?? '');
  const [vtype, setVtype] = useState(venue?.type ?? VENUE_TYPES[0]);
  const [address, setAddress] = useState(venue?.address ?? '');
  const [capacity, setCapacity] = useState(String(venue?.capacity ?? ''));
  const [amenities, setAmenities] = useState<string[]>(venue?.amenities ?? []);
  const [about, setAbout] = useState(venue?.about ?? '');
  const [photos, setPhotos] = useState(false);

  if (!venue) {
    return (
      <div className="card">
        Listing record not found. <Link to="/venue/onboarding" className="link">Re-run onboarding →</Link>
      </div>
    );
  }

  const toggleAmenity = (a: string) =>
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !(Number(capacity) > 0) || !about.trim()) {
      toast('Name, address, capacity and about are required');
      return;
    }
    updateMyVenue(venue.id, {
      name: name.trim(),
      type: vtype,
      address: address.trim(),
      capacity: Number(capacity),
      amenities,
      about: about.trim(),
    });
    updateUser({ venueName: name.trim() });
    toast('Listing updated ✓ changes are live');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24 }}>My listing</h1>
        <Link to={`/venues/${venue.id}`} className="link small bold">View public page ↗</Link>
      </div>
      <p className="muted small" style={{ margin: '4px 0 16px' }}>
        This is exactly what guests see in the directory and what organizers see when picking a venue.
      </p>

      <form className="card" onSubmit={save}>
        <div className={`upload-box ${photos ? 'done' : ''}`} onClick={() => setPhotos((v) => !v)} style={{ marginBottom: 16 }}>
          {photos ? '✓ New photos added' : '📷 update venue photos — entrance, floor, stage (up to 8)'}
        </div>
        <div className="form-row">
          <div className="field">
            <span>Venue name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <span>Venue type</span>
            <select value={vtype} onChange={(e) => setVtype(e.target.value)}>
              {VENUE_TYPES.map((t) => <option key={t}>{t}</option>)}
              {!VENUE_TYPES.includes(vtype) && <option>{vtype}</option>}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <span>Full address</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="field">
            <span>Capacity (guests)</span>
            <input value={capacity} inputMode="numeric" onChange={(e) => setCapacity(e.target.value.replace(/\D/g, '').slice(0, 6))} />
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
          <span>About the venue</span>
          <textarea value={about} onChange={(e) => setAbout(e.target.value)} />
        </div>
        <button className="btn btn-pri btn-lg">Save listing ✓</button>
        <span className="tiny muted-2" style={{ marginLeft: 10 }}>city changes go through support — keeps the directory clean</span>
      </form>
    </div>
  );
}
