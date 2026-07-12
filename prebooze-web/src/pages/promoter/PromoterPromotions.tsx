import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { EVENTS, fmtDate, fmtTime, venueById } from '../../data/mock';

/** Events this promoter is approved to promote — organizer-enabled events whose
 * allow-list includes this promoter. */
export default function PromoterPromotions() {
  const { user, myEvents } = useApp();
  const mySlug = user?.promoterUsername ?? '';
  const allEvents = [...myEvents, ...EVENTS.filter((e) => !myEvents.some((m) => m.id === e.id))];

  const promotions = allEvents.filter(
    (e) =>
      e.status === 'approved' &&
      e.promoterConfig?.enabled &&
      e.promoterConfig.allowedPromoters.includes(mySlug)
  );

  if (promotions.length === 0) {
    return (
      <div>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>My promotions</h1>
        <div className="empty">
          <div style={{ fontSize: 30, marginBottom: 10 }}>📣</div>
          No events yet. Organizers invite promoters per event — once you're added to an event's promoter
          list it shows up here with your affiliate link and a live guest list.
          <div className="tiny muted-2" style={{ marginTop: 10 }}>
            (you're signed in as <b>@{mySlug || 'unknown'}</b> — an organizer must allow this handle)
          </div>
          <div style={{ marginTop: 16 }}>
            <Link to="/browse" className="btn btn-ghost">Browse events in your city →</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>My promotions</h1>
      <p className="muted small" style={{ marginBottom: 18 }}>
        Events you're approved to promote. Share your link, fill the free-entry list before the cutoff, and watch
        arrivals live. <span className="muted-2">(affiliate links + live monitoring arrive in the next update)</span>
      </p>

      <div className="stack" style={{ display: 'grid', gap: 12 }}>
        {promotions.map((e) => {
          const venue = venueById(e.venueId);
          const cfg = e.promoterConfig!;
          return (
            <div key={e.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 16 }}>{e.title}</h3>
                  <div className="muted small">
                    {fmtDate(e.date)} · {fmtTime(e.date)} · {venue?.name}, {venue?.city}
                  </div>
                </div>
                <span className="badge badge-accent" style={{ height: 'fit-content' }}>You're allowed ✓</span>
              </div>

              <div className="hr" />

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div className="tiny muted-2">Free-entry cap</div>
                  <div className="bold">{cfg.cap} passes</div>
                </div>
                <div>
                  <div className="tiny muted-2">Free before</div>
                  <div className="bold">{cfg.cutoff}</div>
                </div>
                {cfg.perHeadPayout && (
                  <div>
                    <div className="tiny muted-2">You earn / arrival</div>
                    <div className="bold accent">₹{cfg.perHeadAmount}</div>
                  </div>
                )}
                {cfg.allowTeams && (
                  <div>
                    <div className="tiny muted-2">Teams</div>
                    <div className="bold">Allowed</div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="btn btn-pri btn-sm" disabled title="Coming in the next update">
                  🔗 Get affiliate link
                </button>
                <button className="btn btn-ghost btn-sm" disabled title="Coming in the next update">
                  📋 Guest list
                </button>
                <Link to={`/events/${e.slug}`} className="btn btn-ghost btn-sm">View event →</Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
