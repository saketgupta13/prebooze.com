import { Link, useParams } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { EVENTS, fmtDate, venueById } from '../../data/mock';

/** A promoter's own captured guests for one event (count vs cap). Real-time
 * arrivals + attribution come in Phase 4. */
export default function PromoterGuestList() {
  const { eventId } = useParams();
  const { user, myEvents, promoterGuests } = useApp();
  const mySlug = user?.promoterUsername ?? '';
  const event = [...myEvents, ...EVENTS].find((e) => e.id === eventId);

  if (!event || !event.promoterConfig?.enabled) {
    return (
      <div>
        <h1 style={{ fontSize: 24 }}>Event not found</h1>
        <Link to="/promoter/promotions" className="btn btn-ghost" style={{ marginTop: 12 }}>← My promotions</Link>
      </div>
    );
  }

  const mine = promoterGuests.filter((g) => g.eventId === event.id && g.promoterSlug === mySlug);
  const totalOnEvent = promoterGuests.filter((g) => g.eventId === event.id).length;
  const cap = event.promoterConfig.cap;
  const venue = venueById(event.venueId);

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/promoter/promotions">← My promotions</Link> / {event.title}
      </div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Your guest list</h1>
      <div className="muted small" style={{ marginBottom: 18 }}>
        {event.title} · {fmtDate(event.date)} · {venue?.name}
      </div>

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi"><div className="l">Your guests</div><div className="v">{mine.length}</div></div>
        <div className="kpi"><div className="l">Heads (incl. +0)</div><div className="v">{mine.length}</div></div>
        <div className="kpi"><div className="l">Event list</div><div className="v">{totalOnEvent}<span className="muted small"> / {cap}</span></div></div>
      </div>

      <div className="card">
        {mine.length === 0 ? (
          <div className="muted small">
            Nobody yet — share your affiliate link and guests will appear here the moment they join.
          </div>
        ) : (
          <>
            <div className="evrow" style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)' }}>
              <span style={{ flex: 1.6 }}>Guest</span>
              <span style={{ flex: 1 }}>Phone</span>
              <span style={{ flex: 0.6 }}>Age</span>
              <span style={{ flex: 1 }}>Gender</span>
            </div>
            {mine.map((g) => (
              <div key={g.id} className="evrow">
                <span style={{ flex: 1.6 }} className="bold small">{g.name}</span>
                <span style={{ flex: 1 }} className="muted small">{g.phone}</span>
                <span style={{ flex: 0.6 }} className="small">{g.age}</span>
                <span style={{ flex: 1 }} className="muted small">{g.gender}</span>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="tiny muted-2" style={{ marginTop: 10 }}>
        real-time arrivals, check-in status and per-head earnings arrive in the next update
      </div>
    </div>
  );
}
