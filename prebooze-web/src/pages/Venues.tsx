import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, VENUES } from '../data/mock';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import type { Venue, Event } from '../types';
import Poster from '../components/Poster';

const TYPE_PLACEHOLDER = 'Venue type';
// Offline fallback only — real vocabulary comes from GET /venue-types
// (Admin > Content > Venue types) below.
const TYPES_FALLBACK = [TYPE_PLACEHOLDER, 'Nightclub', 'Bar & lounge', 'Rooftop', 'Warehouse', 'Live-music hall', 'Comedy club', 'Banquet / open ground', 'Cafe & brewery'];
const CAPS = ['Capacity', 'Under 500', '500–2500', '2500+'];

export default function Venues() {
  const { city, favVenues, toggleFavVenue } = useApp();
  const [params] = useSearchParams();
  // Deep-link support for the #Hashtag venue-type links on VenueDetail.tsx
  // (?type=Nightclub) — falls back to the "no filter" placeholder otherwise.
  const [type, setType] = useState(params.get('type') || TYPE_PLACEHOLDER);
  const [cap, setCap] = useState(CAPS[0]);
  const [q, setQ] = useState('');

  const [liveVenues, setLiveVenues] = useState<Venue[] | null>(null);
  const [liveEvents, setLiveEvents] = useState<Event[] | null>(null);
  const [loading, setLoading] = useState(isBackendEnabled());
  useEffect(() => {
    if (!isBackendEnabled()) return;
    setLoading(true);
    Promise.all([catalog.venues(city), catalog.events({ city })])
      .then(([vs, evs]) => { setLiveVenues(vs); setLiveEvents(evs); })
      .catch(() => { setLiveVenues([]); setLiveEvents([]); })
      .finally(() => setLoading(false));
  }, [city]);

  const [liveTypeNames, setLiveTypeNames] = useState<string[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.venueTypes().then((rows) => setLiveTypeNames(rows.map((r) => r.name))).catch(() => setLiveTypeNames([]));
  }, []);
  const TYPES = [TYPE_PLACEHOLDER, ...(liveTypeNames ?? (isBackendEnabled() ? [] : TYPES_FALLBACK.slice(1)))];

  // Mock is only a stand-in for offline dev mode — never a "loading"
  // placeholder in production (see the equivalent note in Organizers.tsx).
  const venues = useMemo(() => {
    let list = liveVenues ?? (isBackendEnabled() ? [] : VENUES.filter((v) => v.city === city));
    if (q) list = list.filter((v) => v.name.toLowerCase().includes(q.toLowerCase()));
    // v.type is a comma-joined multi-select string (e.g. "Nightclub, Rooftop")
    // — match if the selected filter is one of the venue's types, not an
    // exact-equal on the whole string.
    if (type !== TYPE_PLACEHOLDER) list = list.filter((v) => v.type.split(',').map((t) => t.trim()).includes(type));
    if (cap === CAPS[1]) list = list.filter((v) => v.capacity < 500);
    if (cap === CAPS[2]) list = list.filter((v) => v.capacity >= 500 && v.capacity <= 2500);
    if (cap === CAPS[3]) list = list.filter((v) => v.capacity > 2500);
    return list;
  }, [liveVenues, q, type, cap, city]);

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
        {loading && <div className="tiny muted" style={{ marginBottom: 12 }}>Loading…</div>}

        <div className="grid-3">
          {venues.map((v) => {
            const count = (liveEvents ?? (isBackendEnabled() ? [] : EVENTS)).filter((e) => e.venueId === v.id && e.status === 'approved').length;
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
                <Poster hue={v.photoHue} emoji="🏛" label={v.galleryUrls?.[0] ? undefined : 'venue photo'} imageUrl={v.galleryUrls?.[0]} variant="landscape" alt={v.name} />
                {v.logoUrl && <img src={v.logoUrl} alt="" width={38} height={38} loading="lazy" decoding="async" className="ecard-logo" />}
                <div>
                  <h3>
                    {v.name} {v.verified && <span className="verified">✓</span>}
                  </h3>
                  <div className="meta">
                    {v.type} · {v.locality}
                  </div>
                  <div className="small accent bold">{count} upcoming event{count === 1 ? '' : 's'}</div>
                </div>
              </Link>
            );
          })}
        </div>
        {!loading && venues.length === 0 && <div className="empty">No venues match those filters.</div>}
      </div>
    </main>
  );
}
