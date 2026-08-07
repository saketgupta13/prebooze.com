import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, fmtTime } from '../../data/mock';
import { promoter as promoterApi, type PromoterMe, type PromoterTeamMember } from '../../api';
import { ApiError } from '../../api/client';
import Loader from '../../components/Loader';
import type { Event } from '../../types';
import type { PromoterGuest } from '../../store/AppContext';
import { copyToClipboard } from '../../lib/clipboard';

type Mode = 'guestlist' | 'commission';

/** Events this promoter is approved to promote — organizer-enabled events whose
 * allow-list includes this promoter. */
export default function PromoterPromotions() {
  const [me, setMe] = useState<PromoterMe | null>(null);
  const [promotions, setPromotions] = useState<Event[]>([]);
  const [guestsByEvent, setGuestsByEvent] = useState<Record<string, PromoterGuest[]>>({});
  const [team, setTeam] = useState<PromoterTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');
  // Which of the two modes is showing, per event — only relevant when an
  // event has both Guest list and Paid commission active for this promoter.
  const [activeTab, setActiveTab] = useState<Record<string, Mode>>({});
  const [orgFilter, setOrgFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');

  useEffect(() => {
    Promise.all([promoterApi.me(), promoterApi.promotions(), promoterApi.team()])
      .then(async ([m, promos, t]) => {
        setMe(m);
        setPromotions(promos);
        setTeam(t);
        const entries = await Promise.all(promos.map(async (e) => [e.id, await promoterApi.guests(e.id).catch(() => [])] as const));
        setGuestsByEvent(Object.fromEntries(entries));
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (err && !me) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err}</div>;

  const mySlug = me?.slug ?? '';
  const copy = async (link: string, key: string) => {
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } else {
      setErr('Could not copy — long-press or select the link below to copy it manually');
    }
  };

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

  // organizers this promoter is actually working with, and which events
  // belong to whichever one is selected — for promoters running lists across
  // several organizers at once, otherwise the list is just one long scroll
  const orgGroupKey = (e: Event) => e.organizerId ?? `venue:${e.venueId ?? ''}`;
  const organizerOptions = Array.from(new Map(promotions.map((e) => [
    orgGroupKey(e),
    e.organizer?.brandName ?? e.venue?.name ?? 'Venue-hosted',
  ])).entries());
  const eventOptions = promotions.filter((e) => orgFilter === 'all' || orgGroupKey(e) === orgFilter);
  const filteredPromotions = promotions.filter(
    (e) => (orgFilter === 'all' || orgGroupKey(e) === orgFilter) && (eventFilter === 'all' || e.id === eventFilter),
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>My promotions</h1>
      <p className="muted small" style={{ marginBottom: 18 }}>
        Events you're approved to promote. Each event can give you a free-entry link (guest skips the ticket), a
        ticket link that earns you a revenue-share cut on paid sales, or both — sent separately below, per event.
      </p>
      {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}

      {organizerOptions.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <select
            className="chip"
            value={orgFilter}
            onChange={(e) => { setOrgFilter(e.target.value); setEventFilter('all'); }}
          >
            <option value="all">All organizers</option>
            {organizerOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select className="chip" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
            <option value="all">All events</option>
            {eventOptions.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        </div>
      )}

      <div className="stack" style={{ display: 'grid', gap: 12 }}>
        {filteredPromotions.map((e) => {
          const venue = e.venue;
          const cfg = e.promoterConfig!;
          const link = `${window.location.origin}/p/${e.slug}/${mySlug}`;
          const revSharePct = cfg.revenueShare?.[mySlug] ?? 0;
          // Separate from the free-entry link above — this is the normal
          // event/ticket page with ?ref= attached, the only URL shape that
          // actually feeds the revenue-share markup (see EventDetail.tsx's
          // ?ref= capture + BookingsService.priceHold). The free-entry link
          // never touches a real ticket purchase, so it can't earn this.
          const ticketLink = `${window.location.origin}/events/${e.slug}?ref=${mySlug}`;
          const guestListOn = (cfg.guestListPromoters ?? cfg.allowedPromoters ?? []).includes(mySlug);
          const commissionOn = revSharePct > 0;
          const mine = guestsByEvent[e.id] ?? [];
          const myGuests = mine.length;
          const arrived = mine.filter((g) => g.arrived).length;
          const earned = cfg.perHeadPayout && guestListOn ? arrived * cfg.perHeadAmount : 0;
          const modes: Mode[] = [...(guestListOn ? (['guestlist'] as const) : []), ...(commissionOn ? (['commission'] as const) : [])];
          const tab: Mode | undefined = modes.length > 1 ? (activeTab[e.id] ?? modes[0]) : modes[0];

          return (
            <div key={e.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 16 }}>{e.title}</h3>
                  <div className="muted small">
                    {fmtDate(e.date)} · {fmtTime(e.date)} · {venue?.name}, {venue?.city}
                  </div>
                  {organizerOptions.length > 1 && <div className="tiny muted-2" style={{ marginTop: 2 }}>by {e.organizer?.brandName ?? 'organizer'}</div>}
                </div>
                <span className="badge badge-accent" style={{ height: 'fit-content' }}>You're allowed ✓</span>
              </div>

              <div className="hr" />

              {modes.length === 0 && (
                <div className="tiny muted-2">
                  Not active for you on this event yet — ask the organizer to enable Guest list or Paid commission
                  for you.
                </div>
              )}

              {modes.length > 1 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${tab === 'guestlist' ? 'btn-pri' : 'btn-ghost'}`}
                    onClick={() => setActiveTab((prev) => ({ ...prev, [e.id]: 'guestlist' }))}
                  >
                    🎟️ Guest list
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${tab === 'commission' ? 'btn-pri' : 'btn-ghost'}`}
                    onClick={() => setActiveTab((prev) => ({ ...prev, [e.id]: 'commission' }))}
                  >
                    💰 Paid commission
                  </button>
                </div>
              )}

              {tab === 'guestlist' && (
                <>
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
                  <div className="tiny muted-2" style={{ marginTop: 12 }}>🎟️ Free-entry link — guest skips the ticket, no purchase, no revenue-share earning</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button className="btn btn-pri btn-sm" onClick={() => copy(link, e.id)}>
                      {copied === e.id ? 'Copied ✓' : '🔗 Copy free-entry link'}
                    </button>
                    <Link to={`/promoter/guests/${e.id}`} className="btn btn-ghost btn-sm">📋 Guest list</Link>
                    <a href={link} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Preview link ↗</a>
                  </div>
                  <div className="tiny muted-2" style={{ marginTop: 6, wordBreak: 'break-all' }}>{link}</div>

                  {cfg.allowTeams && team.length > 0 && (
                    <div style={{ marginTop: 12, borderTop: '1px dashed var(--border-dash)', paddingTop: 10 }}>
                      <div className="tiny muted-2" style={{ marginBottom: 6 }}>👥 Team links — each tagged to a member:</div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {team.map((m) => {
                          const sub = `${link}?via=${m.handle}`;
                          const g = mine.filter((x) => x.subPromoter === m.handle);
                          const key = `${e.id}-${m.handle}`;
                          return (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span className="small bold" style={{ flex: '0 0 auto' }}>{m.name}</span>
                              <span className="tiny muted-2">{g.length} brought · {g.filter((x) => x.arrived).length} in</span>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ marginLeft: 'auto' }}
                                onClick={() => copy(sub, key)}
                              >
                                {copied === key ? 'Copied ✓' : '🔗 Copy'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {tab === 'commission' && (
                <>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <div className="tiny muted-2">Revenue share</div>
                      <div className="bold accent">{revSharePct}% on paid tickets</div>
                    </div>
                  </div>
                  <div className="tiny muted-2" style={{ marginTop: 12 }}>
                    💰 Ticket link — send this for a paid sale, you earn {revSharePct}% of the ticket price on it
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button className="btn btn-pri btn-sm" onClick={() => copy(ticketLink, `${e.id}-ticket`)}>
                      {copied === `${e.id}-ticket` ? 'Copied ✓' : '🔗 Copy ticket link'}
                    </button>
                    <a href={ticketLink} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Preview link ↗</a>
                  </div>
                  <div className="tiny muted-2" style={{ marginTop: 6, wordBreak: 'break-all' }}>{ticketLink}</div>
                </>
              )}

              <Link to={`/events/${e.slug}`} className="btn btn-ghost btn-sm" style={{ marginTop: 10, display: 'inline-block' }}>View event →</Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
