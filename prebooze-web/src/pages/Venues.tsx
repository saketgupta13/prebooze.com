import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, VENUES } from '../data/mock';
import Poster from '../components/Poster';

const TYPES = ['Venue type', 'Concert hall', 'Club', 'Rooftop bar', 'Open-air', 'Warehouse'];
const CAPS = ['Capacity', 'Under 500', '500–2500', '2500+'];

export default function Venues() {
  const { city, favVenues, toggleFavVenue } = useApp();
  const [type, setType] = useState(TYPES[0]);
  const [cap, setCap] = useState(CAPS[0]);
  const [q, setQ] = useState('');

  const venues = useMemo(() => {
    let list = VENUES.filter((v) => v.city === city);
    if (q) list = list.filter((v) => v.name.toLowerCase().includes(q.toLowerCase()));
    if (type !== TYPES[0]) list = list.filter((v) => v.type === type);
    if (cap === CAPS[1]) list = list.filter((v) => v.capacity < 500);
    if (cap === CAPS[2]) list = list.filter((v) => v.capacity >= 500 && v.capacity <= 2500);
    if (cap === CAPS[3]) list = list.filter((v) => v.capacity > 2500);
    return list;
  }, [q, type, cap, city]);

  return (
    <main className="page">
      <div className="container">
        <div className="chip-row" style={{ marginBottom: 20, gap: 10, alignItems: 'center' }}>
          <input
            placeholder="🔍 Search venues…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 240, borderRadius: 999 }}
          />
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: 'auto' }}>
            {TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={cap} onChange={(e) => setCap(e.target.value)} style={{ width: 'auto' }}>
            {CAPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <h1 style={{ fontSize: 21, marginBottom: 18 }}>
          {venues.length} venue{venues.length === 1 ? '' : 's'} in <span className="accent">{city}</span>
        </h1>

        <div className="grid-3">
          {venues.map((v) => {
            const count = EVENTS.filter((e) => e.venueId === v.id && e.status === 'approved').length;
            const fav = favVenues.includes(v.id);
            return (
              <Link key={v.id} to={`/venues/${v.id}`} className="ecard" style={{ position: 'relative' }}>
                <button
                  aria-label={fav ? 'Remove favourite' : 'Add favourite'}
                  title={fav ? 'Remove favourite' : 'Favourite this venue'}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavVenue(v.id); }}
                  style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: 'rgba(0,0,0,.45)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {fav ? '❤️' : '🤍'}
                </button>
                <Poster hue={v.photoHue} emoji="🏛" label="venue photo" variant="landscape" />
                <div>
                  <h3>
                    {v.name} {v.verified && <span className="verified">✓</span>}
                  </h3>
                  <div className="meta">
                    {v.type} · {v.locality}
                  </div>
                  <div className="small accent bold">{count || 2} upcoming events</div>
                </div>
              </Link>
            );
          })}
        </div>
        {venues.length === 0 && <div className="empty">No venues match those filters.</div>}
      </div>
    </main>
  );
}
