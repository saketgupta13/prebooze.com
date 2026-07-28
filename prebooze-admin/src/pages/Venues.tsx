import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { AMENITY_PRESETS } from '../store/data';
import { fmt } from '../store/data';
import { CityFilterDropdown, EVENT_STATUS, GradientPhoto, Kpi, Tag } from '../components/ui';
import SeoFields, { emptySeo } from '../components/SeoFields';
import MapEmbed from '../components/MapEmbed';
import WysiwygEditor from '../components/WysiwygEditor';
import { liveVenues, liveEvents, liveVenueTypes, LiveApiError, type LiveVenue, type LiveEvent, type LiveVenueType } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import PlansAndSubscribers from '../components/PlansAndSubscribers';
import type { Seo } from '../types';

/** Chip-based amenities editor with presets + custom add. */
function AmenitiesEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [custom, setCustom] = useState('');
  const toggle = (a: string) => onChange(value.includes(a) ? value.filter((x) => x !== a) : [...value, a]);
  const options = [...new Set([...AMENITY_PRESETS, ...value])];
  return (
    <div className="field">
      <label>Amenities</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {options.map((a) => (
          <button key={a} type="button" className={`chip ${value.includes(a) ? 'on' : ''}`} onClick={() => toggle(a)}>
            {value.includes(a) ? '✓ ' : ''}{a}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="add a custom amenity…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (custom.trim() && !value.includes(custom.trim())) onChange([...value, custom.trim()]);
              setCustom('');
            }
          }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (custom.trim() && !value.includes(custom.trim())) onChange([...value, custom.trim()]);
            setCustom('');
          }}
        >
          + Add
        </button>
      </div>
    </div>
  );
}

/** Venue "type" tags — toggled from the real, admin-managed VenueType list
 * (Content > Venue types), not free text. Venue.type itself stays a plain
 * comma-joined string in the DB (same convention as Organizer.eventTypes),
 * this component only owns the array<->string conversion at its edges. */
function VenueTypeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [options, setOptions] = useState<LiveVenueType[]>([]);
  useEffect(() => { liveVenueTypes.list().then(setOptions).catch(() => setOptions([])); }, []);
  const selected = value.split(',').map((t) => t.trim()).filter(Boolean);
  const toggle = (name: string) => {
    const next = selected.includes(name) ? selected.filter((t) => t !== name) : [...selected, name];
    onChange(next.join(', '));
  };
  return (
    <div className="field">
      <label>Venue type</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map((t) => (
          <button key={t.name} type="button" className={`chip ${selected.includes(t.name) ? 'on' : ''}`} onClick={() => toggle(t.name)}>
            {selected.includes(t.name) ? '✓ ' : ''}{t.icon} {t.name}
          </button>
        ))}
        {options.length === 0 && <span className="tiny muted">No venue types configured yet — add some under Content &gt; Venue types.</span>}
      </div>
    </div>
  );
}

/** Instagram/Facebook inputs — same {instagram?, facebook?, other?: string[]}
 * shape as Organizer.socialLinks. `other` isn't exposed here (no admin need
 * for it yet); venue owners can still set it themselves via VenueListing.tsx. */
function SocialLinksEditor({ value, onChange }: { value: { instagram?: string; facebook?: string; other?: string[] } | null; onChange: (v: { instagram?: string; facebook?: string; other?: string[] }) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        className="input"
        value={value?.instagram ?? ''}
        onChange={(e) => onChange({ ...value, instagram: e.target.value })}
        placeholder="instagram.com/…"
      />
      <input
        className="input"
        value={value?.facebook ?? ''}
        onChange={(e) => onChange({ ...value, facebook: e.target.value })}
        placeholder="facebook.com/…"
      />
    </div>
  );
}

/** Real venue directory — Venue catalog rows (already-verified, or created
 * automatically at KYC onboard time, see VenueService.onboard and
 * KycService.approve). No delete endpoint exists (venues stay linked to
 * their event history), so the mock's "remove venue" button is dropped. */
export function Venues() {
  const session = useLiveSession();
  const { token } = session;
  const navigate = useNavigate();
  const [venues, setVenues] = useState<LiveVenue[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [city, setCity] = useState('All');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveVenues.list(), liveEvents.list()])
      .then(([v, e]) => { setVenues(v); setEvents(e); })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const cities = useMemo(() => [...new Set(venues.map((v) => v.city).filter(Boolean))].sort(), [venues]);
  const eventCount = (venueId: string) => events.filter((e) => e.venueId === venueId).length;

  const gate = useLiveGate('Venues', session);
  if (gate) return gate;

  const list = city === 'All' ? venues : venues.filter((v) => v.city === city);

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <LiveHeaderBar title="Venues" session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Venues</h1>
        <Link to="/venues/new" className="btn btn-pri">+ Add venue</Link>
      </div>
      <CityFilterDropdown value={city} onChange={setCity} cities={cities} />

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 560 }}>
          <span style={{ flex: 2 }}>Venue</span>
          <span style={{ flex: 1 }}>Capacity</span>
          <span style={{ flex: 0.9 }}>City</span>
          <span style={{ flex: 1 }}>Events</span>
          <span style={{ flex: 1.2 }}>License</span>
          <span style={{ flex: 1 }}>Status</span>
        </div>
        {list.map((v) => (
          <div
            key={v.id}
            className="trow clickable"
            style={{ minWidth: 560, background: !v.verified ? 'rgba(255,107,94,.06)' : undefined }}
            onClick={() => navigate(`/venues/${v.id}`)}
          >
            <span style={{ flex: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <GradientPhoto seed={v.photoHue} style={{ width: 42, height: 28, borderRadius: 5, flex: 'none', padding: 0 }} />
              {v.name}
            </span>
            <span style={{ flex: 1 }} className="muted">{fmt(v.capacity)}</span>
            <span style={{ flex: 0.9 }} className="muted">{v.city}</span>
            <span style={{ flex: 1 }}>{eventCount(v.id)}</span>
            <span style={{ flex: 1.2 }} className={v.verified ? 'muted' : 'red'}>{v.license || '—'}</span>
            <span style={{ flex: 1 }}>
              {v.verified ? <Tag label="Verified" cls="tag-green" /> : <Tag label="Docs pending" cls="tag-red" />}
            </span>
          </div>
        ))}
        {list.length === 0 && !loading && <div className="trow muted">No venues match.</div>}
      </div>
      <div className="tiny hint">venue detail: address + map pin, photos, license docs, contact person, house rules</div>

      <PlansAndSubscribers role="venue" roleLabel="Venue" />
    </div>
  );
}

export function VenueDetail() {
  const { id } = useParams();
  const session = useLiveSession();
  const { token } = session;
  const [venues, setVenues] = useState<LiveVenue[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveVenues.list(), liveEvents.list()])
      .then(([v, e]) => { setVenues(v); setEvents(e); })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const gate = useLiveGate('Venue detail', session);
  if (gate) return gate;

  const venue = venues.find((v) => v.id === id);

  if (!loading && !venue) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Venue not found</h1>
        <Link to="/venues" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Venues</Link>
      </div>
    );
  }
  if (!venue) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const here = events.filter((e) => e.venueId === venue.id);

  return (
    <div className="stack fade" style={{ maxWidth: 900, gap: 14 }}>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/venues" style={{ fontSize: 13 }}>← Venues</Link>
        <h1 className="display" style={{ fontSize: 18 }}>{venue.name}</h1>
        {venue.verified ? <Tag label="Verified" cls="tag-green" /> : <Tag label="Docs pending" cls="tag-red" />}
        <div style={{ flex: 1 }} />
        <Link to={`/venues/${venue.id}/edit`} className="btn btn-pri btn-sm">✎ Edit venue</Link>
      </div>
      {venue.address && <div className="small muted">{venue.address} · map pin set 📍</div>}

      <GradientPhoto seed={venue.photoHue} label={venue.name} style={{ height: 200 }} />

      <div className="kpi-grid">
        <Kpi label="Capacity" value={fmt(venue.capacity)} />
        <Kpi label="Events hosted" value={here.length} />
        <Kpi label="License" value={<span style={{ fontSize: 14 }}>{venue.license || '—'}</span>} alert={!venue.verified} />
      </div>

      <div className="dashed-box tiny" style={{ color: 'var(--muted)' }}>
        {venue.type ? `Type: ${venue.type} · ` : ''}Contact: {venue.contact || '—'} · house rules: {venue.rules || '—'}
      </div>
      {venue.amenities.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {venue.amenities.map((a) => <span key={a} className="tag tag-green">{a}</span>)}
        </div>
      )}

      <div className="tblwrap">
        <div className="display" style={{ fontWeight: 700, padding: '10px 14px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          Events at this venue
        </div>
        {here.map((ev) => (
          <div key={ev.id} className="trow" style={{ minWidth: 400 }}>
            <span style={{ flex: 2, fontWeight: 700 }}>{ev.title}</span>
            <span style={{ flex: 1 }} className="muted">{new Date(ev.date).toLocaleDateString('en-IN')}</span>
            <span style={{ flex: 1 }}><Tag {...(EVENT_STATUS[ev.status as keyof typeof EVENT_STATUS] ?? EVENT_STATUS.draft)} /></span>
          </div>
        ))}
        {here.length === 0 && !loading && <div className="trow muted">No events at this venue yet.</div>}
      </div>
    </div>
  );
}

export function AddVenue() {
  const session = useLiveSession();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [capacity, setCapacity] = useState('');
  const [type, setType] = useState('');
  const [vcity, setVcity] = useState('');
  const [contact, setContact] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPersonPhone, setContactPersonPhone] = useState('');
  const [socialLinks, setSocialLinks] = useState<{ instagram?: string; facebook?: string; other?: string[] } | null>(null);
  const [rules, setRules] = useState('');
  const [about, setAbout] = useState('');
  const [timings, setTimings] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);

  const gate = useLiveGate('Add venue', session);
  if (gate) return gate;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Enter a venue name'); return; }
    if (!vcity.trim()) { setErr('Enter a city'); return; }
    setSaving(true);
    setErr('');
    try {
      const created = await liveVenues.create({ name: name.trim(), city: vcity.trim(), address: address.trim() || undefined, capacity: capacity ? parseInt(capacity, 10) : undefined, type });
      await liveVenues.update(created.id, {
        contact: contact.trim() || undefined, rules: rules.trim() || undefined, about: about.trim() || undefined, timings: timings.trim() || undefined, amenities,
        contactPerson: contactPerson.trim() || undefined, contactPersonPhone: contactPersonPhone.trim() || undefined, socialLinks: socialLinks ?? undefined,
      });
      navigate('/venues');
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to save venue');
      setSaving(false);
    }
  };

  return (
    <form className="stack fade" style={{ maxWidth: 520 }} onSubmit={submit}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/venues" style={{ fontSize: 13 }}>← Venues</Link>
        <h1 className="page-title">Add new venue</h1>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Venue name" autoFocus />
      <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address / map pin 📍" />
      <MapEmbed query={`${address}, ${vcity}`} />
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Capacity" inputMode="numeric" />
        <input className="input" value={vcity} onChange={(e) => setVcity(e.target.value)} placeholder="City" />
      </div>
      <VenueTypeEditor value={type} onChange={setType} />
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Contact person name" />
        <input className="input" value={contactPersonPhone} onChange={(e) => setContactPersonPhone(e.target.value)} placeholder="Contact person phone" />
      </div>
      <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Business contact email" />
      <input className="input" value={rules} onChange={(e) => setRules(e.target.value)} placeholder="House rules / notes" />
      <div className="card" style={{ padding: 12 }}>
        <div className="tiny" style={{ fontWeight: 700, marginBottom: 6 }}>🕒 Timings</div>
        <input className="input" value={timings} onChange={(e) => setTimings(e.target.value)} placeholder="e.g. Wed–Sun · 8 PM – 1 AM" />
      </div>
      <div className="card" style={{ padding: 12 }}>
        <div className="tiny" style={{ fontWeight: 700, marginBottom: 6 }}>ℹ️ About the venue</div>
        <WysiwygEditor value={about} onChange={setAbout} minHeight={60} />
      </div>
      <div className="card" style={{ padding: 12 }}>
        <div className="tiny" style={{ fontWeight: 700, marginBottom: 6 }}>🔗 Social media</div>
        <SocialLinksEditor value={socialLinks} onChange={setSocialLinks} />
      </div>
      <AmenitiesEditor value={amenities} onChange={setAmenities} />
      <button type="submit" className="btn btn-pri" style={{ padding: 10, fontSize: 13 }} disabled={saving}>{saving ? 'Saving…' : 'Save venue'}</button>
      <div className="tiny red">new venue starts as "Docs pending" until verified</div>
    </form>
  );
}

/** Edit venue — same form as Add venue (the venue onboarding flow), prefilled. */
export function EditVenue() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useLiveSession();
  const { token } = session;

  const [venue, setVenue] = useState<LiveVenue | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [capacity, setCapacity] = useState('');
  const [type, setType] = useState('');
  const [contact, setContact] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPersonPhone, setContactPersonPhone] = useState('');
  const [socialLinks, setSocialLinks] = useState<{ instagram?: string; facebook?: string; other?: string[] } | null>(null);
  const [rules, setRules] = useState('');
  const [about, setAbout] = useState('');
  const [timings, setTimings] = useState('');
  const [verified, setVerified] = useState(false);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [seo, setSeo] = useState<Seo>(emptySeo());
  const [venueCity, setVenueCity] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveVenues
      .list()
      .then((venues) => {
        const v = venues.find((x) => x.id === id);
        setVenue(v ?? null);
        if (v) {
          setName(v.name);
          setAddress(v.address);
          setCapacity(String(v.capacity));
          setType(v.type || 'Indoor');
          setContact(v.contact ?? '');
          setContactPerson(v.contactPerson ?? '');
          setContactPersonPhone(v.contactPersonPhone ?? '');
          setSocialLinks(v.socialLinks ?? null);
          setRules(v.rules ?? '');
          setAbout(v.about ?? '');
          setTimings(v.timings ?? '');
          setVerified(v.verified);
          setAmenities(v.amenities);
          setSeo((v.seo as Seo | null) ?? emptySeo());
          setVenueCity(v.city);
        }
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token, id]);

  const gate = useLiveGate('Edit venue', session);
  if (gate) return gate;

  if (!loading && !venue) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Venue not found</h1>
        <Link to="/venues" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Venues</Link>
      </div>
    );
  }
  if (!venue) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Venue name is required'); return; }
    try {
      await liveVenues.update(venue.id, {
        name: name.trim(),
        address: address.trim(),
        capacity: parseInt(capacity, 10) || venue.capacity,
        type,
        contact: contact.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        contactPersonPhone: contactPersonPhone.trim() || undefined,
        socialLinks: socialLinks ?? undefined,
        rules: rules.trim() || undefined,
        about: about.trim() || undefined,
        timings: timings.trim() || undefined,
        amenities,
        seo,
      });
      if (verified !== venue.verified) await liveVenues.setVerified(venue.id, verified);
      navigate(`/venues/${venue.id}`);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to save');
    }
  };

  return (
    <form className="stack fade" style={{ maxWidth: 520 }} onSubmit={submit}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to={`/venues/${venue.id}`} style={{ fontSize: 13 }}>← {venue.name}</Link>
        <h1 className="page-title">Edit venue</h1>
        {venue.verified ? <Tag label="Verified" cls="tag-green" /> : <Tag label="Docs pending" cls="tag-red" />}
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      <div className="field">
        <label>Venue name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Address / map pin 📍</label>
        <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <MapEmbed query={`${address}, ${venueCity}`} />
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Capacity</label>
          <input className="input" value={capacity} onChange={(e) => setCapacity(e.target.value)} inputMode="numeric" />
        </div>
      </div>
      <VenueTypeEditor value={type} onChange={setType} />
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Contact person name</label>
          <input className="input" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Contact person phone</label>
          <input className="input" value={contactPersonPhone} onChange={(e) => setContactPersonPhone(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Business contact email</label>
        <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      <div className="field">
        <label>House rules / notes</label>
        <input className="input" value={rules} onChange={(e) => setRules(e.target.value)} />
      </div>
      <div className="field">
        <label>🕒 Timings</label>
        <input className="input" value={timings} onChange={(e) => setTimings(e.target.value)} placeholder="e.g. Wed–Sun · 8 PM – 1 AM" />
      </div>
      <div className="field">
        <label>ℹ️ About the venue</label>
        <WysiwygEditor value={about} onChange={setAbout} minHeight={60} />
      </div>
      <div className="card" style={{ padding: 12 }}>
        <div className="tiny" style={{ fontWeight: 700, marginBottom: 6 }}>🔗 Social media</div>
        <SocialLinksEditor value={socialLinks} onChange={setSocialLinks} />
      </div>
      <AmenitiesEditor value={amenities} onChange={setAmenities} />
      <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={verified} onChange={() => setVerified((v) => !v)} style={{ accentColor: 'var(--green)' }} />
        Verified venue ✓ (license/permit docs on file)
      </label>
      <SeoFields
        seo={seo}
        onChange={setSeo}
        slug={'/venues/' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
        fallbackTitle={`${name || 'Venue'} — events & tickets`}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>Save venue</button>
        <Link to={`/venues/${venue.id}`} className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
