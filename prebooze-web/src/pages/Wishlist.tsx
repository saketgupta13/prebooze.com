import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, VENUES } from '../data/mock';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import type { Event, Venue } from '../types';
import EventCard from '../components/EventCard';

/** Saved events — the guest's wishlist. Wishlist/favourite membership itself
 * is still local-only (see AppContext) — this just makes sure a real event
 * or venue the guest saved actually resolves to something instead of
 * silently vanishing because it isn't in the local mock seed. */
export default function Wishlist() {
  const { wishlist, myEvents, favVenues, toggleFavVenue } = useApp();

  const [liveEvents, setLiveEvents] = useState<Event[] | null>(null);
  const [liveVenues, setLiveVenues] = useState<Venue[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.events({}).then(setLiveEvents).catch(() => setLiveEvents([]));
    catalog.venues().then(setLiveVenues).catch(() => setLiveVenues([]));
  }, []);

  const all = [...myEvents, ...EVENTS, ...(liveEvents ?? [])];
  const saved = wishlist.map((id) => all.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e);
  const venuePool = [...VENUES, ...(liveVenues ?? [])];

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/profile">Profile</Link> / Wishlist
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>My wishlist ❤️</h1>
        <p className="muted" style={{ marginBottom: 22 }}>
          Events you've saved for later — tap the heart on any event to add it here.
        </p>

        {saved.length === 0 ? (
          <div className="empty">
            Nothing saved yet. <Link to="/browse" className="link">Browse events →</Link>
          </div>
        ) : (
          <div className="grid-4">
            {saved.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        )}

        <div className="section-hd" style={{ marginTop: 34 }}>
          <h2>Favourite venues ({favVenues.length}) 🏛</h2>
          <Link to="/venues">Browse venues →</Link>
        </div>
        {favVenues.length === 0 ? (
          <div className="empty">No favourite venues yet — tap 🤍 on any venue.</div>
        ) : (
          <div className="grid-3">
            {favVenues.map((id) => {
              const v = venuePool.find((x) => x.id === id);
              if (!v) return null;
              return (
                <div key={id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 26 }}>🏛</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link to={`/venues/${v.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="bold small">{v.name} {v.verified && <span className="verified">✓</span>}</div>
                    </Link>
                    <div className="tiny muted-2">{v.type} · {v.city}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleFavVenue(id)}>❤️</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
