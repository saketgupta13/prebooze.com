import { Link } from 'react-router-dom';
import { PEOPLE, eventsForPerson } from '../data/mock';
import { useApp } from '../store/AppContext';
import { personFollowKey } from '../lib/social';

function Avatar({ hue, name, size = 44 }: { hue: number; name: string; size?: number }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: `hsl(${hue} 55% 45%)`, color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: size * 0.36,
      }}
    >
      {name[0]}
    </span>
  );
}

/** Directory of followable guests — the social graph behind "Who's going". */
export default function People() {
  const { following, toggleFollow } = useApp();
  const sorted = [...PEOPLE].sort((a, b) => b.followers - a.followers);

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/">Home</Link> / People
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>People 👋</h1>
        <p className="muted" style={{ marginBottom: 22 }}>
          Follow the people whose nights you want in on — you’ll see who’s going before you book.
        </p>

        <div className="grid-3">
          {sorted.map((p) => {
            const key = personFollowKey(p.id);
            const isFollowing = following.includes(key);
            const going = eventsForPerson(p.id).length;
            return (
              <div key={p.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Link to={`/u/${p.username}`}><Avatar hue={p.avatarHue} name={p.name} /></Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link to={`/u/${p.username}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <h3 style={{ fontSize: 15 }}>
                      {p.name} {p.verified && <span className="verified">✓</span>}
                    </h3>
                  </Link>
                  <div className="meta muted small">@{p.username} · {p.city}</div>
                  <div className="tiny muted-2">{p.followers.toLocaleString('en-IN')} followers · {going} event{going === 1 ? '' : 's'}</div>
                </div>
                <button
                  className={`btn btn-sm ${isFollowing ? 'btn-ghost' : 'btn-pri'}`}
                  onClick={() => toggleFollow(key)}
                >
                  {isFollowing ? 'Following ✓' : 'Follow'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
