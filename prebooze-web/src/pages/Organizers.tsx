import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EVENTS, ORGANIZERS } from '../data/mock';
import { useApp } from '../store/AppContext';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import type { Organizer, Event } from '../types';
import { featuredRefs, featuredFirst } from '../lib/featured';
import DirectoryCard from '../components/DirectoryCard';
import { cityHome, organizerPath } from '../lib/urls';

/** Public directory of verified organizers in the selected city. */
export default function Organizers() {
  const { city, user, following, toggleFollow, featured, netFollowers } = useApp();
  const feat = featuredRefs(featured, 'organizer', city);

  const [liveOrgs, setLiveOrgs] = useState<Organizer[] | null>(null);
  const [liveEvents, setLiveEvents] = useState<Event[] | null>(null);
  const [loading, setLoading] = useState(isBackendEnabled());
  useEffect(() => {
    if (!isBackendEnabled()) return;
    setLoading(true);
    Promise.all([catalog.organizers(city), catalog.events({ city })])
      .then(([orgs, evs]) => { setLiveOrgs(orgs); setLiveEvents(evs); })
      .catch(() => { setLiveOrgs([]); setLiveEvents([]); })
      .finally(() => setLoading(false));
  }, [city]);

  // Mock is only ever a stand-in for offline dev mode (no VITE_API_URL) —
  // never a "loading" placeholder in production, which used to flash real
  // guests a page of fabricated organizers before the real fetch resolved.
  const list = featuredFirst(
    liveOrgs
      ? [...liveOrgs].sort((a, b) => b.eventsHosted - a.eventsHosted)
      : isBackendEnabled()
        ? []
        : [...ORGANIZERS].filter((o) => o.city === city).sort((a, b) => b.eventsHosted - a.eventsHosted),
    (o) => o.id,
    feat
  );

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to={cityHome(city)}>Home</Link> / Organizers
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Organizers in {city} 🎧</h1>
        <p className="muted" style={{ marginBottom: 18 }}>
          Every organizer listed here is KYC-verified before their first event goes live — no fake listings, no
          last-minute cancellations from an unverified host. Browse concerts, comedy nights, festivals and club
          events from real, accountable event brands in {city}, and follow the ones whose lineups you don't
          want to miss.
        </p>

        {loading && <div className="tiny muted">Loading…</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 14 }}>
          {list.map((o) => {
            const isFollowing = following.includes(o.id);
            const isOwn = user?.isOrganizer && user.orgUsername?.toLowerCase() === o.username.toLowerCase();
            const live = (liveEvents ?? (isBackendEnabled() ? [] : EVENTS)).filter((e) => (e.organizer?.id ?? e.organizerId) === o.id && e.status === 'approved').length;
            return (
              <DirectoryCard
                key={o.id}
                to={organizerPath(o.city, o.id)}
                hue={o.logoHue}
                avatarText="🎧"
                avatarImage={o.logoUrl}
                name={o.brandName}
                verified={o.verified}
                meta={`${o.city} · ★ ${o.rating} · since ${o.since}`}
                bio={o.about}
                featured={feat.has(o.id)}
                stats={
                  <>
                    <b>{o.eventsHosted}</b> events · <b>{live}</b> live now · <b>{netFollowers(o.id, o.followers).toLocaleString('en-IN')}</b> followers
                  </>
                }
                action={
                  isOwn ? null : (
                    <button className={`btn btn-sm btn-block ${isFollowing ? 'btn-ghost' : 'btn-pri'}`} onClick={() => toggleFollow(o.id)}>
                      {isFollowing ? 'Following ✓' : '+ Follow'}
                    </button>
                  )
                }
              />
            );
          })}
        </div>
        {!loading && list.length === 0 && <div className="empty">No organizers in {city} yet.</div>}
      </div>
    </main>
  );
}
