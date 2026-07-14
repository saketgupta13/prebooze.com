import { Link } from 'react-router-dom';
import { EVENTS, ORGANIZERS } from '../data/mock';
import { useApp } from '../store/AppContext';
import { featuredRefs, featuredFirst } from '../lib/featured';
import DirectoryCard from '../components/DirectoryCard';

/** Public directory of verified organizers in the selected city. */
export default function Organizers() {
  const { city, following, toggleFollow, featured } = useApp();
  const feat = featuredRefs(featured, 'organizer', city);
  const list = featuredFirst(
    [...ORGANIZERS].filter((o) => o.city === city).sort((a, b) => b.eventsHosted - a.eventsHosted),
    (o) => o.id,
    feat
  );

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/">Home</Link> / Organizers
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Organizers in {city} 🎧</h1>
        <p className="muted" style={{ marginBottom: 18 }}>
          Verified event brands — concerts, comedy, festivals and warehouse parties near you.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 14 }}>
          {list.map((o) => {
            const isFollowing = following.includes(o.id);
            const live = EVENTS.filter((e) => e.organizerId === o.id && e.status === 'approved').length;
            return (
              <DirectoryCard
                key={o.id}
                to={`/organizers/${o.id}`}
                hue={o.logoHue}
                avatarText="🎧"
                name={o.brandName}
                verified={o.verified}
                meta={`${o.city} · ★ ${o.rating} · since ${o.since}`}
                bio={o.about}
                featured={feat.has(o.id)}
                stats={
                  <>
                    <b>{o.eventsHosted}</b> events · <b>{live}</b> live now · <b>{o.followers.toLocaleString('en-IN')}</b> followers
                  </>
                }
                action={
                  <button className={`btn btn-sm btn-block ${isFollowing ? 'btn-ghost' : 'btn-pri'}`} onClick={() => toggleFollow(o.id)}>
                    {isFollowing ? 'Following ✓' : '+ Follow'}
                  </button>
                }
              />
            );
          })}
        </div>
        {list.length === 0 && <div className="empty">No organizers in {city} yet.</div>}
      </div>
    </main>
  );
}
