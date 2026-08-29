import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import MapEmbed from '../../components/MapEmbed';
import WysiwygEditor from '../../components/WysiwygEditor';
import { RealGalleryUploadBox, RealUploadBox } from '../../components/RealUploadBox';
import Loader from '../../components/Loader';
import LocationPicker, { emptyLocation, type LocationValue } from '../../components/LocationPicker';
import { venuePartner, catalog } from '../../api';
import { ApiError, isBackendEnabled } from '../../api/client';
import type { Venue } from '../../types';
import { venuePath } from '../../lib/urls';

// Offline fallback only — see the live fetch below.
const VENUE_TYPES_FALLBACK = ['Nightclub', 'Bar & lounge', 'Rooftop', 'Warehouse', 'Live-music hall', 'Comedy club', 'Banquet / open ground', 'Cafe & brewery'];
const AMENITIES = ['Parking', 'Smoking area', 'Dance floor', 'Live sound rig', 'VIP tables', 'Outdoor seating', 'Food & kitchen', 'Full bar', 'Wheelchair access', 'Valet'];

/** Venue.type is stored as a comma-joined string (same convention as
 * Organizer.eventTypes) so multi-select needs no schema change — split for
 * editing, join back on save. Tolerates a legacy single-value or an unknown
 * custom type by keeping whatever's already there even if it's not in the
 * fixed VENUE_TYPES list. */
const splitTypes = (s: string) => s.split(',').map((t) => t.trim()).filter(Boolean);

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
  const [vtypes, setVtypes] = useState<string[]>([VENUE_TYPES_FALLBACK[0]]);
  const [loc, setLoc] = useState<LocationValue>(emptyLocation());
  const [pendingCity, setPendingCity] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [capacity, setCapacity] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [about, setAbout] = useState('');
  const [timings, setTimings] = useState('');
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
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

  useEffect(() => {
    venuePartner
      .myListing()
      .then((v) => {
        setVenue(v);
        setName(v.name);
        setVtypes(splitTypes(v.type));
        setLoc({ country: v.country ?? 'India', state: v.state ?? '', city: v.city, pincode: v.pincode ?? '' });
        setPendingCity(v.pendingCity ?? null);
        setAddress(v.address);
        setCapacity(String(v.capacity));
        setAmenities(v.amenities);
        setAbout(v.about);
        setTimings(v.timings ?? '');
        setGalleryUrls(v.galleryUrls ?? []);
        setLogoUrl(v.logoUrl ?? null);
        setContactPerson(v.contactPerson ?? '');
        setContactPersonPhone(v.contactPersonPhone ?? '');
        setInstagram(v.socialLinks?.instagram ?? '');
        setFacebook(v.socialLinks?.facebook ?? '');
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load your listing'))
      .finally(() => setLoading(false));
  }, []);

  const toggleAmenity = (a: string) =>
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  const toggleVtype = (t: string) =>
    setVtypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !(Number(capacity) > 0) || !about.trim() || vtypes.length === 0) {
      toast('Name, venue type, address, capacity and about are required');
      return;
    }
    if (logoUploading || galleryUploading) { toast('Media is still uploading — wait for it to finish before saving'); return; }
    setErr('');
    setSaving(true);
    try {
      // City is sent like every other field, but the backend never applies
      // it directly — a changed city lands in `pendingCity` for admin to
      // approve (VenueService.updateListing), so `updated.city` may still
      // equal the old value here even on a fully successful save.
      const updated = await venuePartner.updateListing({
        name: name.trim(), type: vtypes.join(', '), address: address.trim(),
        city: loc.city, state: loc.state || undefined, country: loc.country || undefined, pincode: loc.pincode || undefined,
        capacity: Number(capacity), amenities, about: about.trim(), timings: timings.trim() || undefined,
        galleryUrls, logoUrl: logoUrl || undefined,
        contactPerson: contactPerson.trim() || undefined,
        contactPersonPhone: contactPersonPhone.trim() || undefined,
        socialLinks: (instagram.trim() || facebook.trim()) ? { instagram: instagram.trim() || undefined, facebook: facebook.trim() || undefined } : undefined,
      });
      setVenue(updated);
      setPendingCity(updated.pendingCity ?? null);
      updateUser({ venueName: updated.name });
      toast(
        updated.pendingCity
          ? `Listing updated ✓ — city change to ${updated.pendingCity} is pending admin approval`
          : 'Listing updated ✓ changes are live'
      );
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to save listing');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

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
        <Link to={venuePath(venue.city, venue.id)} className="link small bold">View public page ↗</Link>
      </div>
      <p className="muted small" style={{ margin: '4px 0 16px' }}>
        This is exactly what guests see in the directory and what organizers see when picking a venue.
      </p>

      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
      <form className="card" onSubmit={save}>
        <div className="field">
          <span>Venue name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <span>Venue type — pick all that apply</span>
          <div className="chip-row">
            {[...new Set([...VENUE_TYPES, ...vtypes])].map((t) => (
              <button type="button" key={t} className={`chip ${vtypes.includes(t) ? 'on' : ''}`} onClick={() => toggleVtype(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Logo — shown next to your venue name in the directory</span>
          <RealUploadBox value={logoUrl} onChange={setLogoUrl} upload={venuePartner.upload} onBusyChange={setLogoUploading} label="⬆ upload logo" doneLabel="✓ Logo uploaded — click to replace" style={{ height: 100, width: 100 }} />
        </div>
        {pendingCity && (
          <div className="dashed-box" style={{ border: '1.5px dashed var(--accent)', borderRadius: 10, padding: '8px 10px', fontSize: 12.5, marginBottom: 12 }}>
            🏙 City change requested: <b>{venue.city} → {pendingCity}</b> — awaiting admin approval. Your listing still shows <b>{venue.city}</b> until it's approved.
          </div>
        )}
        <LocationPicker value={loc} onChange={setLoc} />
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
        <div className="form-row">
          <div className="field">
            <span>Contact person name</span>
            <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </div>
          <div className="field">
            <span>Contact person phone</span>
            <input value={contactPersonPhone} onChange={(e) => setContactPersonPhone(e.target.value)} inputMode="tel" />
          </div>
        </div>
        <div className="field">
          <span>Social media — shown on your public venue page</span>
          <div className="form-row">
            <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="instagram.com/yourvenue" />
            <input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="facebook.com/yourvenue" />
          </div>
        </div>
        <div className="field">
          <span>📷 Photos (up to 6) — shown in the guest directory and to organizers picking a venue</span>
          <RealGalleryUploadBox value={galleryUrls} onChange={setGalleryUrls} upload={venuePartner.upload} onBusyChange={setGalleryUploading} />
        </div>
        <button className="btn btn-pri btn-lg" disabled={saving || logoUploading || galleryUploading}>{(logoUploading || galleryUploading) ? 'Uploading…' : saving ? 'Saving…' : 'Save listing ✓'}</button>
        <span className="tiny muted-2" style={{ marginLeft: 10 }}>changing city needs admin approval — everything else here is live immediately</span>
      </form>
    </div>
  );
}
