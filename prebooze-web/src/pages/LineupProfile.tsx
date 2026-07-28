import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, LINEUPS, lineupBySlug, fmtCount } from '../data/mock';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import type { LineupProfile as LineupProfileData, Event } from '../types';
import Poster from '../components/Poster';
import { PageLoader } from '../components/Loader';
import SocialIcon, { guessPlatform } from '../components/SocialIcon';
import ShareButton from '../components/ShareButton';
import EventCard from '../components/EventCard';
import ReviewsSection from '../components/ReviewsSection';
import { useSeo } from '../lib/useSeo';
import { useEntitySeo } from '../lib/useEntitySeo';

/** Public line-up profile — artists, DJs, sponsors and promoters guests can follow. */
export default function LineupProfile() {
  const { slug } = useParams();
  const { user, following, toggleFollow, netFollowers } = useApp();

  // Single-entity fetch for the profile itself (GET /lineups/:slug) — the
  // list fetch is now only for the "more line-ups" section below.
  const [liveLineup, setLiveLineup] = useState<LineupProfileData | null>(null);
  const [liveLineups, setLiveLineups] = useState<LineupProfileData[] | null>(null);
  const [liveEvents, setLiveEvents] = useState<Event[] | null>(null);
  const [loading, setLoading] = useState(isBackendEnabled());
  useEffect(() => {
    if (!isBackendEnabled() || !slug) return;
    setLoading(true);
    Promise.all([catalog.lineup(slug), catalog.lineups(), catalog.events({})])
      .then(([l, ls, evs]) => { setLiveLineup(l); setLiveLineups(ls); setLiveEvents(evs); })
      .catch(() => setLiveLineup(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const lineup = liveLineup ?? (isBackendEnabled() ? undefined : lineupBySlug(slug ?? ''));
  const liveSeo = useEntitySeo('lineup', slug);
  useSeo(liveSeo, lineup?.name);

  if (loading && !lineup) {
    return <PageLoader />;
  }

  if (!lineup) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Line-up not found</h1>
          <Link to="/" className="btn btn-pri" style={{ marginTop: 18 }}>Home</Link>
        </div>
      </main>
    );
  }

  const followKey = 'lineup:' + lineup.slug;
  const isFollowing = following.includes(followKey);
  const isOwnProfile = user?.isLineup && user.lineupUsername?.toLowerCase() === lineup.slug.toLowerCase();
  const upcoming = (liveEvents ?? (isBackendEnabled() ? [] : EVENTS)).filter(
    (e) => e.status === 'approved' && e.lineup.some((l) => l.name.toLowerCase() === lineup.name.toLowerCase())
  );
  const more = (liveLineups ?? (isBackendEnabled() ? [] : LINEUPS)).filter((l) => l.slug !== lineup.slug && l.category === lineup.category).slice(0, 3);

  return (
    <main className="page">
      <div className="container">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' }}>
          <div style={{ width: 96 }}>
            {lineup.logoUrl ? (
              <img src={lineup.logoUrl} alt="" style={{ width: 96, height: 96, borderRadius: 12, objectFit: 'cover' }} />
            ) : (
              <Poster hue={lineup.hue} emoji={lineup.emoji} variant="square" />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <span className="tag">{lineup.category}</span>
            <h1 style={{ fontSize: 26, margin: '6px 0 2px' }}>
              {lineup.name} {lineup.verified && <span className="verified">✓</span>}
            </h1>
            <div className="muted small">{lineup.city} · {lineup.eventsPlayed} events played</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {lineup.links.map((l) => (
              <a key={l} className="icon-round" href={l.startsWith('http') ? l : `https://${l}`} target="_blank" rel="noopener noreferrer" title={l}><SocialIcon platform={guessPlatform(l)} /></a>
            ))}
            {!isOwnProfile && (
              <button
                className={`btn ${isFollowing ? 'btn-ghost' : 'btn-pri'}`}
                onClick={() => toggleFollow(followKey)}
              >
                {isFollowing ? 'Following ✓' : '+ Follow'}
              </button>
            )}
            <ShareButton path={`/lineup/${slug}`} />
          </div>
        </div>

        <div className="profile-grid">
          <div>
            <div className="stat3" style={{ marginBottom: 16 }}>
              <div className="s">
                <div className="v">{fmtCount(netFollowers(followKey, lineup.followers))}</div>
                <div className="l">followers</div>
              </div>
              <div className="s">
                <div className="v">{lineup.eventsPlayed}</div>
                <div className="l">events</div>
              </div>
              <div className="s">
                <div className="v">{upcoming.length}</div>
                <div className="l">upcoming</div>
              </div>
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 8 }}>About</h3>
              <div className="muted small rich-text" dangerouslySetInnerHTML={{ __html: lineup.bio }} />
              <div className="hr" />
              <div className="kv">
                <span className="k">Category</span>
                <span>{lineup.category}</span>
              </div>
              <div className="kv">
                <span className="k">Based in</span>
                <span>{lineup.city}</span>
              </div>
              <div className="kv">
                <span className="k">Verified</span>
                <span>{lineup.verified ? <span className="verified">✓ by Prebooze</span> : '—'}</span>
              </div>
            </div>
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 6 }}>Are you an artist? 🎤</h3>
              <p className="muted small" style={{ marginBottom: 10 }}>
                Get a profile like this, appear on event line-ups and grow your followers.
              </p>
              <Link to="/lineup/onboarding" className="btn btn-pri btn-sm">Join as a line-up →</Link>
            </div>
          </div>

          <div>
            <section className="section" style={{ marginTop: 0 }}>
              <div className="section-hd">
                <h2>Upcoming events with {lineup.name} ({upcoming.length})</h2>
              </div>
              {upcoming.length ? (
                <div className="grid-3">
                  {upcoming.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              ) : (
                <div className="empty">No upcoming events announced — follow to hear first.</div>
              )}
            </section>

            {more.length > 0 && (
              <section className="section">
                <div className="section-hd">
                  <h2>More {lineup.category.toLowerCase()}s to follow</h2>
                </div>
                <div className="grid-3">
                  {more.map((l) => (
                    <Link key={l.slug} to={`/lineup/${l.slug}`} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 46, flexShrink: 0 }}>
                        {l.logoUrl ? (
                          <img src={l.logoUrl} alt="" style={{ width: 46, height: 46, borderRadius: 8, objectFit: 'cover' }} />
                        ) : (
                          <Poster hue={l.hue} emoji={l.emoji} variant="square" />
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: 14 }}>
                          {l.name} {l.verified && <span className="verified">✓</span>}
                        </h3>
                        <div className="meta">{fmtCount(netFollowers('lineup:' + l.slug, l.followers))} followers</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <ReviewsSection targetType="lineup" targetId={lineup.slug} prompt="How was their set?" />
          </div>
        </div>
      </div>
    </main>
  );
}
