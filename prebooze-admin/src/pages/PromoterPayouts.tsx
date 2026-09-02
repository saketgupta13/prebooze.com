import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, Percent, CheckCircle2 } from 'lucide-react';
import { livePayments, LiveApiError, type LivePromoterPayoutRow } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { Kpi, Tag } from '../components/ui';

const TITLE = 'Promoter payouts';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

const STATUS_LABEL: Record<LivePromoterPayoutRow['status'], string> = {
  pending: 'Not paid yet',
  reminder_sent: 'Reminder sent',
  received: 'Received ✓',
};
const STATUS_CLASS: Record<LivePromoterPayoutRow['status'], string> = {
  pending: 'tag-amber',
  reminder_sent: 'tag-amber',
  received: 'tag-green',
};

/** Platform-wide view of organizer -> promoter money (PaymentsService.
 * promoterPayoutsAll) — per-head arrivals + revenue-share on paid bookings,
 * across every event. Real transfers happen entirely outside Prebooze (no
 * split-payment rail exists); status is whatever the promoter has
 * self-attested via PromoterEventSettlement — admin has no "mark paid"
 * action here, this is visibility only. */
export default function PromoterPayouts() {
  const session = useLiveSession();
  const { token } = session;

  const [rows, setRows] = useState<LivePromoterPayoutRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | LivePromoterPayoutRow['status']>('All');
  const [q, setQ] = useState('');

  // Prebooze's OWN promoter-referral commission (2026-09-02) — a completely
  // separate money flow from `rows` above (organizer-funded, self-attested).
  // This one Prebooze itself owes directly, so admin can actually mark it
  // paid here, unlike the rest of this page.
  const [platformDue, setPlatformDue] = useState<{ promoterId: string; promoterName: string; due: number }[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);

  const loadPlatformDue = () => {
    livePayments.platformCommissionDue().then(setPlatformDue).catch(() => {});
  };

  const load = () => {
    setLoading(true);
    setErr('');
    livePayments
      .promoterPayouts()
      .then(setRows)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
    loadPlatformDue();
  };
  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const markPlatformPaid = async (promoterId: string) => {
    setPayingId(promoterId);
    try {
      await livePayments.markPlatformCommissionPaid(promoterId);
      loadPlatformDue();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to mark paid');
    } finally {
      setPayingId(null);
    }
  };

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const filtered = rows.filter((r) => {
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    if (q && !(r.promoterName + r.eventTitle + r.organizerBrand).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const totalOwed = rows.filter((r) => r.status !== 'received').reduce((a, r) => a + r.total, 0);
  const totalConfirmed = rows.filter((r) => r.status === 'received').reduce((a, r) => a + r.total, 0);

  return (
    <div className="stack fade" style={{ maxWidth: 1000 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">{TITLE}</h1>
      </div>
      <p className="tiny hint" style={{ marginTop: -6 }}>
        Real bank transfers between organizers and promoters happen entirely outside Prebooze — this is visibility
        only, sourced from what each promoter has self-confirmed. Nothing here moves money.
      </p>

      <div className="tblwrap">
        <div className="display" style={{ fontWeight: 700, padding: '10px 14px', borderBottom: '1px solid rgba(139,195,74,.15)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Percent size={14} /> Prebooze's own promoter commission — you owe this directly
        </div>
        <div className="tiny hint" style={{ padding: '0 14px 8px' }}>
          Separate from the table below — 2% of Prebooze's own commission on paid tickets sold through a promoter's
          city-events link, no organizer involved. "Mark paid" clears everything currently owed to that promoter.
        </div>
        <div className="thead" style={{ minWidth: 500 }}>
          <span style={{ flex: 1.6 }}>Promoter</span>
          <span style={{ flex: 1 }}>Owed</span>
          <span style={{ flex: 1.2 }} />
        </div>
        {platformDue.map((r) => (
          <div key={r.promoterId} className="trow" style={{ minWidth: 500 }}>
            <span style={{ flex: 1.6, fontWeight: 700 }}>{r.promoterName}</span>
            <span style={{ flex: 1 }} className="green">₹{fmt(r.due)}</span>
            <span style={{ flex: 1.2, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <Link to={`/payments/details?type=promoter&id=${r.promoterId}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="View payment details (opens in new tab)">
                <Landmark size={12} />
              </Link>
              <button className="btn btn-pri btn-sm" disabled={payingId === r.promoterId} onClick={() => markPlatformPaid(r.promoterId)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {payingId === r.promoterId ? 'Marking…' : <><CheckCircle2 size={12} /> Mark paid</>}
              </button>
            </span>
          </div>
        ))}
        {platformDue.length === 0 && <div className="trow muted">Nothing owed right now.</div>}
      </div>

      <div className="kpis">
        <Kpi label="Still owed (not confirmed)" value={`₹${fmt(totalOwed)}`} />
        <Kpi label="Confirmed received" value={`₹${fmt(totalConfirmed)}`} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" placeholder="Search promoter, event, organizer…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select className="chip" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="All">All statuses</option>
          <option value="pending">Not paid yet</option>
          <option value="reminder_sent">Reminder sent</option>
          <option value="received">Received</option>
        </select>
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 760 }}>
          <span style={{ flex: 1.4 }}>Promoter</span>
          <span style={{ flex: 1.6 }}>Event</span>
          <span style={{ flex: 1.2 }}>Organizer</span>
          <span style={{ flex: 1 }}>Amount</span>
          <span style={{ flex: 1.2 }}>Status</span>
        </div>
        {filtered.map((r) => (
          <div key={`${r.eventId}-${r.promoterId}`} className="trow" style={{ minWidth: 760, flexWrap: 'wrap' }}>
            <span style={{ flex: 1.4, fontWeight: 700 }}>
              <Link to={`/payments/details?type=promoter&id=${r.promoterId}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title="View payment details (opens in new tab)">
                {r.promoterName} <Landmark size={12} style={{ opacity: 0.6 }} />
              </Link>
            </span>
            <span style={{ flex: 1.6 }} className="small">{r.eventTitle}</span>
            <span style={{ flex: 1.2 }} className="small muted">{r.organizerBrand}</span>
            <span style={{ flex: 1 }} className="small">
              ₹{fmt(r.total)}
              {(r.perHead > 0 || r.commission > 0) && (
                <div className="tiny muted-2">
                  {r.perHead > 0 && <>₹{fmt(r.perHead)} guest list</>}
                  {r.perHead > 0 && r.commission > 0 && ' + '}
                  {r.commission > 0 && <>₹{fmt(r.commission)} revenue share</>}
                </div>
              )}
            </span>
            <span style={{ flex: 1.2 }}>
              <Tag label={STATUS_LABEL[r.status]} cls={STATUS_CLASS[r.status]} />
            </span>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="tiny muted" style={{ padding: '16px 0' }}>No promoter payouts yet.</div>
        )}
      </div>
    </div>
  );
}
