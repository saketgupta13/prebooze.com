import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, PROMOTERS, promoterBySlug } from '../data/mock';
import Poster from '../components/Poster';
import EventCard from '../components/EventCard';

/** Public promoter profile — followable, shows the events they're promoting. */
export default function PromoterProfile() {
  const { slug } = useParams();
  const { following, toggleFollow } = useApp();
  const promoter = promoterBySlug(slug ?? '');

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
  // Phase 1: sample the city's live events as "promoting"; real allow-list comes in Phase 2
  const promoting = EVENTS.filter((e) => e.status === 'approved').slice(0, 3);
  const more = PROMOTERS.filter((p) => p.slug !== promoter.slug).slice(0, 3);

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
              <span key={l} className="icon-round" title={l}>{l.split('/')[0].slice(0, 2)}</span>
            ))}
            <button className={`btn ${isFollowing ? 'btn-ghost' : 'btn-pri'}`} onClick={() => toggleFollow(followKey)}>
              {isFollowing ? 'Following ✓' : '+ Follow'}
            </button>
            <button className="btn btn-ghost btn-sm">⇪ Share</button>
          </div>
        </div>

        <div className="profile-grid">
          <div>
            <div className="stat3" style={{ marginBottom: 16 }}>
              <div className="s">
                <div className="v">{promoter.followers >= 1000 ? (promoter.followers / 1000).toFixed(1).replace('.0', '') + 'k' : promoter.followers}</div>
                <div className="l">followers</div>
              </div>
              <div className="s">
                <div className="v">{promoter.eventsPromoted}</div>
                <div className="l">events</div>
              </div>
              <div className="s">
                <div className="v">{(promoter.guestsBrought / 1000).toFixed(1).replace('.0', '')}k</div>
                <div className="l">guests brought</div>
              </div>
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 8 }}>About</h3>
              <p className="muted small">{promoter.bio}</p>
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
                      <div className="meta">{p.followers >= 1000 ? (p.followers / 1000).toFixed(1).replace('.0', '') + 'k' : p.followers} followers</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
