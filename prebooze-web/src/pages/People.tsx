import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PEOPLE, eventsForPerson, eventById } from '../data/mock';
import { useApp } from '../store/AppContext';
import { personFollowKey } from '../lib/social';
import DirectoryCard from '../components/DirectoryCard';
import type { Person } from '../types';

/** Directory of followable guests — the social graph behind "Who's going". */
export default function People() {
  const { city, following, bookings, interested, toggleFollow } = useApp();
  const [tab, setTab] = useState<'discover' | 'following'>('discover');
  const [q, setQ] = useState('');
  const [cityF, setCityF] = useState(() => {
    const cs = new Set(PEOPLE.map((p) => p.city));
    return cs.has(city) ? city : 'All';
  });

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
    return l.sort((a, b) => commonCount(b) - commonCount(a) || b.followers - a.followers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, cityF, q, following, myEventIds]);

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/">Home</Link> / People
        </div>

        <div className="card" style={{ marginBottom: 18, padding: '22px 24px', background: 'rgba(155,225,61,.05)' }}>
          <h1 style={{ fontSize: 26, marginBottom: 4 }}>Find your people 👋</h1>
          <p className="muted" style={{ maxWidth: 560 }}>
            Follow the crews and regulars whose nights you want in on — then you’ll see who’s going before you book.
          </p>
        </div>

        <div className="chip-row" style={{ marginBottom: 12 }}>
          <button className={`chip ${tab === 'discover' ? 'on' : ''}`} onClick={() => setTab('discover')}>Discover</button>
          <button className={`chip ${tab === 'following' ? 'on' : ''}`} onClick={() => setTab('following')}>
            Following {followingCount > 0 && `· ${followingCount}`}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people by name, handle or city…" style={{ flex: 1, minWidth: 200 }} />
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
                <DirectoryCard
                  key={p.id}
                  to={`/u/${p.username}`}
                  hue={p.avatarHue}
                  avatarText={p.name[0]}
                  name={p.name}
                  verified={p.verified}
                  meta={`@${p.username} · ${p.city}`}
                  bio={p.bio}
                  stats={<><b>{p.followers.toLocaleString('en-IN')}</b> followers · <b>{going.length}</b> going</>}
                  extra={(common > 0 || goingEvents.length > 0) && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {common > 0 && (
                        <span className="tag" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 700 }}>🔥 {common} in common</span>
                      )}
                      {goingEvents.slice(0, common > 0 ? 1 : 2).map((e) => (
                        <Link key={e.id} to={`/events/${e.slug}`} className="tag" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎟 {e.title}</Link>
                      ))}
                    </div>
                  )}
                  action={
                    <button className={`btn btn-sm btn-block ${isFollowing ? 'btn-ghost' : 'btn-pri'}`} onClick={() => toggleFollow(key)}>
                      {isFollowing ? 'Following ✓' : '+ Follow'}
                    </button>
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
