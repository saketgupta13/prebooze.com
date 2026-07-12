import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { EVENT_STATUS, GradientPhoto, Kpi, Tag } from '../components/ui';
import SeoFields, { emptySeo } from '../components/SeoFields';

export function Venues() {
  const { venues } = useAdmin();
  const navigate = useNavigate();

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <div className="page-hd">
        <h1 className="page-title">Venues</h1>
        <Link to="/venues/new" className="btn btn-pri">+ Add venue</Link>
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 560 }}>
          <span style={{ flex: 2 }}>Venue</span>
          <span style={{ flex: 1 }}>Capacity</span>
          <span style={{ flex: 1 }}>Events</span>
          <span style={{ flex: 1.2 }}>License</span>
          <span style={{ flex: 1 }}>Status</span>
        </div>
        {venues.map((v) => (
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
            <span style={{ flex: 1 }}>{v.events}</span>
            <span style={{ flex: 1.2 }} className={v.verified ? 'muted' : 'red'}>{v.license}</span>
            <span style={{ flex: 1 }}>
              {v.verified ? <Tag label="Verified" cls="tag-green" /> : <Tag label="Docs pending" cls="tag-red" />}
            </span>
          </div>
        ))}
      </div>
      <div className="tiny hint">venue detail: address + map pin, photos, license docs, contact person, house rules</div>
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

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '70px 70px', gap: 8 }}>
        <GradientPhoto seed={venue.name.charCodeAt(0) * 3} label={`${venue.name} — main hall`} style={{ gridRow: '1 / 3', height: '100%' }} />
        <GradientPhoto seed={venue.name.charCodeAt(0) * 3 + 11} label="stage" />
        <GradientPhoto seed={venue.name.charCodeAt(0) * 3 + 23} label="bar" />
        <GradientPhoto seed={venue.name.charCodeAt(0) * 3 + 37} label="entry" />
        <GradientPhoto seed={venue.name.charCodeAt(0) * 3 + 51} label="crowd" />
      </div>

      <div className="kpi-grid">
        <Kpi label="Capacity" value={typeof venue.capacity === 'number' ? fmt(venue.capacity) : venue.capacity} />
        <Kpi label="Events hosted" value={venue.events} />
        <Kpi label="License" value={<span style={{ fontSize: 14 }}>{venue.license}</span>} alert={!venue.verified} />
      </div>

      <div className="dashed-box tiny" style={{ color: 'var(--muted)' }}>
        {venue.type ? `Type: ${venue.type} · ` : ''}Contact: {venue.contact ?? '—'} · house rules: {venue.rules ?? '—'}
      </div>

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
  const [contact, setContact] = useState('');
  const [rules, setRules] = useState('');
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
      </div>
      <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact person + phone" />
      <input className="input" value={rules} onChange={(e) => setRules(e.target.value)} placeholder="House rules / notes" />
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
