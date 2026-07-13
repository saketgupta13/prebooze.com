import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PEOPLE, eventsForPerson, eventById } from '../data/mock';
import { useApp } from '../store/AppContext';
import { personFollowKey } from '../lib/social';
import type { Person } from '../types';

function Avatar({ hue, name, size = 46 }: { hue: number; name: string; size?: number }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: `hsl(${hue} 55% 45%)`, color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: size * 0.36, border: '3px solid var(--bg)',
      }}
    >
      {name[0]}
    </span>
  );
}

/** Directory of followable guests — the social graph behind "Who's going". */
export default function People() {
  const { following, bookings, interested, toggleFollow } = useApp();
  const [tab, setTab] = useState<'discover' | 'following'>('discover');
  const [q, setQ] = useState('');
  const [cityF, setCityF] = useState('All');

  const cities = ['All', ...Array.from(new Set(PEOPLE.map((p) => p.city)))];
  const myEventIds = useMemo(
    () => new Set([...bookings.filter((b) => b.status !== 'cancelled').map((b) => b.eventId), ...interested]),
    [bookings, interested]
  );
  const commonCount = (p: Person) => eventsForPerson(p.id).filter((a) => myEventIds.has(a.eventId)).length;
  const followingCount = PEOPLE.filter((p) => following.includes(personFollowKey(p.id))).length;

  const list = useMemo(() => {
    let l = [...PEOPLE];
    if (tab === 'following') l = l.filter((p) => following.includes(personFollowKey(p.id)));
    if (cityF !== 'All') l = l.filter((p) => p.city === cityF);
    if (q.trim()) {
      const s = q.toLowerCase();
      l = l.filter((p) => (p.name + p.username + p.city).toLowerCase().includes(s));
    }
    // Discover surfaces the most relevant first: shared plans, then popularity.
    return l.sort((a, b) => commonCount(b) - commonCount(a) || b.followers - a.followers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, cityF, q, following, myEventIds]);

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/">Home</Link> / People
        </div>

        {/* Hero */}
        <div
          className="card"
          style={{
            marginBottom: 18, padding: '22px 24px', border: 'none',
            background: 'linear-gradient(120deg, rgba(155,225,61,.14), rgba(155,225,61,.03))',
          }}
        >
          <h1 style={{ fontSize: 26, marginBottom: 4 }}>Find your people 👋</h1>
          <p className="muted" style={{ maxWidth: 560 }}>
            Follow the crews and regulars whose nights you want in on — then you’ll see who’s going before you book.
          </p>
        </div>

        {/* Tabs */}
        <div className="chip-row" style={{ marginBottom: 12 }}>
          <button className={`chip ${tab === 'discover' ? 'on' : ''}`} onClick={() => setTab('discover')}>Discover</button>
          <button className={`chip ${tab === 'following' ? 'on' : ''}`} onClick={() => setTab('following')}>
            Following {followingCount > 0 && `· ${followingCount}`}
          </button>
        </div>

        {/* Search + city filter */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people by name, handle or city…"
            style={{ flex: 1, minWidth: 200 }}
          />
          <div className="chip-row" style={{ margin: 0 }}>
            {cities.map((c) => (
              <button key={c} className={`chip ${cityF === c ? 'on' : ''}`} onClick={() => setCityF(c)}>{c}</button>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <div className="empty">
            {tab === 'following' ? (
              <>You’re not following anyone yet. <button className="link bold" style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }} onClick={() => setTab('discover')}>Discover people →</button></>
            ) : (
              'No people match your search.'
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 14 }}>
            {list.map((p) => {
              const key = personFollowKey(p.id);
              const isFollowing = following.includes(key);
              const going = eventsForPerson(p.id).filter((a) => a.status === 'going');
              const goingEvents = going.map((a) => eventById(a.eventId)).filter((e): e is NonNullable<typeof e> => !!e);
              const common = commonCount(p);
              return (
                <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 52, background: `linear-gradient(135deg, hsl(${p.avatarHue} 60% 50%), hsl(${(p.avatarHue + 45) % 360} 60% 42%))` }} />
                  <div style={{ padding: '0 16px 16px', marginTop: -23, display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <Link to={`/u/${p.username}`}><Avatar hue={p.avatarHue} name={p.name} /></Link>
                    <Link to={`/u/${p.username}`} style={{ textDecoration: 'none', color: 'inherit', marginTop: 8 }}>
                      <h3 style={{ fontSize: 15.5 }}>{p.name} {p.verified && <span className="verified">✓</span>}</h3>
                    </Link>
                    <div className="tiny muted-2">@{p.username} · {p.city}</div>
                    {p.bio && (
                      <p className="tiny muted" style={{ margin: '8px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {p.bio}
                      </p>
                    )}

                    <div className="tiny muted-2" style={{ marginTop: 8 }}>
                      <b>{p.followers.toLocaleString('en-IN')}</b> followers · <b>{going.length}</b> going
                    </div>

                    {(common > 0 || goingEvents.length > 0) && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {common > 0 && (
                          <span className="tag" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 700 }}>
                            🔥 {common} in common
                          </span>
                        )}
                        {goingEvents.slice(0, common > 0 ? 1 : 2).map((e) => (
                          <Link key={e.id} to={`/events/${e.slug}`} className="tag" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            🎟 {e.title}
                          </Link>
                        ))}
                      </div>
                    )}

                    <div style={{ flex: 1 }} />
                    <button
                      className={`btn btn-sm btn-block ${isFollowing ? 'btn-ghost' : 'btn-pri'}`}
                      style={{ marginTop: 14 }}
                      onClick={() => toggleFollow(key)}
                    >
                      {isFollowing ? 'Following ✓' : '+ Follow'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
