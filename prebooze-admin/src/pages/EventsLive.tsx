import { useEffect, useState } from 'react';
import { liveEvents, LiveApiError, type LiveEvent } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Events (live)';
const STATUS_TABS: { key: 'all' | LiveEvent['status']; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'draft', label: 'Draft' },
];

/** Real event approval queue + per-event commission — backs the "Events &
 * approvals" and "Event commission (per event)" permission modules against
 * the actual database, alongside the existing mock Events.tsx/EventEditor.tsx
 * (full create/edit still goes through those — this is scoped to approval +
 * commission, the two real, requested admin actions, not a full event-CRUD
 * rewrite). There's no real delete-event endpoint on the backend, so unlike
 * the mock page there's no remove button here. */
export default function EventsLive() {
  const session = useLiveSession();
  const { token } = session;

  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [tab, setTab] = useState<'all' | LiveEvent['status']>('pending');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveEvents
      .list()
      .then(setEvents)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const approve = async (id: string) => {
    try {
      await liveEvents.approve(id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to approve');
    }
  };

  const submitReject = async (id: string) => {
    try {
      await liveEvents.reject(id, rejectReason.trim());
      setRejectingId(null);
      setRejectReason('');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to reject');
    }
  };

  const saveCommission = async (id: string, value: string) => {
    const v = value.trim() === '' ? null : parseFloat(value);
    if (v != null && (Number.isNaN(v) || v < 0 || v > 100)) {
      setErr('Commission must be between 0 and 100');
      return;
    }
    try {
      await liveEvents.setCommission(id, v);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save commission');
    }
  };

  const togglePaidOut = async (e: LiveEvent) => {
    try {
      await liveEvents.setPaidOut(e.id, !e.paidOut);
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to update');
    }
  };

  const toggleSalesPaused = async (e: LiveEvent) => {
    try {
      await liveEvents.setSalesPaused(e.id, !e.salesPaused);
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to update');
    }
  };

  const list = tab === 'all' ? events : events.filter((e) => e.status === tab);

  return (
    <div className="stack fade" style={{ maxWidth: 1200 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      <div className="tiny hint" style={{ marginTop: -6 }}>
        Real approve/reject + per-event commission against the real database. Full event create/edit (title, tickets,
        media, lineup) is still the mock Events/Event editor pages above — this is scoped to approval + commission.
      </div>

      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="tabs">
        {STATUS_TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label} ({t.key === 'all' ? events.length : events.filter((e) => e.status === t.key).length})
          </button>
        ))}
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 780 }}>
          <span style={{ flex: 2 }}>Event</span>
          <span style={{ flex: 1.2 }}>Organizer / venue</span>
          <span style={{ flex: 1 }}>Sold / cap</span>
          <span style={{ flex: 0.9 }}>Commission</span>
          <span style={{ flex: 1.6 }}>Actions</span>
        </div>
        {list.length === 0 && <div className="trow muted">No events in this view.</div>}
        {list.map((e) => {
          const sold = e.tiers.reduce((a, t) => a + t.sold, 0);
          const cap = e.tiers.reduce((a, t) => a + t.quantity, 0);
          return (
            <div key={e.id} className="trow" style={{ minWidth: 780, flexWrap: 'wrap' }}>
              <span style={{ flex: 2 }}>
                <div style={{ fontWeight: 700 }}>{e.title}</div>
                <div className="tiny muted">{e.category} · {new Date(e.date).toLocaleDateString('en-IN')} · {e.status}</div>
                {e.status === 'rejected' && e.rejectionReason && (
                  <div className="tiny" style={{ color: 'var(--red)' }}>reason: {e.rejectionReason}</div>
                )}
              </span>
              <span style={{ flex: 1.2 }} className="muted small">
                {e.organizer.brandName}
                <br />
                {e.venue.name} · {e.venue.city}
              </span>
              <span style={{ flex: 1 }}>{e.status === 'pending' ? '—' : `${sold}/${cap}`}</span>
              <span style={{ flex: 0.9, display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  className="input"
                  style={{ width: 56, padding: '4px 6px' }}
                  defaultValue={e.commission == null ? '' : String(e.commission)}
                  placeholder="unset"
                  inputMode="numeric"
                  onBlur={(ev) => {
                    if (ev.target.value.trim() !== (e.commission == null ? '' : String(e.commission))) {
                      saveCommission(e.id, ev.target.value);
                    }
                  }}
                />
                %
              </span>
              <span style={{ flex: 1.6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {e.status === 'pending' && (
                  <>
                    <button className="btn btn-pri btn-sm" onClick={() => approve(e.id)}>Approve</button>
                    {rejectingId === e.id ? (
                      <>
                        <input
                          className="input"
                          style={{ width: 140, padding: '4px 6px' }}
                          placeholder="reason"
                          value={rejectReason}
                          onChange={(ev) => setRejectReason(ev.target.value)}
                          autoFocus
                        />
                        <button className="btn btn-danger btn-sm" onClick={() => submitReject(e.id)}>Confirm</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setRejectingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => setRejectingId(e.id)}>Reject</button>
                    )}
                  </>
                )}
                {e.status === 'approved' && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => togglePaidOut(e)}>
                      {e.paidOut ? 'Mark unpaid' : 'Mark paid out'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleSalesPaused(e)}>
                      {e.salesPaused ? 'Resume sales' : 'Pause sales'}
                    </button>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
