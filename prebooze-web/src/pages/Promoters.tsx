import { Link } from 'react-router-dom';
import { PROMOTERS } from '../data/mock';
import Poster from '../components/Poster';

/** Public directory of all promoters, ranked by show-up rate. */
export default function Promoters() {
  const list = [...PROMOTERS].sort((a, b) => b.showRate - a.showRate);

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/">Home</Link> / Promoters
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Promoters 📣</h1>
        <p className="muted" style={{ marginBottom: 22 }}>
          Follow the crews with the best guest lists — free entry before the cutoff, always.
        </p>

        <div className="grid-3">
          {list.map((p) => (
            <Link key={p.slug} to={`/promoter/${p.slug}`} className="card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 60, flexShrink: 0 }}>
                <Poster hue={p.hue} emoji="📣" variant="square" />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: 15 }}>
                  {p.name} {p.verified && <span className="verified">✓</span>}
                </h3>
                <div className="meta muted small">{p.city} · {p.followers.toLocaleString('en-IN')} followers</div>
                <div className="small" style={{ marginTop: 4 }}>
                  <span className={p.showRate >= 70 ? 'accent bold' : 'bold'}>{p.showRate}%</span> show-rate ·{' '}
                  {p.guestsBrought.toLocaleString('en-IN')} guests brought
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
