import { useEffect, useState } from 'react';
import { liveBookings, LiveApiError, type LiveBooking } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Bookings (live)';
const TABS: { key: 'all' | LiveBooking['status']; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'refund_requested', label: 'Refund requested' },
  { key: 'refunded', label: 'Refunded' },
  { key: 'cancelled', label: 'Cancelled' },
];
const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Real bookings + refund queue against the actual database — the mock
 * Bookings.tsx/BookingDetail.tsx/ManualBooking.tsx stay as-is for now
 * (creating a manual/walk-up booking here is separate, real follow-up
 * scope, same boundary already disclosed for Events/EventEditor). */
export default function BookingsLive() {
  const session = useLiveSession();
  const { token } = session;

  const [bookings, setBookings] = useState<LiveBooking[]>([]);
  const [tab, setTab] = useState<'all' | LiveBooking['status']>('refund_requested');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    liveBookings
      .list()
      .then(setBookings)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const approveRefund = async (id: string) => {
    try {
      await liveBookings.approveRefund(id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to approve refund');
    }
  };

  const declineRefund = async (id: string) => {
    try {
      await liveBookings.declineRefund(id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to decline refund');
    }
  };

  const list = tab === 'all' ? bookings : bookings.filter((b) => b.status === tab);

  return (
    <div className="stack fade" style={{ maxWidth: 1200 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      <div className="tiny hint" style={{ marginTop: -6 }}>
        Real bookings and a real refund queue — approving here genuinely refunds the guest (wallet or source, per
        BookingsService) and restores ticket inventory.
      </div>

      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label} ({t.key === 'all' ? bookings.length : bookings.filter((b) => b.status === t.key).length})
          </button>
        ))}
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 720 }}>
          <span style={{ flex: 1.6 }}>Guest / event</span>
          <span style={{ flex: 0.8 }}>Qty</span>
          <span style={{ flex: 0.8 }}>Amount</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ flex: 1.4 }}>Actions</span>
        </div>
        {list.length === 0 && <div className="trow muted">No bookings in this view.</div>}
        {list.map((b) => (
          <div key={b.id} className="trow" style={{ minWidth: 720, flexWrap: 'wrap' }}>
            <span style={{ flex: 1.6 }}>
              <div
                style={{ fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setExpanded(expanded === b.id ? null : b.id)}
              >
                {b.mainGuest} · {b.event.title}
              </div>
              <div className="tiny muted">{b.id} · {b.whatsapp}</div>
              {expanded === b.id && (
                <div className="tiny muted" style={{ marginTop: 6 }}>
                  {b.tierName} · {b.paymentMethod ? `manual (${b.paymentMethod})` : 'online payment'}
                  <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                    {b.guests.map((g, i) => (
                      <li key={i}>{g.name}{g.checkedIn ? ' · checked in ✓' : ''}</li>
                    ))}
                  </ul>
                </div>
              )}
            </span>
            <span style={{ flex: 0.8 }}>{b.qty}</span>
            <span style={{ flex: 0.8 }}>{fmtMoney(b.total)}</span>
            <span style={{ flex: 1 }}>
              <span className={`tag ${b.status === 'confirmed' ? 'tag-green' : b.status === 'refund_requested' ? 'tag-red' : ''}`}>
                {b.status.replace('_', ' ')}
              </span>
            </span>
            <span style={{ flex: 1.4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {b.status === 'refund_requested' && (
                <>
                  <button className="btn btn-pri btn-sm" onClick={() => approveRefund(b.id)}>Approve refund</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => declineRefund(b.id)}>Decline</button>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
