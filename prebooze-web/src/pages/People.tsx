import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PEOPLE } from '../data/mock';
import { useApp } from '../store/AppContext';
import { personFollowKey } from '../lib/social';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import DirectoryCard from '../components/DirectoryCard';
import DirectoryCardSkeleton from '../components/DirectoryCardSkeleton';
import type { Person } from '../types';
import { cityHome, eventPath } from '../lib/urls';
import { Users, Flame, Ticket, CheckCircle2 } from 'lucide-react';

/** Directory of followable guests — the social graph behind "Who's going".
 * Real, opt-in guests only (User.discoverable) — PEOPLE mock stays only as
 * the offline/dev-mode fallback, same pattern as Home.tsx's other pools. */
export default function People() {
  const { city, following, netFollowers, toggleFollow, bookings, interested } = useApp();
  const [tab, setTab] = useState<'discover' | 'following'>('discover');
  const [q, setQ] = useState('');

  const [livePeople, setLivePeople] = useState<Person[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.people(city).then(setLivePeople).catch(() => setLivePeople([]));
  }, [city]);
  const loading = isBackendEnabled() && livePeople === null;
  const cityPeople = livePeople ?? (isBackendEnabled() ? [] : PEOPLE.filter((p) => p.city === city));

  // Real "N in common" — intersects each person's real going[] (see
  // catalog.service.ts's people(), privacy-gated by their own
  // attendanceVisibility) against the viewer's own real bookings/interested.
  const myEventIds = useMemo(
    () => new Set([...bookings.filter((b) => b.status !== 'cancelled').map((b) => b.eventId), ...interested]),
    [bookings, interested]
  );
  const commonCount = (p: Person) => (p.going ?? []).filter((e) => myEventIds.has(e.id)).length;

  const followingCount = cityPeople.filter((p) => following.includes(personFollowKey(p.id))).length;

  const list = useMemo(() => {
    let l = cityPeople;
    if (tab === 'following') l = l.filter((p) => following.includes(personFollowKey(p.id)));
    if (q.trim()) {
      const s = q.toLowerCase();
      l = l.filter((p) => (p.name + p.username).toLowerCase().includes(s));
    }
    return [...l].sort((a, b) => commonCount(b) - commonCount(a) || b.followers - a.followers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, cityPeople, q, following, myEventIds]);

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to={cityHome(city)}>Home</Link> / People
        </div>

        <div className="card" style={{ marginBottom: 18, padding: '22px 24px', background: 'rgba(155,225,61,.05)' }}>
          <h1 style={{ fontSize: 26, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>Find your people <Users size={22} /></h1>
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

        <div style={{ marginBottom: 18 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search people in ${city}…`} style={{ width: '100%' }} />
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 14 }}>
            {Array.from({ length: 8 }, (_, i) => <DirectoryCardSkeleton key={i} />)}
          </div>
        ) : list.length === 0 ? (
          <div className="empty">
            {tab === 'following' ? (
              <>You’re not following anyone in {city} yet. <button className="link bold" style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }} onClick={() => setTab('discover')}>Discover people →</button></>
            ) : (
              `No people in ${city} yet.`
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(258px, 1fr))', gap: 14 }}>
            {list.map((p) => {
              const key = personFollowKey(p.id);
              const isFollowing = following.includes(key);
              const going = p.going ?? [];
              const common = commonCount(p);
              return (
                <DirectoryCard
                  key={p.id}
                  to={`/u/${p.username}`}
                  hue={p.avatarHue}
                  avatarImage={p.avatarUrl}
                  avatarText={p.name[0]}
                  name={p.name}
                  verified={p.verified}
                  meta={`@${p.username} · ${p.city}`}
                  bio={p.bio}
                  stats={<><b>{netFollowers(key, p.followers).toLocaleString('en-IN')}</b> followers · <b>{going.length}</b> going</>}
                  extra={(common > 0 || going.length > 0) && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {common > 0 && (
                        <span className="tag" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Flame size={12} /> {common} in common</span>
                      )}
                      {going.slice(0, common > 0 ? 1 : 2).map((e) => (
                        // Person.going only carries {id, slug, title} — no
                        // city — so this links via the visitor's current
                        // browsing city; EventDetail's useCityReconcile
                        // self-corrects to the event's real city on load
                        // if that guess was wrong, same as any legacy link.
                        <Link key={e.id} to={eventPath(city, e.slug)} className="tag" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ticket size={11} /> {e.title}</Link>
                      ))}
                    </div>
                  )}
                  action={
                    <button className={`btn btn-sm btn-block ${isFollowing ? 'btn-ghost' : 'btn-pri'}`} onClick={() => toggleFollow(key)}>
                      {isFollowing ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Following <CheckCircle2 size={13} /></span> : '+ Follow'}
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
