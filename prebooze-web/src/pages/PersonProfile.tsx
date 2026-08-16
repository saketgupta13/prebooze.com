import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fmtDate, fmtTime } from '../data/mock';
import { catalog } from '../api';
import { ApiError } from '../api/client';
import { useApp } from '../store/AppContext';
import { PageLoader } from '../components/Loader';
import { useSeo } from '../lib/useSeo';
import { stripHtml } from '../lib/richtext';
import { eventLocation } from '../lib/venue';
import type { Event, Person, PersonDetail } from '../types';

function Avatar({ hue, name, imageUrl, size = 30 }: { hue: number; name: string; imageUrl?: string; size?: number }) {
  if (imageUrl) {
    return <img src={imageUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />;
  }
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
        <span key={p.id} title={p.name} style={{ marginLeft: i ? -8 : 0, border: '2px solid var(--bg)', borderRadius: '50%' }}>
          <Avatar hue={p.avatarHue} name={p.name} imageUrl={p.avatarUrl} size={26} />
        </span>
      ))}
    </div>
  );
}

function PeopleCard({ title, people, empty, onClose, limit }: { title: string; people: Person[]; empty: string; onClose?: () => void; limit?: number; badge?: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const shown = limit && !expanded ? people.slice(0, limit) : people;
  const hidden = people.length - shown.length;
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3>{title} <span className="badge badge-accent">{people.length}</span></h3>
        {onClose && <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>}
      </div>
      {people.length === 0 ? (
        <div className="muted small">{empty}</div>
      ) : (
        <>
          {shown.map((p) => (
            <Link key={p.id} to={`/u/${p.username}`} className="evrow" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Avatar hue={p.avatarHue} name={p.name} imageUrl={p.avatarUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="bold small">{p.name} {p.verified && <span className="verified">✓</span>}</div>
                <div className="tiny muted-2">@{p.username} · {p.city}</div>
              </div>
              <span className="link small">View →</span>
            </Link>
          ))}
          {hidden > 0 && (
            <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 8 }} onClick={() => setExpanded(true)}>
              Show {hidden} more
            </button>
          )}
          {limit && expanded && people.length > limit && (
            <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 8 }} onClick={() => setExpanded(false)}>
              Show less
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Public guest profile — followers, following, mutuals, and what they're
 * going to. Used to resolve entirely against the seeded, disconnected
 * `Person` mock table (personByUsername) — a real guest's own profile
 * 404'd for everyone since real accounts were never in that seed data.
 * Now backed by GET /people/:username, a real User row. Mutual-follows and
 * "followed by people you follow" are computed here by intersecting the
 * real followers/following lists this endpoint returns with the viewer's
 * own real `following` (already in AppContext) — no separate server-side
 * viewer-relative computation needed for those two. */
export default function PersonProfile() {
  const { username } = useParams();
  const { following, bookings, interested, toggleFollow } = useApp();
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [openList, setOpenList] = useState<'followers' | 'following' | null>(null);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    catalog.person(username)
      .then(setPerson)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Person not found'))
      .finally(() => setLoading(false));
  }, [username]);

  useSeo(person?.bio ? { description: stripHtml(person.bio) } : null, person?.name, person?.avatarUrl);

  if (loading) return <PageLoader />;

  if (!person) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Person not found</h1>
          {err && <p className="muted small" style={{ marginTop: 8 }}>{err}</p>}
          <Link to="/people" className="btn btn-pri" style={{ marginTop: 18 }}>Browse people</Link>
        </div>
      </main>
    );
  }

  const key = 'person:' + person.id;
  const isFollowing = following.includes(key);
  const viewerFollowingPersonIds = new Set(following.filter((k) => k.startsWith('person:')).map((k) => k.slice('person:'.length)));
  const mutual = person.following.filter((p) => viewerFollowingPersonIds.has(p.id));
  const proof = person.followers.filter((p) => viewerFollowingPersonIds.has(p.id));

  const myEventIds = new Set([...bookings.filter((b) => b.status !== 'cancelled').map((b) => b.eventId), ...interested]);
  const going = person.going;
  const interestedIn = person.interested;
  const proofNames = proof.slice(0, 2).map((p) => p.name.split(' ')[0]).join(', ');
  const toggle = (which: 'followers' | 'following') => setOpenList((cur) => (cur === which ? null : which));

  const EventRow = ({ event }: { event: Event }) => {
    const mine = myEventIds.has(event.id);
    return (
      <Link to={`/events/${event.slug}`} className="evrow" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bold small">
            {event.title} {mine && <span className="badge badge-accent" style={{ fontSize: 10 }}>you too</span>}
          </div>
          <div className="tiny muted-2">{fmtDate(event.date)} · {fmtTime(event.date)} · {eventLocation(event, event.venue)}</div>
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
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Avatar hue={person.avatarHue} name={person.name} imageUrl={person.avatarUrl} size={72} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <h1 style={{ fontSize: 24 }}>{person.name} {person.verified && <span className="verified">✓</span>}</h1>
              <div className="muted small">@{person.username} · {person.city}</div>
            </div>
            <button className={`btn ${isFollowing ? 'btn-ghost' : 'btn-pri'}`} onClick={() => toggleFollow(key)}>
              {isFollowing ? 'Following ✓' : '+ Follow'}
            </button>
          </div>

          {person.bio && <div className="small rich-text" style={{ margin: '12px 0 0', maxWidth: 560 }} dangerouslySetInnerHTML={{ __html: person.bio }} />}

          <div className="stat3" style={{ marginTop: 14, gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <StatBtn value={person.followers.length} label="followers" which="followers" />
            <StatBtn value={person.following.length} label="following" which="following" />
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

        {/* Expandable followers / following (click a stat) */}
        {openList === 'followers' && (
          <div style={{ marginBottom: 16 }}>
            <PeopleCard title="Followers" people={person.followers} empty="No followers yet." onClose={() => setOpenList(null)} />
          </div>
        )}
        {openList === 'following' && (
          <div style={{ marginBottom: 16 }}>
            <PeopleCard title="Following" people={person.following} empty="Not following anyone yet." onClose={() => setOpenList(null)} />
          </div>
        )}

        {/* Two columns */}
        <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="card">
              <h3 style={{ marginBottom: 10 }}>Going <span className="badge badge-accent">{going.length}</span></h3>
              {going.length === 0 ? <div className="muted small">Nothing booked yet.</div> : going.map((e) => <EventRow key={e.id} event={e} />)}
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 10 }}>Interested <span className="badge badge-pending">{interestedIn.length}</span></h3>
              {interestedIn.length === 0 ? <div className="muted small">No saved events.</div> : interestedIn.map((e) => <EventRow key={e.id} event={e} />)}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <PeopleCard title="Mutual — you both follow" people={mutual} limit={5} empty="No one in common yet. Follow more people to find mutuals." />
          </div>
        </div>
      </div>
    </main>
  );
}
