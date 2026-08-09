import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, VENUES, fmtCount } from '../data/mock';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import type { Venue, Event } from '../types';
import Poster from '../components/Poster';
import { PageLoader } from '../components/Loader';
import ShareButton from '../components/ShareButton';
import SocialIcon, { guessPlatform } from '../components/SocialIcon';
import EventCard from '../components/EventCard';
import ReviewsSection from '../components/ReviewsSection';
import { useSeo } from '../lib/useSeo';
import { useEntitySeo } from '../lib/useEntitySeo';

export default function VenueDetail() {
  const { id } = useParams();
  const { user, following, toggleFollow, favVenues, toggleFavVenue, netFollowers } = useApp();

  // Single-entity fetches (GET /venues/:id + GET /events?venueId=) — see
  // the same note in OrganizerProfile.tsx for why this replaced fetching
  // every venue/event in the catalog just to find one.
  const [liveVenue, setLiveVenue] = useState<Venue | null>(null);
  const [liveEvents, setLiveEvents] = useState<Event[] | null>(null);
  const [loading, setLoading] = useState(isBackendEnabled());
  useEffect(() => {
    if (!isBackendEnabled() || !id) return;
    setLoading(true);
    Promise.all([catalog.venue(id), catalog.events({ venueId: id })])
      .then(([v, evs]) => { setLiveVenue(v); setLiveEvents(evs); })
      .catch(() => setLiveVenue(null))
      .finally(() => setLoading(false));
  }, [id]);

  const venue = liveVenue ?? (isBackendEnabled() ? undefined : VENUES.find((v) => v.id === id));
  const liveSeo = useEntitySeo('venue', id);
  useSeo(liveSeo, venue?.name, venue?.logoUrl);

  if (loading && !venue) {
    return <PageLoader />;
  }

  if (!venue) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Venue not found</h1>
          <Link to="/venues" className="btn btn-pri" style={{ marginTop: 18 }}>
            All venues
          </Link>
        </div>
      </main>
    );
  }

  // liveEvents is already server-scoped to this venue — only the mock
  // fallback still needs the client-side filter. Includes past events too
  // (CatalogService.events returns full history when venueId is set), so
  // split here the same way OrganizerProfile.tsx does.
  const events = liveEvents ?? (isBackendEnabled() ? [] : EVENTS.filter((e) => e.venueId === venue.id && e.status === 'approved'));
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.date).getTime() >= now);
  const past = events.filter((e) => new Date(e.date).getTime() < now).sort((a, b) => b.date.localeCompare(a.date));
  const followKey = 'venue:' + venue.id;
  const isFollowing = following.includes(followKey);
  const isOwnProfile = user?.isVenue && user.venueId === venue.id;

  return (
    <main className="page">
      <div className="container">
        {(() => {
          const labels = ['main hall', 'stage', 'bar', 'entry', 'crowd', 'terrace'];
          return <VenueSlider hue={venue.photoHue} labels={labels} galleryUrls={venue.galleryUrls} />;
        })()}

        <div style={{ display: 'flex', gap: 18, alignItems: 'center', margin: '22px 0', flexWrap: 'wrap' }}>
          <div style={{ width: 96 }}>
            <Poster hue={venue.photoHue} emoji="🏛" variant="square" imageUrl={venue.logoUrl} alt={venue.name} eager />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 24 }}>
              {venue.name} {venue.verified && <span className="verified">✓</span>}
            </h1>
            <div className="muted small">
              {venue.locality} · followed by guests & hosts · {fmtCount(netFollowers(followKey, venue.followers))} followers
            </div>
            {venue.type && (
              <div className="chip-row" style={{ marginTop: 6 }}>
                {venue.type.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                  <Link key={t} to={`/venues?type=${encodeURIComponent(t)}`} className="tag" style={{ textDecoration: 'none' }}>
                    #{t.replace(/\s+/g, '')}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {venue.socialLinks?.instagram && (
              <a className="icon-round" href={venue.socialLinks.instagram.startsWith('http') ? venue.socialLinks.instagram : `https://${venue.socialLinks.instagram}`} target="_blank" rel="noopener noreferrer" title={venue.socialLinks.instagram}><SocialIcon platform="instagram" /></a>
            )}
            {venue.socialLinks?.facebook && (
              <a className="icon-round" href={venue.socialLinks.facebook.startsWith('http') ? venue.socialLinks.facebook : `https://${venue.socialLinks.facebook}`} target="_blank" rel="noopener noreferrer" title={venue.socialLinks.facebook}><SocialIcon platform="facebook" /></a>
            )}
            {venue.socialLinks?.other?.map((l, i) => (
              <a key={i} className="icon-round" href={l.startsWith('http') ? l : `https://${l}`} target="_blank" rel="noopener noreferrer" title={l}><SocialIcon platform={guessPlatform(l)} /></a>
            ))}
            <button
              className="btn btn-ghost btn-sm"
              title={favVenues.includes(venue.id) ? 'Remove favourite' : 'Favourite this venue'}
              onClick={() => toggleFavVenue(venue.id)}
            >
              {favVenues.includes(venue.id) ? '❤️ Favourited' : '🤍 Favourite'}
            </button>
            {!isOwnProfile && (
              <button
                className={`btn btn-sm ${isFollowing ? 'btn-ghost' : 'btn-pri'}`}
                onClick={() => toggleFollow(followKey)}
              >
                {isFollowing ? 'Following ✓' : '+ Follow'}
              </button>
            )}
            <ShareButton path={`/venues/${venue.id}`} />
          </div>
        </div>

        <div className="stat3" style={{ maxWidth: 520, marginBottom: 24 }}>
          <div className="s">
            <div className="v">{upcoming.length}</div>
            <div className="l">upcoming</div>
          </div>
          <div className="s">
            <div className="v">{venue.capacity.toLocaleString()}</div>
            <div className="l">capacity</div>
          </div>
          <div className="s">
            <div className="v">{venue.reviewCount ? `★ ${venue.rating.toFixed(1)}` : '—'}</div>
            <div className="l">{venue.reviewCount ? `${venue.reviewCount} review${venue.reviewCount === 1 ? '' : 's'}` : 'no reviews yet'}</div>
          </div>
        </div>

        <div className="grid-2 venue-info-grid" style={{ alignItems: 'stretch', marginBottom: 10 }}>
          <div className="card venue-map-card">
            <iframe
              title={`Map — ${venue.name}`}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(`${venue.name}, ${venue.address}, ${venue.city}`)}&z=15&output=embed`}
              style={{ width: '100%', height: 200, border: '1px solid var(--border)', borderRadius: 10, marginBottom: 12 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="small muted" style={{ marginBottom: 10 }}>📍 {venue.address}, {venue.city}</div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${venue.name}, ${venue.address}, ${venue.city}`)}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-pri btn-sm"
            >
              🧭 Get directions →
            </a>
          </div>
          <div className="card venue-about-card">
            <h3 style={{ marginBottom: 10 }}>Amenities</h3>
            <div className="chip-row" style={{ marginBottom: 16 }}>
              {venue.amenities.map((a) => (
                <span key={a} className="chip static">
                  {a}
                </span>
              ))}
            </div>
            {venue.timings && (
              <>
                <h3 style={{ marginBottom: 8 }}>🕒 Timings</h3>
                <p className="muted small" style={{ marginBottom: 16 }}>{venue.timings}</p>
              </>
            )}
            <h3 style={{ marginBottom: 8 }}>ℹ️ About this venue</h3>
            <div className="muted small rich-text" dangerouslySetInnerHTML={{ __html: venue.about }} />
          </div>
        </div>

        <section className="section">
          <div className="section-hd">
            <h2>
              Upcoming at {venue.name} ({upcoming.length})
            </h2>
            <Link to="/browse">See all events →</Link>
          </div>
          {upcoming.length ? (
            <div className="grid-4">
              {upcoming.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <div className="empty">No published events here right now.</div>
          )}
        </section>

        <section className="section">
          <div className="section-hd">
            <h2>Past events ({past.length})</h2>
          </div>
          {past.length ? (
            <div className="grid-4">
              {past.slice(0, 8).map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <div className="empty">No past events yet.</div>
          )}
        </section>

        <ReviewsSection targetType="venue" targetId={venue.id} prompt="How was this venue — sound, entry, staff?" />
      </div>
    </main>
  );
}


/** Image slider cycling the venue's own uploaded gallery photos when it has
 * any (VenueListing.tsx's real upload, up to 6 — previously captured and
 * stored but never actually rendered anywhere guest-facing); falls back to
 * the hue-gradient placeholder + generic labels for a venue that hasn't
 * uploaded photos yet. */
function VenueSlider({ hue, labels, galleryUrls }: { hue: number; labels: string[]; galleryUrls?: string[] }) {
  const photos = galleryUrls?.length ? galleryUrls : undefined;
  const count = photos?.length ?? labels.length;
  const [idx, setIdx] = useState(0);
  const go = (d: number) => setIdx((i) => (i + d + count) % count);
  return (
    <div style={{ position: 'relative' }}>
      <Poster
        hue={(hue + idx * 40) % 360}
        emoji="🏛"
        label={photos ? undefined : `${labels[idx]} · photo ${idx + 1} of ${labels.length}`}
        imageUrl={photos?.[idx]}
        variant="landscape"
      />
      <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(26,28,23,.75)' }} onClick={() => go(-1)}>
        ‹
      </button>
      <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(26,28,23,.75)' }} onClick={() => go(1)}>
        ›
      </button>
      <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            aria-label={`photo ${i + 1}`}
            onClick={() => setIdx(i)}
            style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', background: i === idx ? 'var(--accent)' : 'rgba(237,239,230,.35)' }}
          />
        ))}
      </div>
    </div>
  );
}
