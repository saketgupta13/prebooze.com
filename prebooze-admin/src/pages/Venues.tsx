import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { ADMIN_CITIES, AMENITY_PRESETS } from '../store/data';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { EVENT_STATUS, GradientPhoto, Kpi, Tag } from '../components/ui';
import SeoFields, { emptySeo } from '../components/SeoFields';

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

export function Venues() {
  const { venues, removeVenue } = useAdmin();
  const navigate = useNavigate();
  const [city, setCity] = useState('All');
  const cities = ['All', ...new Set(venues.map((v) => v.city))];
  const list = city === 'All' ? venues : venues.filter((v) => v.city === city);

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <div className="page-hd">
        <h1 className="page-title">Venues</h1>
        <Link to="/venues/new" className="btn btn-pri">+ Add venue</Link>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {cities.map((c) => (
          <button key={c} className={`chip ${city === c ? 'on' : ''}`} onClick={() => setCity(c)}>{c}</button>
        ))}
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 560 }}>
          <span style={{ flex: 2 }}>Venue</span>
          <span style={{ flex: 1 }}>Capacity</span>
          <span style={{ flex: 0.9 }}>City</span>
          <span style={{ flex: 1 }}>Events</span>
          <span style={{ flex: 1.2 }}>License</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ width: 34 }} />
        </div>
        {list.map((v) => (
          <div
            key={v.id}
            className="trow clickable"
            style={{ minWidth: 560, background: !v.verified ? 'rgba(255,107,94,.06)' : undefined }}
            onClick={() => navigate(`/venues/${v.id}`)}
          >
            <span style={{ flex: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <GradientPhoto seed={v.name.length * 7 + v.name.charCodeAt(0)} style={{ width: 42, height: 28, borderRadius: 5, flex: 'none', padding: 0 }} />
              {v.name}
            </span>
            <span style={{ flex: 1 }} className="muted">{typeof v.capacity === 'number' ? fmt(v.capacity) : v.capacity}</span>
            <span style={{ flex: 0.9 }} className="muted">{v.city}</span>
            <span style={{ flex: 1 }}>{v.events}</span>
            <span style={{ flex: 1.2 }} className={v.verified ? 'muted' : 'red'}>{v.license}</span>
            <span style={{ flex: 1 }}>
              {v.verified ? <Tag label="Verified" cls="tag-green" /> : <Tag label="Docs pending" cls="tag-red" />}
            </span>
            <span style={{ width: 34, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-danger btn-sm"
                style={{ padding: '2px 7px' }}
                title="Remove venue"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Remove ${v.name}? Events at this venue keep their records.`)) removeVenue(v.id);
                }}
              >
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="tiny hint">venue detail: address + map pin, photos, license docs, contact person, house rules</div>
    </div>
  );
}

/** Photo slider — cycles all venue images with ‹ › controls and dots. */
function VenueSlider({ name }: { name: string }) {
  const photos = [
    { seed: name.charCodeAt(0) * 3, label: `${name} — main hall` },
    { seed: name.charCodeAt(0) * 3 + 11, label: 'stage' },
    { seed: name.charCodeAt(0) * 3 + 23, label: 'bar' },
    { seed: name.charCodeAt(0) * 3 + 37, label: 'entry' },
    { seed: name.charCodeAt(0) * 3 + 51, label: 'crowd' },
  ];
  const [idx, setIdx] = useState(0);
  const go = (d: number) => setIdx((i) => (i + d + photos.length) % photos.length);
  return (
    <div style={{ position: 'relative' }}>
      <GradientPhoto seed={photos[idx].seed} label={`${photos[idx].label} · ${idx + 1}/${photos.length}`} style={{ height: 200 }} />
      <button
        onClick={() => go(-1)}
        className="btn btn-ghost btn-sm"
        style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(11,12,7,.7)' }}
      >
        ‹
      </button>
      <button
        onClick={() => go(1)}
        className="btn btn-ghost btn-sm"
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(11,12,7,.7)' }}
      >
        ›
      </button>
      <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
        {photos.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`photo ${i + 1}`}
            style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', background: i === idx ? 'var(--green)' : 'rgba(241,243,234,.35)' }}
          />
        ))}
      </div>
    </div>
  );
}

export function VenueDetail() {
  const { id } = useParams();
  const { venues, events } = useAdmin();
  const venue = venues.find((v) => v.id === id);

  if (!venue) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Venue not found</h1>
        <Link to="/venues" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Venues</Link>
      </div>
    );
  }

  const here = events.filter((e) => e.venue === venue.name);

  return (
    <div className="stack fade" style={{ maxWidth: 900, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/venues" style={{ fontSize: 13 }}>← Venues</Link>
        <h1 className="display" style={{ fontSize: 18 }}>{venue.name}</h1>
        {venue.verified ? <Tag label="Verified" cls="tag-green" /> : <Tag label="Docs pending" cls="tag-red" />}
        <div style={{ flex: 1 }} />
        <Link to={`/venues/${venue.id}/edit`} className="btn btn-pri btn-sm">✎ Edit venue</Link>
      </div>
      {venue.address && <div className="small muted">{venue.address} · map pin set 📍</div>}

      <VenueSlider name={venue.name} />

      <div className="kpi-grid">
        <Kpi label="Capacity" value={typeof venue.capacity === 'number' ? fmt(venue.capacity) : venue.capacity} />
        <Kpi label="Events hosted" value={venue.events} />
        <Kpi label="License" value={<span style={{ fontSize: 14 }}>{venue.license}</span>} alert={!venue.verified} />
      </div>

      <div className="dashed-box tiny" style={{ color: 'var(--muted)' }}>
        {venue.type ? `Type: ${venue.type} · ` : ''}Contact: {venue.contact ?? '—'} · house rules: {venue.rules ?? '—'}
      </div>
      {(venue.amenities ?? []).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(venue.amenities ?? []).map((a) => (
            <span key={a} className="tag tag-green">{a}</span>
          ))}
        </div>
      )}

      <div className="tblwrap">
        <div className="display" style={{ fontWeight: 700, padding: '10px 14px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          Events at this venue
        </div>
        {here.map((ev) => (
          <div key={ev.id} className="trow" style={{ minWidth: 400 }}>
            <span style={{ flex: 2, fontWeight: 700 }}>{ev.title}</span>
            <span style={{ flex: 1 }} className="muted">{ev.date}</span>
            <span style={{ flex: 1 }}><Tag {...EVENT_STATUS[ev.status]} /></span>
          </div>
        ))}
        {here.length === 0 && <div className="trow muted">No events at this venue yet.</div>}
      </div>
    </div>
  );
}

export function AddVenue() {
  const { addVenue, toast } = useAdmin();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [capacity, setCapacity] = useState('');
  const [type, setType] = useState('Indoor');
  const [vcity, setVcity] = useState('Austin');
  const [contact, setContact] = useState('');
  const [rules, setRules] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [docs, setDocs] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Enter a venue name');
      return;
    }
    addVenue({
      id: 'v' + Date.now(),
      name: name.trim(),
      city: vcity,
      amenities,
      capacity: capacity ? parseInt(capacity, 10) || capacity : '—',
      events: 0,
      license: docs ? 'under review' : 'docs pending',
      verified: false,
      address: address.trim() || undefined,
    });
    navigate('/venues');
  };

  return (
    <form className="stack fade" style={{ maxWidth: 520 }} onSubmit={submit}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/venues" style={{ fontSize: 13 }}>← Venues</Link>
        <h1 className="page-title">Add new venue</h1>
      </div>
      <div className="ph" style={{ height: 80, borderRadius: 10 }}>+ upload venue photos</div>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Venue name" autoFocus />
      <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address / map pin 📍" />
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Capacity" inputMode="numeric" />
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option>Indoor</option>
          <option>Outdoor</option>
          <option>Rooftop</option>
          <option>Warehouse</option>
        </select>
        <select className="input" value={vcity} onChange={(e) => setVcity(e.target.value)}>
          {ADMIN_CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact person + phone" />
      <input className="input" value={rules} onChange={(e) => setRules(e.target.value)} placeholder="House rules / notes" />
      <AmenitiesEditor value={amenities} onChange={setAmenities} />
      <button
        type="button"
        className="dashed-box"
        style={{ background: 'none', textAlign: 'left', color: docs ? 'var(--green)' : 'var(--muted)', fontSize: 11.5, cursor: 'pointer' }}
        onClick={() => setDocs((d) => !d)}
      >
        {docs
          ? '✓ License / permit docs attached'
          : '+ upload license / permit docs — required before venue is marked Verified'}
      </button>
      <button type="submit" className="btn btn-pri" style={{ padding: 10, fontSize: 13 }}>Save venue</button>
      <div className="tiny red">new venue starts as "Docs pending" until license reviewed</div>
    </form>
  );
}


/** Edit venue — same form as Add venue (the venue onboarding flow), prefilled. */
export function EditVenue() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { venues, updateVenue, toast } = useAdmin();
  const venue = venues.find((v) => v.id === id);

  const [name, setName] = useState(venue?.name ?? '');
  const [address, setAddress] = useState(venue?.address ?? '');
  const [capacity, setCapacity] = useState(String(venue?.capacity ?? ''));
  const [type, setType] = useState(venue?.type ?? 'Indoor');
  const [contact, setContact] = useState(venue?.contact ?? '');
  const [rules, setRules] = useState(venue?.rules ?? '');
  const [docs, setDocs] = useState(venue?.verified ?? false);
  const [amenities, setAmenities] = useState<string[]>(venue?.amenities ?? []);
  const [seo, setSeo] = useState(venue?.seo ?? emptySeo());

  if (!venue) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Venue not found</h1>
        <Link to="/venues" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Venues</Link>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Venue name is required');
      return;
    }
    updateVenue(venue.id, {
      name: name.trim(),
      address: address.trim() || undefined,
      capacity: parseInt(capacity, 10) || venue.capacity,
      type,
      contact: contact.trim() || undefined,
      rules: rules.trim() || undefined,
      verified: docs,
      license: docs ? venue.license.replace('docs pending', 'under review') : venue.license,
      amenities,
      seo,
    });
    navigate(`/venues/${venue.id}`);
  };

  return (
    <form className="stack fade" style={{ maxWidth: 520 }} onSubmit={submit}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to={`/venues/${venue.id}`} style={{ fontSize: 13 }}>← {venue.name}</Link>
        <h1 className="page-title">Edit venue</h1>
        {venue.verified ? <Tag label="Verified" cls="tag-green" /> : <Tag label="Docs pending" cls="tag-red" />}
      </div>
      <div className="ph" style={{ height: 80, borderRadius: 10 }}>venue photos — 4 uploaded · + add more</div>
      <div className="field">
        <label>Venue name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Address / map pin 📍</label>
        <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Capacity</label>
          <input className="input" value={capacity} onChange={(e) => setCapacity(e.target.value)} inputMode="numeric" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option>Indoor</option>
            <option>Outdoor</option>
            <option>Rooftop</option>
            <option>Warehouse</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Contact person + phone</label>
        <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      <div className="field">
        <label>House rules / notes</label>
        <input className="input" value={rules} onChange={(e) => setRules(e.target.value)} />
      </div>
      <AmenitiesEditor value={amenities} onChange={setAmenities} />
      <button
        type="button"
        className="dashed-box"
        style={{ background: 'none', textAlign: 'left', color: docs ? 'var(--green)' : 'var(--muted)', fontSize: 11.5, cursor: 'pointer' }}
        onClick={() => setDocs((d) => !d)}
      >
        {docs ? '✓ License / permit docs on file — venue Verified' : '+ upload license / permit docs — required before venue is marked Verified'}
      </button>
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
