import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, VENUES } from '../data/mock';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import type { Event, Venue } from '../types';
import EventCard from '../components/EventCard';
import Poster from '../components/Poster';
import { Heart, Landmark } from 'lucide-react';
import { cityBrowse, cityVenues, venuePath } from '../lib/urls';
import { todaysVenueHours } from '../lib/venueTimings';

/** Saved events — the guest's wishlist. Wishlist/favourite membership itself
 * is still local-only (see AppContext) — this just makes sure a real event
 * or venue the guest saved actually resolves to something instead of
 * silently vanishing because it isn't in the local mock seed. */
export default function Wishlist() {
  const { wishlist, myEvents, favVenues, toggleFavVenue, city } = useApp();

  const [liveEvents, setLiveEvents] = useState<Event[] | null>(null);
  const [liveVenues, setLiveVenues] = useState<Venue[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.events({}).then(setLiveEvents).catch(() => setLiveEvents([]));
    catalog.venues().then(setLiveVenues).catch(() => setLiveVenues([]));
  }, []);
  const loading = isBackendEnabled() && (liveEvents === null || liveVenues === null);

  // EVENTS/VENUES (mock) were included unconditionally, with no
  // isBackendEnabled() gate — a real saved event/venue can't resolve
  // against them (real ids aren't in the mock seed), so while the live
  // fetch was in flight, `saved` was empty and the page flashed "Nothing
  // saved yet" for a guest who genuinely has saved items.
  const all = [...myEvents, ...(isBackendEnabled() ? [] : EVENTS), ...(liveEvents ?? [])];
  const saved = wishlist.map((id) => all.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e);
  const venuePool = [...(isBackendEnabled() ? [] : VENUES), ...(liveVenues ?? [])];

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/profile">Profile</Link> / Wishlist
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>My wishlist <Heart size={22} fill="currentColor" /></h1>
        <p className="muted" style={{ marginBottom: 22 }}>
          Events you've saved for later — tap the heart on any event to add it here.
        </p>

        {loading ? (
          <div className="tiny muted">Loading…</div>
        ) : saved.length === 0 ? (
          <div className="empty">
            Nothing saved yet. <Link to={cityBrowse(city)} className="link">Browse events →</Link>
          </div>
        ) : (
          <div className="grid-4">
            {saved.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        )}

        <div className="section-hd" style={{ marginTop: 34 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Favourite venues ({favVenues.length}) <Landmark size={20} /></h2>
          <Link to={cityVenues(city)}>Browse venues →</Link>
        </div>
        {loading ? (
          <div className="tiny muted">Loading…</div>
        ) : favVenues.length === 0 ? (
          <div className="empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>No favourite venues yet — tap <Heart size={14} /> on any venue.</div>
        ) : (
          <div className="grid-3">
            {favVenues.map((id) => {
              const v = venuePool.find((x) => x.id === id);
              if (!v) return null;
              const count = (liveEvents ?? (isBackendEnabled() ? [] : EVENTS)).filter((e) => (e.venue?.id ?? e.venueId) === v.id && e.status === 'approved').length;
              return (
                <Link key={id} to={venuePath(v.city, v.id)} className="ecard" style={{ position: 'relative' }}>
                  <button
                    aria-label="Remove favourite"
                    title="Remove favourite"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavVenue(v.id); }}
                    style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: 'rgba(0,0,0,.45)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Heart size={15} fill="currentColor" />
                  </button>
                  <Poster hue={v.photoHue} icon={<Landmark size={40} />} label={v.galleryUrls?.[0] ? undefined : 'venue photo'} imageUrl={v.galleryUrls?.[0]} variant="landscape" alt={v.name} />
                  {v.logoUrl && <img src={v.logoUrl} alt="" width={38} height={38} loading="lazy" decoding="async" className="ecard-logo" />}
                  <div>
                    <h3>
                      {v.name} {v.verified && <span className="verified">✓</span>}
                    </h3>
                    <div className="meta">
                      {v.type} · {v.locality}
                    </div>
                    {todaysVenueHours(v.timingsByDay) && <div className="tiny muted-2">{todaysVenueHours(v.timingsByDay)}</div>}
                    <div className="small accent bold">{count} upcoming event{count === 1 ? '' : 's'}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
