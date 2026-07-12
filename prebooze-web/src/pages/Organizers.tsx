import { Link } from 'react-router-dom';
import { EVENTS, ORGANIZERS } from '../data/mock';
import Poster from '../components/Poster';

/** Public directory of all verified organizers. */
export default function Organizers() {
  const list = [...ORGANIZERS].sort((a, b) => b.eventsHosted - a.eventsHosted);

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/">Home</Link> / Organizers
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Organizers 🎧</h1>
        <p className="muted" style={{ marginBottom: 22 }}>
          Verified event brands — concerts, comedy, festivals and warehouse parties near you.
        </p>

        <div className="grid-3">
          {list.map((o) => {
            const live = EVENTS.filter((e) => e.organizerId === o.id && e.status === 'approved').length;
            return (
              <Link key={o.id} to={`/organizers/${o.id}`} className="card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <Poster hue={o.logoHue} emoji="🎧" variant="square" className="" />
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 15 }}>
                    {o.brandName} {o.verified && <span className="verified">✓</span>}
                  </h3>
                  <div className="meta muted small">{o.city} · ★ {o.rating} · {o.eventsHosted} events hosted</div>
                  <div className="small muted" style={{ marginTop: 4 }}>
                    {live} live now · {o.followers.toLocaleString('en-IN')} followers
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
