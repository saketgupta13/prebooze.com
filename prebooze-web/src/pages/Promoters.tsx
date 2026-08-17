import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PROMOTERS } from '../data/mock';
import { useApp } from '../store/AppContext';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import type { PromoterProfile } from '../types';
import { featuredRefs, featuredFirst } from '../lib/featured';
import DirectoryCard from '../components/DirectoryCard';

/** Public directory of promoters in the selected city, ranked by show-up rate. */
export default function Promoters() {
  const { city, user, following, toggleFollow, featured, netFollowers } = useApp();
  const feat = featuredRefs(featured, 'promoter', city);

  const [livePromoters, setLivePromoters] = useState<PromoterProfile[] | null>(null);
  const [loading, setLoading] = useState(isBackendEnabled());
  useEffect(() => {
    if (!isBackendEnabled()) return;
    setLoading(true);
    catalog.promoters(city).then(setLivePromoters).catch(() => setLivePromoters([])).finally(() => setLoading(false));
  }, [city]);

  // Mock is only ever a stand-in for offline dev mode (no VITE_API_URL) —
  // this used to fall through to it unconditionally, flashing real guests a
  // page of fabricated promoters (fake names/show-rates/followers) before
  // the real fetch resolved, same bug class already fixed on Home.tsx.
  const list = featuredFirst(
    livePromoters
      ? [...livePromoters].sort((a, b) => b.showRate - a.showRate)
      : isBackendEnabled()
        ? []
        : [...PROMOTERS].filter((p) => p.city === city).sort((a, b) => b.showRate - a.showRate),
    (p) => p.slug,
    feat
  );

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/">Home</Link> / Promoters
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Promoters in {city} 📣</h1>
        <p className="muted" style={{ marginBottom: 18 }}>
          Follow the crews with the best guest lists — free entry before the cutoff, always.
        </p>

        {loading && <div className="tiny muted">Loading…</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 14 }}>
          {list.map((p) => {
            const key = 'promoter:' + p.slug;
            const isFollowing = following.includes(key);
            const isOwn = user?.isPromoter && user.promoterUsername?.toLowerCase() === p.slug.toLowerCase();
            return (
              <DirectoryCard
                key={p.slug}
                to={`/promoter/${p.slug}`}
                hue={p.hue}
                avatarText="📣"
                avatarImage={p.logoUrl}
                name={p.name}
                verified={p.verified}
                meta={`${p.city} · ${netFollowers(key, p.followers).toLocaleString('en-IN')} followers`}
                bio={p.bio}
                featured={feat.has(p.slug)}
                stats={
                  <>
                    <span className={p.showRate >= 70 ? 'accent bold' : 'bold'}>{p.showRate}%</span> show-rate ·{' '}
                    <b>{p.guestsBrought.toLocaleString('en-IN')}</b> guests brought
                  </>
                }
                action={
                  isOwn ? null : (
                    <button className={`btn btn-sm btn-block ${isFollowing ? 'btn-ghost' : 'btn-pri'}`} onClick={() => toggleFollow(key)}>
                      {isFollowing ? 'Following ✓' : '+ Follow'}
                    </button>
                  )
                }
              />
            );
          })}
        </div>
        {!loading && list.length === 0 && <div className="empty">No promoters in {city} yet.</div>}
      </div>
    </main>
  );
}
