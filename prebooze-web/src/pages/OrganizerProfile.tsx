import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, ORGANIZERS, PAST_EVENTS } from '../data/mock';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import type { Organizer, Event } from '../types';
import { friendsAtEvents } from '../lib/social';
import FriendsProof from '../components/FriendsProof';
import ShareButton from '../components/ShareButton';
import Poster from '../components/Poster';
import EventCard from '../components/EventCard';
import ReviewsSection from '../components/ReviewsSection';
import { useSeo } from '../lib/useSeo';
import { useEntitySeo } from '../lib/useEntitySeo';

export default function OrganizerProfile() {
  const { id } = useParams();
  const { following, toggleFollow } = useApp();

  const [liveOrgs, setLiveOrgs] = useState<Organizer[] | null>(null);
  const [liveEvents, setLiveEvents] = useState<Event[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.organizers().then(setLiveOrgs).catch(() => setLiveOrgs([]));
    catalog.events({}).then(setLiveEvents).catch(() => setLiveEvents([]));
  }, []);

  const org = (liveOrgs ?? ORGANIZERS).find((o) => o.id === id);
  const liveSeo = useEntitySeo('organizer', id);
  useSeo(liveSeo, org?.brandName);

  if (!org) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Organizer not found</h1>
          <Link to="/" className="btn btn-pri" style={{ marginTop: 18 }}>
            Home
          </Link>
        </div>
      </main>
    );
  }

  const upcoming = (liveEvents ?? EVENTS).filter((e) => (e.organizer?.id ?? e.organizerId) === org.id && e.status === 'approved');
  const isFollowing = following.includes(org.id);
  const friends = friendsAtEvents(upcoming.map((e) => e.id), following);

  return (
    <main className="page">
      <div className="container">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' }}>
          <Poster hue={org.logoHue} emoji="🎧" variant="square" className="" />
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ fontSize: 24 }}>
              {org.brandName} {org.verified && <span className="verified">✓</span>}
            </h1>
            <div className="muted small">
              @{org.username} · {org.city} · since {org.since}
            </div>
            <div className="muted small rich-text" style={{ marginTop: 6, maxWidth: 480 }} dangerouslySetInnerHTML={{ __html: org.about }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="icon-round">ig</span>
            <span className="icon-round">x</span>
            <span className="icon-round">🌐</span>
            <button
              className={`btn btn-sm ${isFollowing ? 'btn-ghost' : 'btn-pri'}`}
              onClick={() => toggleFollow(org.id)}
            >
              {isFollowing ? 'Following ✓' : '+ Follow'}
            </button>
            <ShareButton path={`/organizers/${org.id}`} />
          </div>
        </div>

        <FriendsProof people={friends} suffix="going to their events" style={{ marginBottom: 16 }} />

        <div className="profile-grid">
          <div>
            <div className="stat3" style={{ marginBottom: 16 }}>
              <div className="s">
                <div className="v">{(org.followers / 1000).toFixed(1).replace('.0', '')}k</div>
                <div className="l">followers</div>
              </div>
              <div className="s">
                <div className="v">{org.following}</div>
                <div className="l">following</div>
              </div>
              <div className="s">
                <div className="v">{org.eventsHosted}</div>
                <div className="l">events hosted</div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 8 }}>Verified organizer</h3>
              <div className="kv">
                <span className="k">Identity KYC</span>
                <span className="verified">✓</span>
              </div>
              <div className="kv">
                <span className="k">Bank verified</span>
                <span className="verified">✓</span>
              </div>
              <div className="kv">
                <span className="k">Joined</span>
                <span>Jan {org.since}</span>
              </div>
            </div>
          </div>

          <div>
            <section className="section" style={{ marginTop: 0 }}>
              <div className="section-hd">
                <h2>Upcoming events ({upcoming.length})</h2>
              </div>
              {upcoming.length ? (
                <div className="grid-3">
                  {upcoming.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              ) : (
                <div className="empty">No upcoming events published.</div>
              )}
            </section>

            <section className="section">
              <div className="section-hd">
                <h2>Past events ({org.eventsHosted})</h2>
              </div>
              <div className="grid-3">
                {PAST_EVENTS.slice(0, 6).map((p) => (
                  <div key={p.title} className="ecard">
                    <Poster hue={p.hue} emoji="📸" label="poster" />
                    <div>
                      <h3>{p.title}</h3>
                      <div className="meta">
                        {p.date} · ★ {p.orgRating}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <ReviewsSection targetType="organizer" targetId={org.id} prompt="How was the event / organizer?" />
          </div>
        </div>
      </div>
    </main>
  );
}
