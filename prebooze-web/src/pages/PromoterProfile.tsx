import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, promoterBySlug, fmtCount } from '../data/mock';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import type { PromoterProfile as PromoterProfileData, Event } from '../types';
import ShareButton from '../components/ShareButton';
import Poster from '../components/Poster';
import { PageLoader } from '../components/Loader';
import SocialIcon, { guessPlatform } from '../components/SocialIcon';
import EventCard from '../components/EventCard';
import ReviewsSection from '../components/ReviewsSection';
import { useSeo } from '../lib/useSeo';
import { useEntitySeo } from '../lib/useEntitySeo';
import { useJsonLd } from '../lib/useJsonLd';
import { buildPromoterSchema, buildBreadcrumbSchema } from '../lib/schema';

/** Public promoter profile — followable, shows the events they're promoting. */
export default function PromoterProfile() {
  const { slug } = useParams();
  const { user, following, toggleFollow, netFollowers } = useApp();

  // Single-entity fetch for the profile itself (GET /promoters/:slug) —
  // events fetched with includePast so "promoted in the past" has real data,
  // not just whatever's currently upcoming.
  const [livePromoter, setLivePromoter] = useState<PromoterProfileData | null>(null);
  const [liveEvents, setLiveEvents] = useState<Event[] | null>(null);
  const [loading, setLoading] = useState(isBackendEnabled());
  useEffect(() => {
    if (!isBackendEnabled() || !slug) return;
    setLoading(true);
    Promise.all([catalog.promoter(slug), catalog.events({ includePast: true })])
      .then(([p, evs]) => { setLivePromoter(p); setLiveEvents(evs); })
      .catch(() => setLivePromoter(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const promoter = livePromoter ?? (isBackendEnabled() ? undefined : promoterBySlug(slug ?? ''));
  const liveSeo = useEntitySeo('promoter', slug);
  useSeo(liveSeo, promoter?.name);
  useJsonLd(promoter ? buildPromoterSchema(promoter) : null);
  useJsonLd(
    promoter
      ? buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Promoters', path: '/promoters' },
          { name: promoter.name, path: `/promoter/${promoter.slug}` },
        ])
      : null,
  );

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
  // Events this promoter is actually on the allow-list for — no fallback to
  // unrelated events; an empty list here means this promoter genuinely isn't
  // tagged on anything yet.
  const promoted = eventPool.filter((e) => e.promoterConfig?.allowedPromoters?.includes(promoter.slug));
  const now = Date.now();
  const promoting = promoted.filter((e) => new Date(e.date).getTime() >= now);
  const promotedPast = promoted.filter((e) => new Date(e.date).getTime() < now).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main className="page">
      <div className="container">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' }}>
          <div style={{ width: 90 }}>
            <Poster hue={promoter.hue} emoji="📣" variant="square" imageUrl={promoter.logoUrl} alt={promoter.name} eager />
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
              {promoting.length ? (
                <div className="grid-3">
                  {promoting.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              ) : (
                <div className="empty">Not currently on any events' allow-list.</div>
              )}
            </section>

            <section className="section">
              <div className="section-hd">
                <h2>Promoted in the past ({promotedPast.length})</h2>
              </div>
              {promotedPast.length ? (
                <div className="grid-3">
                  {promotedPast.slice(0, 6).map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              ) : (
                <div className="empty">No past events yet.</div>
              )}
            </section>

            <ReviewsSection targetType="promoter" targetId={promoter.slug} prompt="How was this promoter's guest list?" />
          </div>
        </div>
      </div>
    </main>
  );
}
