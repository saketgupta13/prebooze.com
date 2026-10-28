import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { fmt } from '../store/data';
import { Kpi, SearchBox } from '../components/ui';
import { liveCarts, liveEvents, LiveApiError, type LiveCart, type LiveCartStats, type LiveEvent, type LiveFollowUpOutcome } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { MessageCircle, CheckCircle2, RotateCcw, Phone, X, Trash2, CalendarClock } from 'lucide-react';

const TITLE = 'Abandoned carts';

const OUTCOME_LABELS: Record<LiveFollowUpOutcome, string> = {
  no_answer: 'No answer',
  declined: 'Declined',
  will_book: 'Will book',
};
const OUTCOME_COLORS: Record<LiveFollowUpOutcome, string> = {
  no_answer: 'var(--muted)',
  declined: 'var(--red)',
  will_book: 'var(--green)',
};

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time, not
// the ISO/UTC string the API returns or expects back.
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Same formula as EventsReal.tsx's isPastEvent / prebooze-api's
// CatalogService.isEventOver — used here only to keep the event filter
// dropdown down to events a guest could still actually be nudged back to
// book, not every draft/rejected/long-over title in the system.
const isPastEvent = (e: LiveEvent) => {
  if (e.seriesEndDate) return new Date(e.seriesEndDate).getTime() + 24 * 3600000 < Date.now();
  return new Date(e.date).getTime() + e.durationHrs * 3600000 < Date.now();
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// Real calendar date + clock time, not just "2h ago" — the whole point of
// letting a staffer pick a specific date/time for a logged call is to be
// able to see that exact value back, not just how long ago it rounds to.
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

const eventCity = (e: LiveEvent) => e.venue?.city ?? e.privateCity ?? null;

/** Platform-wide abandoned-cart recovery — real active carts (CartsService),
 * real KPIs (open/recoverable/recovered/recovery-rate — carts.stats(), added
 * alongside this merge since the recovered side wasn't exposed anywhere
 * before), and remind/bulk-remind that genuinely sends a WhatsApp + email
 * nudge instead of a mock toast. Same layout as the old mock page. */
export default function AbandonedCarts() {
  const session = useLiveSession();
  const { token } = session;

  const [carts, setCarts] = useState<LiveCart[]>([]);
  const [stats, setStats] = useState<LiveCartStats | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [eventF, setEventF] = useState('all');
  const [cityF, setCityF] = useState('all');
  const [outcomeF, setOutcomeF] = useState<'all' | 'not_contacted' | LiveFollowUpOutcome>('all');
  // Priority queue: 'value' surfaces the highest-recoverable-value carts
  // first (worth calling first), 'oldest' surfaces the longest-abandoned
  // ones first (closest to being truly lost / least likely to self-recover).
  const [sortBy, setSortBy] = useState<'value' | 'oldest'>('value');
  const [query, setQuery] = useState('');
  // A cart for an event that's already happened can't be recovered — nobody
  // can still buy that ticket — so Live/Past scopes on the event's own
  // date, same as Events/Bookings elsewhere in admin.
  const [scope, setScope] = useState<'live' | 'past'>('live');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState<ReactNode>('');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveCarts.list(undefined, scope === 'past'), liveCarts.stats(), liveEvents.list()])
      .then(([c, s, e]) => {
        setCarts(c);
        setStats(s);
        setEvents(e);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, scope]);

  const eventTitle = (id: string) => events.find((e) => e.id === id)?.title ?? id;

  // Only events a guest could still be nudged back to actually book —
  // approved and not yet over — and, once a city is picked, only that
  // city's events (an event filter that still lists Mumbai titles while
  // "Nagpur" is selected is just confusing, never useful).
  const liveEventOptions = useMemo(
    () => events.filter((e) => e.status === 'approved' && !isPastEvent(e) && (cityF === 'all' || eventCity(e) === cityF)),
    [events, cityF],
  );

  const cityOptions = useMemo(() => [...new Set(carts.map((c) => c.city).filter((c): c is string => !!c))].sort(), [carts]);

  // Switching city can orphan the currently-selected event (it belongs to
  // the old city) — reset rather than silently filtering on a stale id.
  useEffect(() => {
    if (eventF !== 'all' && !liveEventOptions.some((e) => e.id === eventF)) setEventF('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityF]);

  // The live/past split now happens server-side (CartsService.list's `past`
  // param) — carts is already scoped to whichever tab is active.
  const scoped = carts;

  const filtered = useMemo(() => {
    let l = scoped;
    if (eventF !== 'all') l = l.filter((c) => c.eventId === eventF);
    if (cityF !== 'all') l = l.filter((c) => c.city === cityF);
    if (outcomeF !== 'all') l = l.filter((c) => (outcomeF === 'not_contacted' ? !c.contacted : c.followUpOutcome === outcomeF));
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((c) => c.guest.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return l;
  }, [scoped, eventF, cityF, outcomeF, query]);

  const unremindedIds = filtered.filter((c) => !c.reminded).map((c) => c.id);

  // Same guest can abandon several carts (retries, different events) — one
  // row per guest (phone), not one row per cart: the event/value/status
  // columns roll up across all of that guest's open carts instead of
  // repeating their name/phone down a stack of near-identical rows.
  interface GroupedRow {
    phone: string;
    guest: string;
    cartIds: string[];
    eventTitles: string[];
    totalValue: number;
    latestCreatedAt: string;
    allReminded: boolean;
    allContacted: boolean;
    note: string | null;
    followUpAt: string | null;
    followUpOutcome: LiveFollowUpOutcome | null;
    nextFollowUpAt: string | null;
  }
  const groupedRows = useMemo(() => {
    const byPhone = new Map<string, GroupedRow>();
    filtered.forEach((c) => {
      const row = byPhone.get(c.phone);
      if (!row) {
        byPhone.set(c.phone, {
          phone: c.phone,
          guest: c.guest,
          cartIds: [c.id],
          eventTitles: [c.eventTitle],
          totalValue: c.amount,
          latestCreatedAt: c.createdAt,
          allReminded: c.reminded,
          allContacted: c.contacted,
          note: c.followUpNote,
          followUpAt: c.followUpAt,
          followUpOutcome: c.followUpOutcome,
          nextFollowUpAt: c.nextFollowUpAt,
        });
        return;
      }
      row.cartIds.push(c.id);
      if (!row.eventTitles.includes(c.eventTitle)) row.eventTitles.push(c.eventTitle);
      row.totalValue += c.amount;
      if (c.createdAt > row.latestCreatedAt) row.latestCreatedAt = c.createdAt;
      row.allReminded = row.allReminded && c.reminded;
      row.allContacted = row.allContacted && c.contacted;
      if (!row.note && c.followUpNote) row.note = c.followUpNote;
      if (!row.followUpAt && c.followUpAt) row.followUpAt = c.followUpAt;
      if (!row.followUpOutcome && c.followUpOutcome) row.followUpOutcome = c.followUpOutcome;
      if (!row.nextFollowUpAt && c.nextFollowUpAt) row.nextFollowUpAt = c.nextFollowUpAt;
    });
    const rows = [...byPhone.values()];
    rows.sort((a, b) => (sortBy === 'value' ? b.totalValue - a.totalValue : new Date(a.latestCreatedAt).getTime() - new Date(b.latestCreatedAt).getTime()));
    return rows;
  }, [filtered, sortBy]);

  const byEvent = useMemo(() => {
    const m = new Map<string, { count: number; value: number }>();
    scoped.forEach((c) => {
      const cur = m.get(c.eventId) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += c.amount;
      m.set(c.eventId, cur);
    });
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [scoped]);

  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [draftAt, setDraftAt] = useState('');
  const [draftNextAt, setDraftNextAt] = useState('');
  const [draftOutcome, setDraftOutcome] = useState<LiveFollowUpOutcome | ''>('');
  const [draftNote, setDraftNote] = useState('');

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const bulkRemind = async (ids: string[]) => {
    if (!ids.length) return;
    setErr('');
    try {
      const res = await liveCarts.bulkRemind(ids);
      setMsg(<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> {res.count} reminder(s) sent</span>);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to send reminders');
    }
  };

  // Applies to every cart in the guest's group at once — "contacted" is a
  // per-guest follow-up fact (one phone call covers all their open carts),
  // not a per-cart one.
  const openEditor = (r: GroupedRow) => {
    setEditingPhone(r.phone);
    setDraftAt(toLocalInputValue(r.followUpAt ?? new Date().toISOString()));
    setDraftNextAt(r.nextFollowUpAt ? toLocalInputValue(r.nextFollowUpAt) : '');
    setDraftOutcome(r.followUpOutcome ?? '');
    setDraftNote(r.note ?? '');
  };

  const saveFollowUp = async (r: GroupedRow) => {
    setErr('');
    try {
      const at = draftAt ? new Date(draftAt).toISOString() : undefined;
      const nextAt = draftNextAt ? new Date(draftNextAt).toISOString() : null;
      await Promise.all(r.cartIds.map((id) => liveCarts.setFollowUp(id, true, { at, nextAt, outcome: draftOutcome || null, note: draftNote.trim() })));
      setEditingPhone(null);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save follow-up');
    }
  };

  const clearFollowUp = async (r: GroupedRow) => {
    setErr('');
    try {
      await Promise.all(r.cartIds.map((id) => liveCarts.setFollowUp(id, false)));
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to clear follow-up');
    }
  };

  const removeCarts = async (r: GroupedRow) => {
    if (!window.confirm(`Remove ${r.cartIds.length > 1 ? `all ${r.cartIds.length} carts` : 'this cart'} for ${r.guest}? This can't be undone.`)) return;
    setErr('');
    try {
      await liveCarts.bulkRemove(r.cartIds);
      setMsg(<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> removed</span>);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to remove');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1100, gap: 14 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {msg && <div className="tiny" style={{ color: 'var(--green)' }}>{msg}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Abandoned carts</h1>
        <button
          className="btn btn-pri"
          disabled={unremindedIds.length === 0}
          onClick={() => bulkRemind(unremindedIds)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <MessageCircle size={15} /> Nudge all {unremindedIds.length ? `(${unremindedIds.length})` : ''}
        </button>
      </div>

      <div className="tabs">
        <button className={scope === 'live' ? 'on' : ''} onClick={() => setScope('live')}>Live</button>
        <button className={scope === 'past' ? 'on' : ''} onClick={() => setScope('past')}>Past</button>
      </div>

      {stats && (
        <div className="kpi-grid">
          <Kpi label="Open carts" value={fmt(stats.openCount)} />
          <Kpi label="Recoverable" value={`₹${fmt(stats.recoverable)}`} delta="if recovered" deltaColor="var(--muted)" />
          <Kpi label="Recovery rate" value={`${stats.recoveryRate}%`} delta={`₹${fmt(stats.recoveredValue)} recovered`} deltaColor="var(--green)" />
          <Kpi label="Recovered carts" value={fmt(stats.recoveredCount)} />
        </div>
      )}

      {/* Event-wise breakdown */}
      <div className="card">
        <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>By event</div>
        {byEvent.length === 0 ? (
          <div className="muted small">No {scope} abandoned carts.</div>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {byEvent.map(([id, v]) => {
              const maxV = byEvent[0][1].value;
              return (
                <div key={id} style={{ cursor: 'pointer' }} onClick={() => setEventF(id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <b>{eventTitle(id)}</b>
                    <span className="muted">{v.count} cart{v.count === 1 ? '' : 's'} · ₹{fmt(v.value)} recoverable</span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(139,195,74,.12)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
                    <div style={{ width: `${(v.value / maxV) * 100}%`, height: '100%', background: 'var(--green)', opacity: 0.5 + (v.value / maxV) * 0.5 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SearchBox value={query} onChange={setQuery} placeholder="search guest name or phone…" style={{ width: '100%' }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="chip"
            style={{ appearance: 'none', cursor: 'pointer', background: cityF !== 'all' ? 'var(--green)' : 'var(--bg)', color: cityF !== 'all' ? 'var(--on-green)' : '#c7cbb9' }}
            value={cityF}
            onChange={(e) => setCityF(e.target.value)}
          >
            <option value="all">All cities ▾</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className="chip"
            style={{ appearance: 'none', cursor: 'pointer', background: eventF !== 'all' ? 'var(--green)' : 'var(--bg)', color: eventF !== 'all' ? 'var(--on-green)' : '#c7cbb9' }}
            value={eventF}
            onChange={(e) => setEventF(e.target.value)}
          >
            <option value="all">{cityF === 'all' ? 'All live events ▾' : `Live events in ${cityF} ▾`}</option>
            {liveEventOptions.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
          <select
            className="chip"
            style={{ appearance: 'none', cursor: 'pointer', background: outcomeF !== 'all' ? 'var(--green)' : 'var(--bg)', color: outcomeF !== 'all' ? 'var(--on-green)' : '#c7cbb9' }}
            value={outcomeF}
            onChange={(e) => setOutcomeF(e.target.value as typeof outcomeF)}
          >
            <option value="all">Any follow-up status ▾</option>
            <option value="not_contacted">Not contacted</option>
            {(Object.keys(OUTCOME_LABELS) as LiveFollowUpOutcome[]).map((k) => (
              <option key={k} value={k}>{OUTCOME_LABELS[k]}</option>
            ))}
          </select>
          <div style={{ flex: 1 }} />
          <select
            className="chip"
            style={{ appearance: 'none', cursor: 'pointer' }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="value">Sort: highest value first</option>
            <option value="oldest">Sort: oldest first</option>
          </select>
        </div>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {groupedRows.map((r) => {
          const count = r.cartIds.length;
          const eventLabel = r.eventTitles.length > 2
            ? `${r.eventTitles.slice(0, 2).join(', ')} +${r.eventTitles.length - 2} more`
            : r.eventTitles.join(', ');
          const editing = editingPhone === r.phone;
          const outcomeColor = r.followUpOutcome ? OUTCOME_COLORS[r.followUpOutcome] : 'var(--green)';
          return (
          <div key={r.phone} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Row 1 — who, what, how much, how long ago */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div className="display" style={{ fontSize: 15, fontWeight: 700 }}>{count > 1 ? `${count}× ` : ''}{r.guest}</div>
                <div className="tiny muted">{r.phone}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>₹{fmt(r.totalValue)}</div>
                <div className="tiny muted">abandoned {timeAgo(r.latestCreatedAt)}</div>
              </div>
            </div>

            <div className="tiny muted">{eventLabel}</div>

            {/* Row 2 — status badges */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {r.allReminded ? (
                <span className="tag" style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>reminded</span>
              ) : (
                <span className="tag" style={{ borderColor: 'var(--border)' }}>not yet reminded</span>
              )}
              <span className="tag" style={{ borderColor: r.allContacted ? outcomeColor : 'var(--border)', color: r.allContacted ? outcomeColor : undefined, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Phone size={10} /> {r.allContacted ? (r.followUpOutcome ? OUTCOME_LABELS[r.followUpOutcome] : 'Contacted') : 'Not contacted'}
              </span>
              {r.allContacted && r.followUpAt && (
                <span className="tiny muted">called {formatDateTime(r.followUpAt)} ({timeAgo(r.followUpAt)})</span>
              )}
              {r.nextFollowUpAt && (
                <span className="tag" style={{ borderColor: new Date(r.nextFollowUpAt).getTime() < Date.now() ? 'var(--red)' : 'var(--amber, #c9a227)', color: new Date(r.nextFollowUpAt).getTime() < Date.now() ? 'var(--red)' : undefined, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CalendarClock size={10} /> call back {formatDateTime(r.nextFollowUpAt)}
                  {new Date(r.nextFollowUpAt).getTime() < Date.now() && ' — overdue'}
                </span>
              )}
            </div>
            {r.allContacted && !!r.note && !editing && (
              <div className="tiny muted" style={{ background: 'rgba(255,255,255,.03)', padding: '6px 10px', borderRadius: 6 }}>note: {r.note}</div>
            )}

            {/* Follow-up editor */}
            {editing && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 10, background: 'rgba(255,255,255,.03)', borderRadius: 8 }}>
                <div className="field" style={{ minWidth: 190 }}>
                  <label className="tiny muted">Call date &amp; time</label>
                  <input type="datetime-local" className="input" style={{ padding: '6px 8px', width: '100%' }} value={draftAt} onChange={(e) => setDraftAt(e.target.value)} />
                </div>
                <div className="field" style={{ minWidth: 190 }}>
                  <label className="tiny muted">Call back on (optional)</label>
                  <input type="datetime-local" className="input" style={{ padding: '6px 8px', width: '100%' }} value={draftNextAt} onChange={(e) => setDraftNextAt(e.target.value)} />
                </div>
                <div className="field" style={{ minWidth: 150 }}>
                  <label className="tiny muted">Outcome</label>
                  <select className="input" style={{ padding: '6px 8px', width: '100%' }} value={draftOutcome} onChange={(e) => setDraftOutcome(e.target.value as LiveFollowUpOutcome | '')}>
                    <option value="">— none —</option>
                    {(Object.keys(OUTCOME_LABELS) as LiveFollowUpOutcome[]).map((k) => (
                      <option key={k} value={k}>{OUTCOME_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ flex: 1, minWidth: 180 }}>
                  <label className="tiny muted">Note</label>
                  <input className="input" style={{ padding: '6px 8px', width: '100%' }} placeholder="what happened on the call…" value={draftNote} onChange={(e) => setDraftNote(e.target.value)} autoFocus />
                </div>
                <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
                  <button className="btn btn-pri btn-sm" onClick={() => saveFollowUp(r)}>Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingPhone(null)}><X size={12} /></button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => bulkRemind(r.cartIds)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {r.allReminded ? <><RotateCcw size={12} /> Remind again</> : <><MessageCircle size={12} /> Send reminder{count > 1 ? ` (${count})` : ''}</>}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => (editing ? setEditingPhone(null) : openEditor(r))}>
                {r.allContacted ? 'Edit follow-up' : '+ Log call'}
              </button>
              {r.allContacted && (
                <button className="btn btn-ghost btn-sm" onClick={() => clearFollowUp(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <X size={11} /> Clear follow-up
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button className="btn btn-danger btn-sm" onClick={() => removeCarts(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Trash2 size={12} /> Remove
              </button>
            </div>
          </div>
          );
        })}
        {filtered.length === 0 && !loading && <div className="card muted">No {scope} abandoned carts match.</div>}
      </div>
      <div className="tiny hint">
        recovery is a real WhatsApp + email reminder (no discount) · organizers pay nothing to recover — this is platform oversight
      </div>
    </div>
  );
}
