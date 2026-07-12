import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { EVENTS, fmtDate, fmtTime, venueById } from '../../data/mock';

/** Events this promoter is approved to promote — organizer-enabled events whose
 * allow-list includes this promoter. */
export default function PromoterPromotions() {
  const { user, myEvents, promoterGuests, promoterTeam, toast } = useApp();
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
          const link = `${window.location.origin}/p/${e.slug}/${mySlug}`;
          const mine = promoterGuests.filter((g) => g.eventId === e.id && g.promoterSlug === mySlug);
          const myGuests = mine.length;
          const arrived = mine.filter((g) => g.arrived).length;
          const earned = cfg.perHeadPayout ? arrived * cfg.perHeadAmount : 0;
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

              <div className="tiny muted-2" style={{ marginTop: 12 }}>
                You've brought <b className="accent">{myGuests}</b> guest{myGuests === 1 ? '' : 's'} to this event
                {arrived > 0 && <> · <b className="accent">{arrived}</b> arrived</>}
                {earned > 0 && <> · earned <b className="accent">₹{earned}</b></>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="btn btn-pri btn-sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(link).catch(() => {});
                    toast('Affiliate link copied ✓');
                  }}
                >
                  🔗 Copy affiliate link
                </button>
                <Link to={`/promoter/guests/${e.id}`} className="btn btn-ghost btn-sm">📋 Guest list</Link>
                <a href={link} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Preview link ↗</a>
                <Link to={`/events/${e.slug}`} className="btn btn-ghost btn-sm">View event →</Link>
              </div>
              <div className="tiny muted-2" style={{ marginTop: 6, wordBreak: 'break-all' }}>{link}</div>

              {cfg.allowTeams && promoterTeam.length > 0 && (
                <div style={{ marginTop: 12, borderTop: '1px dashed var(--border-dash)', paddingTop: 10 }}>
                  <div className="tiny muted-2" style={{ marginBottom: 6 }}>👥 Team links — each tagged to a member:</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {promoterTeam.map((m) => {
                      const sub = `${link}?via=${m.handle}`;
                      const g = promoterGuests.filter((x) => x.eventId === e.id && x.promoterSlug === mySlug && x.subPromoter === m.handle);
                      return (
                        <div key={m.handle} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className="small bold" style={{ flex: '0 0 auto' }}>{m.name}</span>
                          <span className="tiny muted-2">{g.length} brought · {g.filter((x) => x.arrived).length} in</span>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ marginLeft: 'auto' }}
                            onClick={() => {
                              navigator.clipboard?.writeText(sub).catch(() => {});
                              toast(`${m.name}'s link copied ✓`);
                            }}
                          >
                            🔗 Copy
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
