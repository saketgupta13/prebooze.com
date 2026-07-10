import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, VENUES } from '../data/mock';
import Poster from '../components/Poster';

const LOCALITIES = ['Locality', 'Downtown', 'East Side', 'Riverside', 'South Congress'];
const TYPES = ['Venue type', 'Concert hall', 'Club', 'Rooftop bar', 'Open-air', 'Warehouse'];
const CAPS = ['Capacity', 'Under 500', '500–2500', '2500+'];

export default function Venues() {
  const { city } = useApp();
  const [loc, setLoc] = useState(LOCALITIES[0]);
  const [type, setType] = useState(TYPES[0]);
  const [cap, setCap] = useState(CAPS[0]);
  const [q, setQ] = useState('');

  const venues = useMemo(() => {
    let list = VENUES;
    if (q) list = list.filter((v) => v.name.toLowerCase().includes(q.toLowerCase()));
    if (loc !== LOCALITIES[0]) list = list.filter((v) => v.locality === loc);
    if (type !== TYPES[0]) list = list.filter((v) => v.type === type);
    if (cap === CAPS[1]) list = list.filter((v) => v.capacity < 500);
    if (cap === CAPS[2]) list = list.filter((v) => v.capacity >= 500 && v.capacity <= 2500);
    if (cap === CAPS[3]) list = list.filter((v) => v.capacity > 2500);
    return list;
  }, [q, loc, type, cap]);

  const cycle = (options: string[], current: string, set: (v: string) => void) => () => {
    set(options[(options.indexOf(current) + 1) % options.length]);
  };

  return (
    <main className="page">
      <div className="container">
        <div className="chip-row" style={{ marginBottom: 20 }}>
          <input
            placeholder="🔍 Search venues…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 240, borderRadius: 999 }}
          />
          <button className={`chip ${loc !== LOCALITIES[0] ? 'on' : ''}`} onClick={cycle(LOCALITIES, loc, setLoc)}>
            {loc} {loc !== LOCALITIES[0] ? '✕' : '▾'}
          </button>
          <button className={`chip ${type !== TYPES[0] ? 'on' : ''}`} onClick={cycle(TYPES, type, setType)}>
            {type} ▾
          </button>
          <button className={`chip ${cap !== CAPS[0] ? 'on' : ''}`} onClick={cycle(CAPS, cap, setCap)}>
            {cap} ▾
          </button>
        </div>

        <h1 style={{ fontSize: 21, marginBottom: 18 }}>
          {venues.length} venue{venues.length === 1 ? '' : 's'} in{' '}
          <span className="accent">
            {loc !== LOCALITIES[0] ? `${loc}, ` : ''}
            {city}
          </span>
        </h1>

        <div className="grid-3">
          {venues.map((v) => {
            const count = EVENTS.filter((e) => e.venueId === v.id && e.status === 'approved').length;
            return (
              <Link key={v.id} to={`/venues/${v.id}`} className="ecard">
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
