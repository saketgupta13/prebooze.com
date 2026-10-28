import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { fmt } from '../store/data';
import { Kpi, SearchBox } from '../components/ui';
import { liveCarts, liveEvents, LiveApiError, type LiveCart, type LiveCartStats, type LiveEvent, type LiveFollowUpOutcome } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { MessageCircle, CheckCircle2, RotateCcw, Phone, X, Trash2 } from 'lucide-react';

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
  // approved and not yet over. Draft/pending/rejected/past titles would
  // otherwise clutter this dropdown with nothing recoverable behind them.
  const liveEventOptions = useMemo(() => events.filter((e) => e.status === 'approved' && !isPastEvent(e)), [events]);

  const cityOptions = useMemo(() => [...new Set(carts.map((c) => c.city).filter((c): c is string => !!c))].sort(), [carts]);

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
    setDraftOutcome(r.followUpOutcome ?? '');
    setDraftNote(r.note ?? '');
  };

  const saveFollowUp = async (r: GroupedRow) => {
    setErr('');
    try {
      const at = draftAt ? new Date(draftAt).toISOString() : undefined;
      await Promise.all(r.cartIds.map((id) => liveCarts.setFollowUp(id, true, { at, outcome: draftOutcome || null, note: draftNote.trim() })));
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBox value={query} onChange={setQuery} placeholder="guest / phone…" style={{ flex: 1, minWidth: 180 }} />
        <select
          className="chip"
          style={{ appearance: 'none', cursor: 'pointer', background: eventF !== 'all' ? 'var(--green)' : 'var(--bg)', color: eventF !== 'all' ? 'var(--on-green)' : '#c7cbb9' }}
          value={eventF}
          onChange={(e) => setEventF(e.target.value)}
        >
          <option value="all">Live events ▾</option>
          {liveEventOptions.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
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
          style={{ appearance: 'none', cursor: 'pointer', background: outcomeF !== 'all' ? 'var(--green)' : 'var(--bg)', color: outcomeF !== 'all' ? 'var(--on-green)' : '#c7cbb9' }}
          value={outcomeF}
          onChange={(e) => setOutcomeF(e.target.value as typeof outcomeF)}
        >
          <option value="all">All follow-up ▾</option>
          <option value="not_contacted">Not contacted</option>
          {(Object.keys(OUTCOME_LABELS) as LiveFollowUpOutcome[]).map((k) => (
            <option key={k} value={k}>{OUTCOME_LABELS[k]}</option>
          ))}
        </select>
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

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 900 }}>
          <span style={{ flex: 1.3 }}>Guest</span>
          <span style={{ flex: 1.5 }}>Event</span>
          <span style={{ flex: 0.7 }}>Value</span>
          <span style={{ flex: 0.6 }}>Abandoned</span>
          <span style={{ flex: 0.8 }}>Status</span>
          <span style={{ flex: 0.9 }}>Follow-up</span>
          <span style={{ flex: 1.6 }} />
        </div>
        {groupedRows.map((r) => {
          const count = r.cartIds.length;
          const eventLabel = r.eventTitles.length > 2
            ? `${r.eventTitles.slice(0, 2).join(', ')} +${r.eventTitles.length - 2} more`
            : r.eventTitles.join(', ');
          const editing = editingPhone === r.phone;
          return (
          <div key={r.phone} className="trow" style={{ minWidth: 900, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ flex: 1.3 }}>
                <b>{count > 1 ? `${count}× ` : ''}{r.guest}</b>
                <span className="tiny muted" style={{ display: 'block' }}>{r.phone}</span>
              </span>
              <span style={{ flex: 1.5 }}>{eventLabel}</span>
              <span style={{ flex: 0.7, fontWeight: 700 }}>₹{fmt(r.totalValue)}</span>
              <span style={{ flex: 0.6 }} className="muted tiny">{timeAgo(r.latestCreatedAt)}</span>
              <span style={{ flex: 0.8 }}>
                {r.allReminded ? (
                  <span className="tag" style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>reminded</span>
                ) : (
                  <span className="tag" style={{ borderColor: 'var(--border)' }}>abandoned</span>
                )}
              </span>
              <span style={{ flex: 0.9 }}>
                <button
                  className="chip"
                  style={{
                    fontSize: 10.5, padding: '3px 10px',
                    borderColor: r.allContacted ? (r.followUpOutcome ? OUTCOME_COLORS[r.followUpOutcome] : 'var(--green)') : 'var(--border)',
                    color: r.allContacted ? (r.followUpOutcome ? OUTCOME_COLORS[r.followUpOutcome] : 'var(--green)') : undefined,
                  }}
                  onClick={() => openEditor(r)}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Phone size={10} /> {r.allContacted ? (r.followUpOutcome ? OUTCOME_LABELS[r.followUpOutcome] : 'Contacted') : 'Not contacted'}
                  </span>
                </button>
              </span>
              <span style={{ flex: 1.6, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => bulkRemind(r.cartIds)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {r.allReminded ? <><RotateCcw size={12} /> Remind again</> : <><MessageCircle size={12} /> Send reminder{count > 1 ? ` (${count})` : ''}</>}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => openEditor(r)}>
                  {r.allContacted ? 'Edit follow-up' : '+ Log call'}
                </button>
                <button className="btn btn-danger btn-sm" style={{ padding: '2px 7px' }} onClick={() => removeCarts(r)}>
                  <Trash2 size={12} />
                </button>
              </span>
            </div>
            {r.allContacted && !editing && (
              <div className="tiny muted" style={{ paddingLeft: 2 }}>
                {r.followUpAt && <>called {timeAgo(r.followUpAt)} &middot; </>}
                {r.note || 'no note'}
                <button className="btn btn-ghost btn-sm" style={{ padding: '0 6px', marginLeft: 6 }} onClick={() => clearFollowUp(r)}><X size={10} /> clear</button>
              </div>
            )}
            {editing && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="datetime-local"
                  className="input"
                  style={{ padding: '5px 8px', width: 190 }}
                  value={draftAt}
                  onChange={(e) => setDraftAt(e.target.value)}
                />
                <select className="input" style={{ padding: '5px 8px', width: 150 }} value={draftOutcome} onChange={(e) => setDraftOutcome(e.target.value as LiveFollowUpOutcome | '')}>
                  <option value="">Outcome…</option>
                  {(Object.keys(OUTCOME_LABELS) as LiveFollowUpOutcome[]).map((k) => (
                    <option key={k} value={k}>{OUTCOME_LABELS[k]}</option>
                  ))}
                </select>
                <input
                  className="input"
                  style={{ padding: '5px 8px', flex: 1, minWidth: 160 }}
                  placeholder="what happened on the call…"
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  autoFocus
                />
                <button className="btn btn-pri btn-sm" onClick={() => saveFollowUp(r)}>Save</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingPhone(null)}><X size={12} /></button>
              </div>
            )}
          </div>
          );
        })}
        {filtered.length === 0 && !loading && <div className="trow muted">No {scope} abandoned carts match.</div>}
      </div>
      <div className="tiny hint">
        recovery is a real WhatsApp + email reminder (no discount) · organizers pay nothing to recover — this is platform oversight
      </div>
    </div>
  );
}
