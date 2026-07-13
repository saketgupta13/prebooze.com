import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { personByUsername, eventsForPerson, eventById, fmtDate, fmtTime, venueById } from '../data/mock';
import { useApp } from '../store/AppContext';
import {
  personFollowKey, personFollowing, personFollowers, mutualFollows, followedByYourFollows,
} from '../lib/social';
import type { Event, Person } from '../types';

function Avatar({ hue, name, size = 30 }: { hue: number; name: string; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue} 55% 45%)`, color: '#fff', display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.38,
    }}>{name[0]}</span>
  );
}

function AvatarStack({ people }: { people: Person[] }) {
  return (
    <div style={{ display: 'flex' }}>
      {people.slice(0, 5).map((p, i) => (
        <span key={p.id} title={p.name} style={{
          width: 26, height: 26, borderRadius: '50%', background: `hsl(${p.avatarHue} 55% 45%)`,
          color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 11, marginLeft: i ? -8 : 0, border: '2px solid var(--bg)',
        }}>{p.name[0]}</span>
      ))}
    </div>
  );
}

function PeopleCard({ title, people, empty, onClose }: { title: string; people: Person[]; empty: string; onClose?: () => void }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3>{title} <span className="badge badge-accent">{people.length}</span></h3>
        {onClose && <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>}
      </div>
      {people.length === 0 ? (
        <div className="muted small">{empty}</div>
      ) : (
        people.map((p) => (
          <Link key={p.id} to={`/u/${p.username}`} className="evrow" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Avatar hue={p.avatarHue} name={p.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bold small">{p.name} {p.verified && <span className="verified">✓</span>}</div>
              <div className="tiny muted-2">@{p.username} · {p.city}</div>
            </div>
            <span className="link small">View →</span>
          </Link>
        ))
      )}
    </div>
  );
}

/** Public guest profile — followers, following, mutuals, and what they're going to. */
export default function PersonProfile() {
  const { username } = useParams();
  const { following, bookings, interested, toggleFollow } = useApp();
  const person = personByUsername(username ?? '');
  const [openList, setOpenList] = useState<'followers' | 'following' | null>(null);

  if (!person) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Person not found</h1>
          <Link to="/people" className="btn btn-pri" style={{ marginTop: 18 }}>Browse people</Link>
        </div>
      </main>
    );
  }

  const key = personFollowKey(person.id);
  const isFollowing = following.includes(key);
  const followingList = personFollowing(person);
  const followerList = personFollowers(person.id);
  const mutual = mutualFollows(person, following);
  const proof = followedByYourFollows(person.id, following);

  const myEventIds = new Set([...bookings.filter((b) => b.status !== 'cancelled').map((b) => b.eventId), ...interested]);
  const attending = eventsForPerson(person.id)
    .map((a) => ({ status: a.status, event: eventById(a.eventId) }))
    .filter((x): x is { status: 'going' | 'interested'; event: Event } => !!x.event);
  const going = attending.filter((x) => x.status === 'going');
  const interestedIn = attending.filter((x) => x.status === 'interested');
  const proofNames = proof.slice(0, 2).map((p) => p.name.split(' ')[0]).join(', ');
  const toggle = (which: 'followers' | 'following') => setOpenList((cur) => (cur === which ? null : which));

  const EventRow = ({ event }: { event: Event }) => {
    const venue = venueById(event.venueId);
    const mine = myEventIds.has(event.id);
    return (
      <Link to={`/events/${event.slug}`} className="evrow" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bold small">
            {event.title} {mine && <span className="badge badge-accent" style={{ fontSize: 10 }}>you too</span>}
          </div>
          <div className="tiny muted-2">{fmtDate(event.date)} · {fmtTime(event.date)} · {venue?.name}</div>
        </div>
        <span className="link small">View →</span>
      </Link>
    );
  };

  const StatBtn = ({ value, label, which }: { value: number | string; label: string; which?: 'followers' | 'following' }) => (
    <div
      className="s"
      onClick={which ? () => toggle(which) : undefined}
      style={which ? { cursor: 'pointer', borderColor: openList === which ? 'var(--accent)' : undefined } : undefined}
    >
      <div className="v">{value}</div>
      <div className="l">{label}{which ? ' ▾' : ''}</div>
    </div>
  );

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/people">People</Link> / {person.name}
        </div>

        {/* Header */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: 84, background: `hsl(${person.avatarHue} 32% 20%)` }} />
          <div style={{ padding: '0 22px 20px', marginTop: -34 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
              <span style={{
                width: 72, height: 72, borderRadius: '50%', background: `hsl(${person.avatarHue} 55% 45%)`,
                color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 30, border: '4px solid var(--bg)',
              }}>{person.name[0]}</span>
              <div style={{ flex: 1, minWidth: 180, paddingBottom: 4 }}>
                <h1 style={{ fontSize: 24 }}>{person.name} {person.verified && <span className="verified">✓</span>}</h1>
                <div className="muted small">@{person.username} · {person.city}</div>
              </div>
              <button className={`btn ${isFollowing ? 'btn-ghost' : 'btn-pri'}`} style={{ paddingBottom: 4 }} onClick={() => toggleFollow(key)}>
                {isFollowing ? 'Following ✓' : '+ Follow'}
              </button>
            </div>

            {person.bio && <p className="small" style={{ margin: '12px 0 0', maxWidth: 560 }}>{person.bio}</p>}

            <div className="stat3" style={{ marginTop: 14, gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <StatBtn value={person.followers.toLocaleString('en-IN')} label="followers" which="followers" />
              <StatBtn value={followingList.length} label="following" which="following" />
              <StatBtn value={going.length} label="going" />
            </div>

            {proof.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                <AvatarStack people={proof} />
                <span className="small">
                  Followed by <b>{proofNames}</b>{proof.length > 2 ? ` +${proof.length - 2}` : ''} you follow
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Expandable followers / following (click a stat) */}
        {openList === 'followers' && (
          <div style={{ marginBottom: 16 }}>
            <PeopleCard title="Followers" people={followerList} empty="No followers yet." onClose={() => setOpenList(null)} />
          </div>
        )}
        {openList === 'following' && (
          <div style={{ marginBottom: 16 }}>
            <PeopleCard title="Following" people={followingList} empty="Not following anyone yet." onClose={() => setOpenList(null)} />
          </div>
        )}

        {/* Two columns */}
        <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="card">
              <h3 style={{ marginBottom: 10 }}>Going <span className="badge badge-accent">{going.length}</span></h3>
              {going.length === 0 ? <div className="muted small">Nothing booked yet.</div> : going.map((x) => <EventRow key={x.event.id} event={x.event} />)}
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 10 }}>Interested <span className="badge badge-pending">{interestedIn.length}</span></h3>
              {interestedIn.length === 0 ? <div className="muted small">No saved events.</div> : interestedIn.map((x) => <EventRow key={x.event.id} event={x.event} />)}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <PeopleCard title="Mutual — you both follow" people={mutual} empty="No one in common yet. Follow more people to find mutuals." />
          </div>
        </div>
      </div>
    </main>
  );
}
