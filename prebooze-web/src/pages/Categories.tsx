import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { CATEGORY_TREE, EVENTS, venueById } from '../data/mock';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import type { Event } from '../types';
import { useSeo } from '../lib/useSeo';

/** Browse-by-category directory — categories + sub-categories with live
 * counts. Category/sub-category names now come from the real, admin-managed
 * EventCategory table (GET /categories) — the local CATEGORY_TREE constant
 * is only a fallback for offline/dev mode with no backend configured. */
export default function Categories() {
  useSeo(null, 'Browse by category');
  const { city } = useApp();
  const [liveEvents, setLiveEvents] = useState<Event[] | null>(null);
  const [liveCategories, setLiveCategories] = useState<{ name: string; icon: string; subs: string[] }[] | null>(null);

  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.events({ city }).then(setLiveEvents).catch(() => setLiveEvents([]));
  }, [city]);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.categories().then(setLiveCategories).catch(() => setLiveCategories([]));
  }, []);

  // liveEvents starts null until the fetch resolves — without the
  // isBackendEnabled() guard here (already present for `categories` below),
  // this briefly fell through to the mock EVENTS array on every real page
  // load, flashing wrong mock-derived counts before the real ones replaced
  // them a moment later.
  const cityEvents = liveEvents ?? (isBackendEnabled() ? [] : EVENTS.filter((e) => e.status === 'approved' && (e.venueId ? venueById(e.venueId).city : e.privateCity) === city));
  const categories = liveCategories ?? (isBackendEnabled() ? [] : CATEGORY_TREE);
  const catCount = (cat: string) => cityEvents.filter((e) => e.category === cat).length;
  const subCount = (cat: string, sub: string) => cityEvents.filter((e) => e.category === cat && e.subCategory === sub).length;

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/">Home</Link> / Browse by category
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Browse by category 🗂️</h1>
        <p className="muted" style={{ marginBottom: 22 }}>
          Every kind of night out in <span className="accent bold">{city}</span> — pick a lane.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {categories.map((c) => {
            const total = catCount(c.name);
            return (
              <div key={c.name} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <Link to={`/browse?cat=${encodeURIComponent(c.name)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 34 }}>{c.icon}</span>
                    <div>
                      <h3 style={{ fontSize: 17 }}>{c.name}</h3>
                      <div className="tiny muted-2">
                        {total > 0 ? `${total} event${total === 1 ? '' : 's'} in ${city}` : `coming soon in ${city}`}
                      </div>
                    </div>
                  </div>
                </Link>
                <div className="hr" />
                <div style={{ display: 'grid', gap: 6, flex: 1 }}>
                  {c.subs.map((s) => {
                    const n = subCount(c.name, s);
                    return (
                      <Link
                        key={s}
                        to={`/browse?cat=${encodeURIComponent(c.name)}&sub=${encodeURIComponent(s)}`}
                        className="kv"
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <span className="k" style={{ color: n ? 'var(--text)' : 'var(--muted-2)' }}>{s}</span>
                        <span className={n ? 'accent bold small' : 'tiny muted-2'}>{n || '—'}</span>
                      </Link>
                    );
                  })}
                </div>
                <Link to={`/browse?cat=${encodeURIComponent(c.name)}`} className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 12 }}>
                  Browse {c.name.toLowerCase()} →
                </Link>
              </div>
            );
          })}
        </div>
        <div className="tiny muted-2" style={{ marginTop: 14 }}>
          counts follow your selected city · switch city from the 📍 picker in the header
        </div>
      </div>
    </main>
  );
}
