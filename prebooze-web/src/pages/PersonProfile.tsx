import { Link, useParams } from 'react-router-dom';
import { personByUsername, eventsForPerson, eventById, fmtDate, fmtTime, venueById } from '../data/mock';
import { useApp } from '../store/AppContext';
import { personFollowKey } from '../lib/social';

/** Public guest profile — followable, shows the events they're going to / interested in. */
export default function PersonProfile() {
  const { username } = useParams();
  const { following, toggleFollow } = useApp();
  const person = personByUsername(username ?? '');

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
  const attending = eventsForPerson(person.id)
    .map((a) => ({ status: a.status, event: eventById(a.eventId) }))
    .filter((x): x is { status: 'going' | 'interested'; event: NonNullable<ReturnType<typeof eventById>> } => !!x.event);
  const going = attending.filter((x) => x.status === 'going');
  const interested = attending.filter((x) => x.status === 'interested');

  const EventRow = ({ event }: { event: NonNullable<ReturnType<typeof eventById>> }) => {
    const venue = venueById(event.venueId);
    return (
      <Link to={`/events/${event.slug}`} className="evrow" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bold small">{event.title}</div>
          <div className="tiny muted-2">{fmtDate(event.date)} · {fmtTime(event.date)} · {venue?.name}</div>
        </div>
        <span className="link small">View →</span>
      </Link>
    );
  };

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/people">People</Link> / {person.name}
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 22 }}>
          <span
            style={{
              width: 76, height: 76, borderRadius: '50%', flexShrink: 0,
              background: `hsl(${person.avatarHue} 55% 45%)`, color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 30,
            }}
          >
            {person.name[0]}
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <span className="tag">Guest</span>
            <h1 style={{ fontSize: 24, margin: '6px 0 2px' }}>
              {person.name} {person.verified && <span className="verified">✓</span>}
            </h1>
            <div className="muted small">@{person.username} · {person.city} · {person.followers.toLocaleString('en-IN')} followers</div>
            {person.bio && <p className="small" style={{ marginTop: 8, maxWidth: 520 }}>{person.bio}</p>}
          </div>
          <button className={`btn ${isFollowing ? 'btn-ghost' : 'btn-pri'}`} onClick={() => toggleFollow(key)}>
            {isFollowing ? 'Following ✓' : 'Follow'}
          </button>
        </div>

        <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div className="card">
            <h3 style={{ marginBottom: 10 }}>Going <span className="badge badge-accent">{going.length}</span></h3>
            {going.length === 0 ? (
              <div className="muted small">Nothing booked yet.</div>
            ) : (
              going.map((x) => <EventRow key={x.event.id} event={x.event} />)
            )}
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 10 }}>Interested <span className="badge badge-pending">{interested.length}</span></h3>
            {interested.length === 0 ? (
              <div className="muted small">No saved events.</div>
            ) : (
              interested.map((x) => <EventRow key={x.event.id} event={x.event} />)
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
