import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, PROMOTERS, promoterBySlug, fmtCount } from '../data/mock';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import type { PromoterProfile as PromoterProfileData, Event } from '../types';
import { friendsAtEvents } from '../lib/social';
import FriendsProof from '../components/FriendsProof';
import ShareButton from '../components/ShareButton';
import Poster from '../components/Poster';
import { PageLoader } from '../components/Loader';
import SocialIcon, { guessPlatform } from '../components/SocialIcon';
import EventCard from '../components/EventCard';
import ReviewsSection from '../components/ReviewsSection';
import { useSeo } from '../lib/useSeo';
import { useEntitySeo } from '../lib/useEntitySeo';

/** Public promoter profile — followable, shows the events they're promoting. */
export default function PromoterProfile() {
  const { slug } = useParams();
  const { user, following, toggleFollow, netFollowers } = useApp();

  // Single-entity fetch for the profile itself (GET /promoters/:slug) — the
  // list fetch is now only for the "more promoters" section below, which
  // genuinely needs the list.
  const [livePromoter, setLivePromoter] = useState<PromoterProfileData | null>(null);
  const [livePromoters, setLivePromoters] = useState<PromoterProfileData[] | null>(null);
  const [liveEvents, setLiveEvents] = useState<Event[] | null>(null);
  const [loading, setLoading] = useState(isBackendEnabled());
  useEffect(() => {
    if (!isBackendEnabled() || !slug) return;
    setLoading(true);
    Promise.all([catalog.promoter(slug), catalog.promoters(), catalog.events({})])
      .then(([p, ps, evs]) => { setLivePromoter(p); setLivePromoters(ps); setLiveEvents(evs); })
      .catch(() => setLivePromoter(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const promoter = livePromoter ?? (isBackendEnabled() ? undefined : promoterBySlug(slug ?? ''));
  const liveSeo = useEntitySeo('promoter', slug);
  useSeo(liveSeo, promoter?.name);

  if (loading && !promoter) {
    return <PageLoader />;
  }

  if (!promoter) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Promoter not found</h1>
          <Link to="/" className="btn btn-pri" style={{ marginTop: 18 }}>Home</Link>
        </div>
      </main>
    );
  }

  const followKey = 'promoter:' + promoter.slug;
  const isFollowing = following.includes(followKey);
  const isOwnProfile = user?.isPromoter && user.promoterUsername?.toLowerCase() === promoter.slug.toLowerCase();
  const eventPool = liveEvents ?? (isBackendEnabled() ? [] : EVENTS);
  // Events this promoter is on the allow-list for; fall back to a sample of live events.
  const promoted = eventPool.filter((e) => e.promoterConfig?.allowedPromoters?.includes(promoter.slug));
  const promoting = promoted.length ? promoted : eventPool.filter((e) => e.status === 'approved').slice(0, 3);
  const friends = friendsAtEvents(promoting.map((e) => e.id), following);
  const more = (livePromoters ?? (isBackendEnabled() ? [] : PROMOTERS)).filter((p) => p.slug !== promoter.slug).slice(0, 3);

  return (
    <main className="page">
      <div className="container">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' }}>
          <div style={{ width: 90 }}>
            <Poster hue={promoter.hue} emoji="📣" variant="square" />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <span className="tag">Promoter</span>
            <h1 style={{ fontSize: 26, margin: '6px 0 2px' }}>
              {promoter.name} {promoter.verified && <span className="verified">✓</span>}
            </h1>
            <div className="muted small">{promoter.city} · {promoter.showRate}% show-up rate</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {promoter.links.map((l) => (
              <a key={l} className="icon-round" href={l.startsWith('http') ? l : `https://${l}`} target="_blank" rel="noopener noreferrer" title={l}><SocialIcon platform={guessPlatform(l)} /></a>
            ))}
            {!isOwnProfile && (
              <button className={`btn ${isFollowing ? 'btn-ghost' : 'btn-pri'}`} onClick={() => toggleFollow(followKey)}>
                {isFollowing ? 'Following ✓' : '+ Follow'}
              </button>
            )}
            <ShareButton path={`/promoter/${promoter.slug}`} />
          </div>
        </div>

        <FriendsProof people={friends} suffix="going to events they promote" style={{ marginBottom: 16 }} />

        <div className="profile-grid">
          <div>
            <div className="stat3" style={{ marginBottom: 16 }}>
              <div className="s">
                <div className="v">{fmtCount(netFollowers(followKey, promoter.followers))}</div>
                <div className="l">followers</div>
              </div>
              <div className="s">
                <div className="v">{promoter.eventsPromoted}</div>
                <div className="l">events</div>
              </div>
              <div className="s">
                <div className="v">{fmtCount(promoter.guestsBrought)}</div>
                <div className="l">guests brought</div>
              </div>
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 8 }}>About</h3>
              <div className="muted small rich-text" dangerouslySetInnerHTML={{ __html: promoter.bio }} />
              <div className="hr" />
              <div className="kv"><span className="k">Based in</span><span>{promoter.city}</span></div>
              <div className="kv"><span className="k">Show-up rate</span><span className="accent bold">{promoter.showRate}%</span></div>
              <div className="kv"><span className="k">Verified</span><span>{promoter.verified ? <span className="verified">✓ by Prebooze</span> : '—'}</span></div>
            </div>
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 6 }}>Run guest lists? 📣</h3>
              <p className="muted small" style={{ marginBottom: 10 }}>
                Get a profile like this, promote events and fill free-entry lists with your own affiliate links.
              </p>
              <Link to="/promoter/onboarding" className="btn btn-pri btn-sm">Become a promoter →</Link>
            </div>
          </div>

          <div>
            <section className="section" style={{ marginTop: 0 }}>
              <div className="section-hd">
                <h2>Promoting now ({promoting.length})</h2>
              </div>
              <div className="grid-3">
                {promoting.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </section>

            <section className="section">
              <div className="section-hd">
                <h2>Other promoters to follow</h2>
              </div>
              <div className="grid-3">
                {more.map((p) => (
                  <Link key={p.slug} to={`/promoter/${p.slug}`} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 46, flexShrink: 0 }}>
                      <Poster hue={p.hue} emoji="📣" variant="square" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: 14 }}>{p.name} {p.verified && <span className="verified">✓</span>}</h3>
                      <div className="meta">{fmtCount(netFollowers('promoter:' + p.slug, p.followers))} followers</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <ReviewsSection targetType="promoter" targetId={promoter.slug} prompt="How was this promoter's guest list?" />
          </div>
        </div>
      </div>
    </main>
  );
}
