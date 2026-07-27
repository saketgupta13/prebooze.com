import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import MapEmbed from '../../components/MapEmbed';
import WysiwygEditor from '../../components/WysiwygEditor';
import { RealGalleryUploadBox } from '../../components/RealUploadBox';
import { venuePartner } from '../../api';
import { ApiError } from '../../api/client';
import type { Venue } from '../../types';

const VENUE_TYPES = ['Nightclub', 'Bar & lounge', 'Rooftop', 'Warehouse', 'Live-music hall', 'Comedy club', 'Banquet / open ground', 'Cafe & brewery'];
const AMENITIES = ['Parking', 'Smoking area', 'Dance floor', 'Live sound rig', 'VIP tables', 'Outdoor seating', 'Food & kitchen', 'Full bar', 'Wheelchair access', 'Valet'];

/** Edit the public venue listing — what guests and organizers see. Real
 * GET/PATCH /venue/listing, including a real photo gallery (POST
 * /venue/upload, Venue.galleryUrls) — this is the "media" section a newly
 * onboarded venue uses to add real photos. */
export default function VenueListing() {
  const { updateUser, toast } = useApp();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [name, setName] = useState('');
  const [vtype, setVtype] = useState(VENUE_TYPES[0]);
  const [address, setAddress] = useState('');
  const [capacity, setCapacity] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [about, setAbout] = useState('');
  const [timings, setTimings] = useState('');
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);

  useEffect(() => {
    venuePartner
      .myListing()
      .then((v) => {
        setVenue(v);
        setName(v.name);
        setVtype(v.type);
        setAddress(v.address);
        setCapacity(String(v.capacity));
        setAmenities(v.amenities);
        setAbout(v.about);
        setTimings(v.timings ?? '');
        setGalleryUrls(v.galleryUrls ?? []);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load your listing'))
      .finally(() => setLoading(false));
  }, []);

  const toggleAmenity = (a: string) =>
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !(Number(capacity) > 0) || !about.trim()) {
      toast('Name, address, capacity and about are required');
      return;
    }
    setErr('');
    setSaving(true);
    try {
      const updated = await venuePartner.updateListing({
        name: name.trim(), type: vtype, address: address.trim(),
        capacity: Number(capacity), amenities, about: about.trim(), timings: timings.trim() || undefined,
        galleryUrls,
      });
      setVenue(updated);
      updateUser({ venueName: updated.name });
      toast('Listing updated ✓ changes are live');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to save listing');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="muted">Loading…</div>;

  if (!venue) {
    return (
      <div className="card">
        {err || 'Listing record not found.'} <Link to="/venue" className="link">← Back</Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24 }}>My listing</h1>
        <Link to={`/venues/${venue.id}`} className="link small bold">View public page ↗</Link>
      </div>
      <p className="muted small" style={{ margin: '4px 0 16px' }}>
        This is exactly what guests see in the directory and what organizers see when picking a venue.
      </p>

      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
      <form className="card" onSubmit={save}>
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
        {address.trim() && <MapEmbed query={`${address}, ${venue.city}`} />}
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
        <div className="field">
          <span>📷 Photos (up to 6) — shown in the guest directory and to organizers picking a venue</span>
          <RealGalleryUploadBox value={galleryUrls} onChange={setGalleryUrls} upload={venuePartner.upload} />
        </div>
        <button className="btn btn-pri btn-lg" disabled={saving}>{saving ? 'Saving…' : 'Save listing ✓'}</button>
        <span className="tiny muted-2" style={{ marginLeft: 10 }}>city changes go through support — keeps the directory clean</span>
      </form>
    </div>
  );
}
