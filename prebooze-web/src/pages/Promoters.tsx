import { Link } from 'react-router-dom';
import { PROMOTERS } from '../data/mock';
import { useApp } from '../store/AppContext';
import { featuredRefs, featuredFirst } from '../lib/featured';
import DirectoryCard from '../components/DirectoryCard';

/** Public directory of promoters in the selected city, ranked by show-up rate. */
export default function Promoters() {
  const { city, following, toggleFollow, featured } = useApp();
  const feat = featuredRefs(featured, 'promoter', city);
  const list = featuredFirst(
    [...PROMOTERS].filter((p) => p.city === city).sort((a, b) => b.showRate - a.showRate),
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 14 }}>
          {list.map((p) => {
            const key = 'promoter:' + p.slug;
            const isFollowing = following.includes(key);
            return (
              <DirectoryCard
                key={p.slug}
                to={`/promoter/${p.slug}`}
                hue={p.hue}
                avatarText="📣"
                name={p.name}
                verified={p.verified}
                meta={`${p.city} · ${p.followers.toLocaleString('en-IN')} followers`}
                bio={p.bio}
                featured={feat.has(p.slug)}
                stats={
                  <>
                    <span className={p.showRate >= 70 ? 'accent bold' : 'bold'}>{p.showRate}%</span> show-rate ·{' '}
                    <b>{p.guestsBrought.toLocaleString('en-IN')}</b> guests brought
                  </>
                }
                action={
                  <button className={`btn btn-sm btn-block ${isFollowing ? 'btn-ghost' : 'btn-pri'}`} onClick={() => toggleFollow(key)}>
                    {isFollowing ? 'Following ✓' : '+ Follow'}
                  </button>
                }
              />
            );
          })}
        </div>
        {list.length === 0 && <div className="empty">No promoters in {city} yet.</div>}
      </div>
    </main>
  );
}
