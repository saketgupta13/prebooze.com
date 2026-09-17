import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { livePayments, LiveApiError, type LivePayeeDueRow, type LivePayeeEventRow, type LiveWithdrawalRow } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { Kpi, Tag } from '../components/ui';

const TITLE = 'Payments & payouts';
const TABS = ['Payouts due', 'All events', 'Withdrawal requests', 'Paid', 'Rejected', 'Disputes'];
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested', received: 'Received', initiated: 'Initiated', processed: 'Processed', complete: 'Complete', rejected: 'Rejected',
};
const STATUS_CLS: Record<string, string> = {
  requested: 'tag-dim', received: 'tag-amber', initiated: 'tag-amber', processed: 'tag-amber', complete: 'tag-green', rejected: 'tag-red',
};

/** Real per-payee payout register (PaymentsService.due/payeeDetail) — one
 * row per organizer/venue, not per event (2026-09-18); click a name to open
 * that payee's own page with bank details, the full event-wise commission
 * breakdown, and their withdrawal-request status tracking all together —
 * that's where every actual "mark paid" / "advance status" / "reject"
 * action now happens, so this page itself is a set of real, read-only
 * queues: who's owed money right now, whose self-serve request is still
 * open, and what's already been resolved (paid or rejected). The raw
 * sale/refund ledger used to live here too ("Transactions"/"Refunds" tabs)
 * but moved to its own standalone /transactions section (2026-09-18) — a
 * ledger feed isn't a payout concern, it never touches who gets paid. */
export default function Payments() {
  const session = useLiveSession();
  const { token } = session;
  const [tab, setTab] = useState(TABS[0]);

  const [rows, setRows] = useState<LivePayeeDueRow[]>([]);
  const [summary, setSummary] = useState({ collected: 0, commissionKept: 0, dueTotal: 0 });
  const [allEvents, setAllEvents] = useState<LivePayeeEventRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<LiveWithdrawalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    livePayments
      .due()
      .then(({ rows: r, ...s }) => { setRows(r); setSummary(s); })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
    livePayments.allEventsPayout().then(({ rows: r }) => setAllEvents(r)).catch(() => {});
    livePayments.withdrawalRequests().then(setWithdrawals).catch(() => {});
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  // Once a withdrawal is marked complete or rejected, it moves out of the
  // "Withdrawal requests" queue — a resolved request isn't something staff
  // need to keep looking at in the action queue. Paid and rejected are kept
  // as two separate tabs (not one "Completed" bucket) — a successful payout
  // and a declined request aren't the same kind of "done," and lumping them
  // together buried the ones that actually need a human to follow up.
  const openWithdrawals = withdrawals.filter((w) => w.status !== 'complete' && w.status !== 'rejected');
  const paidWithdrawals = withdrawals.filter((w) => w.status === 'complete');
  const rejectedWithdrawals = withdrawals.filter((w) => w.status === 'rejected');
  const unresolvedRejections = rejectedWithdrawals.filter((w) => !w.rejectionResolved).length;

  // The one real "how much have we actually sent out, all-time" figure —
  // deliberately summed from the withdrawal ledger's own 'complete' rows
  // (whichever route the money went out through, admin-push or self-serve
  // pull), not from any event's own paidOut flag — see
  // PaymentsService.allEventsPayout's comment for why those two would
  // silently disagree if used interchangeably.
  const paidOutAllTime = paidWithdrawals.reduce((a, w) => a + w.amount, 0);

  const PayeeLink = ({ type, id, name }: { type: 'organizer' | 'venue'; id: string; name: string }) => (
    <Link to={`/payments/payee/${type}/${id}`} className="link" style={{ fontWeight: 700, color: 'var(--green)' }}>{name}</Link>
  );

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Payments &amp; payouts</h1>
      </div>

      <div className="kpi-grid">
        <Kpi label="Collected (all-time)" value={`₹${fmt(summary.collected)}`} />
        <Kpi label="Our earning — commission kept (all-time)" value={`₹${fmt(summary.commissionKept)}`} />
        <Kpi label="Paid out (all-time)" value={`₹${fmt(paidOutAllTime)}`} />
        <Kpi label="Due total" value={<span className="red">₹{fmt(summary.dueTotal)}</span>} alert />
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t}{t === 'Rejected' && unresolvedRejections > 0 ? ` (${unresolvedRejections})` : ''}
          </button>
        ))}
      </div>

      {tab === 'Payouts due' ? (
        <div className="tblwrap">
          <div className="thead" style={{ minWidth: 640 }}>
            <span style={{ flex: 1.6 }}>Name</span>
            <span style={{ flex: 0.9 }}>Type</span>
            <span style={{ flex: 0.9 }}>Events</span>
            <span style={{ flex: 1 }}>Due</span>
            <span style={{ flex: 0.9 }} />
          </div>
          {rows.length === 0 && !loading && <div className="trow muted">No payouts due — events only show up here once they've actually happened.</div>}
          {rows.map((r) => (
            <div key={`${r.payeeType}:${r.payeeId}`} className="trow" style={{ minWidth: 640 }}>
              <span style={{ flex: 1.6 }}><PayeeLink type={r.payeeType} id={r.payeeId} name={r.payeeName} /></span>
              <span style={{ flex: 0.9 }}><Tag label={r.payeeType === 'organizer' ? 'Organizer' : 'Venue'} cls="tag-dim" /></span>
              <span style={{ flex: 0.9 }} className="muted">{r.eventCount}</span>
              <span style={{ flex: 1, fontWeight: 700 }} className="green">
                ₹{fmt(r.due)}
                {r.payeeBalance < r.due && <span className="tiny" style={{ display: 'block', fontWeight: 400, color: 'var(--red)' }}>only ₹{fmt(r.payeeBalance)} left uncollected</span>}
              </span>
              <span style={{ flex: 0.9, display: 'flex', justifyContent: 'flex-end' }}>
                <Link to={`/payments/payee/${r.payeeType}/${r.payeeId}`} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  View <ArrowRight size={12} />
                </Link>
              </span>
            </div>
          ))}
        </div>
      ) : tab === 'All events' ? (
        <div className="tblwrap">
          <div className="thead" style={{ minWidth: 700 }}>
            <span style={{ flex: 1.3 }}>Event</span>
            <span style={{ flex: 1.2 }}>Organizer / venue</span>
            <span style={{ flex: 0.8 }}>Date</span>
            <span style={{ flex: 0.9 }}>Gross</span>
            <span style={{ flex: 1 }}>Our earning</span>
            <span style={{ flex: 1 }}>Payout</span>
          </div>
          {allEvents.length === 0 && !loading && <div className="trow muted">No finished events yet.</div>}
          {allEvents.map((r) => (
            <div key={r.id} className="trow" style={{ minWidth: 700 }}>
              <span style={{ flex: 1.3 }} className="muted small">{r.title}</span>
              <span style={{ flex: 1.2, fontWeight: 700 }}>
                {r.payeeType && r.payeeId ? <Link to={`/payments/payee/${r.payeeType}/${r.payeeId}`} className="link" style={{ color: 'var(--green)' }}>{r.organizer}</Link> : r.organizer}
              </span>
              <span style={{ flex: 0.8 }} className="tiny muted">{fmtDate(r.date)}</span>
              <span style={{ flex: 0.9 }}>₹{fmt(r.revenue)}</span>
              <span style={{ flex: 1 }}>₹{fmt(r.commissionAmt)} <span className="muted">({r.commission ?? 0}%)</span></span>
              <span style={{ flex: 1 }}>
                {r.paidOut ? (
                  <span className="tag tag-green">Paid{r.payoutUtr ? ` · ${r.payoutUtr}` : ''}</span>
                ) : (
                  <span className="tag tag-dim">₹{fmt(r.net)} due</span>
                )}
              </span>
            </div>
          ))}
        </div>
      ) : tab === 'Withdrawal requests' ? (
        <div className="tblwrap">
          <div className="thead" style={{ minWidth: 700 }}>
            <span style={{ flex: 1.4 }}>Name</span>
            <span style={{ flex: 0.9 }}>Type</span>
            <span style={{ flex: 1 }}>Amount</span>
            <span style={{ flex: 1 }}>Date</span>
            <span style={{ flex: 1 }}>Status</span>
            <span style={{ flex: 0.8 }} />
          </div>
          {openWithdrawals.length === 0 && !loading && <div className="trow muted">No open withdrawal requests.</div>}
          {openWithdrawals.map((w) => (
            <div key={w.id} className="trow" style={{ minWidth: 700 }}>
              <span style={{ flex: 1.4 }}><PayeeLink type={w.payeeType} id={w.payeeId} name={w.payeeName} /></span>
              <span style={{ flex: 0.9 }}><Tag label={w.payeeType === 'organizer' ? 'Organizer' : 'Venue'} cls="tag-dim" /></span>
              <span style={{ flex: 1, fontWeight: 700 }} className="green">₹{fmt(w.amount)}</span>
              <span style={{ flex: 1 }} className="tiny muted">{fmtDate(w.createdAt)}</span>
              <span style={{ flex: 1 }}><Tag label={STATUS_LABEL[w.status]} cls={STATUS_CLS[w.status]} /></span>
              <span style={{ flex: 0.8, display: 'flex', justifyContent: 'flex-end' }}>
                <Link to={`/payments/payee/${w.payeeType}/${w.payeeId}`} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Act <ArrowRight size={12} />
                </Link>
              </span>
            </div>
          ))}
        </div>
      ) : tab === 'Paid' ? (
        <div className="tblwrap">
          <div className="thead" style={{ minWidth: 650 }}>
            <span style={{ flex: 1.4 }}>Name</span>
            <span style={{ flex: 0.9 }}>Type</span>
            <span style={{ flex: 1 }}>Amount</span>
            <span style={{ flex: 1 }}>Date</span>
            <span style={{ flex: 1.4 }}>UTR</span>
          </div>
          {paidWithdrawals.length === 0 && !loading && <div className="trow muted">Nothing paid yet.</div>}
          {paidWithdrawals.map((w) => (
            <div key={w.id} className="trow" style={{ minWidth: 650 }}>
              <span style={{ flex: 1.4 }}><PayeeLink type={w.payeeType} id={w.payeeId} name={w.payeeName} /></span>
              <span style={{ flex: 0.9 }}><Tag label={w.payeeType === 'organizer' ? 'Organizer' : 'Venue'} cls="tag-dim" /></span>
              <span style={{ flex: 1, fontWeight: 700 }} className="green">₹{fmt(w.amount)}</span>
              <span style={{ flex: 1 }} className="tiny muted">{fmtDate(w.createdAt)}</span>
              <span style={{ flex: 1.4 }} className="tiny muted">{w.utr ?? '—'}</span>
            </div>
          ))}
        </div>
      ) : tab === 'Rejected' ? (
        <div className="tblwrap">
          <div className="thead" style={{ minWidth: 750 }}>
            <span style={{ flex: 1.3 }}>Name</span>
            <span style={{ flex: 0.9 }}>Type</span>
            <span style={{ flex: 0.9 }}>Amount</span>
            <span style={{ flex: 0.9 }}>Date</span>
            <span style={{ flex: 1.6 }}>Reason</span>
            <span style={{ flex: 1 }}>Follow-up</span>
            <span style={{ flex: 0.8 }} />
          </div>
          {rejectedWithdrawals.length === 0 && !loading && <div className="trow muted">Nothing rejected — good.</div>}
          {rejectedWithdrawals.map((w) => (
            <div key={w.id} className="trow" style={{ minWidth: 750 }}>
              <span style={{ flex: 1.3 }}><PayeeLink type={w.payeeType} id={w.payeeId} name={w.payeeName} /></span>
              <span style={{ flex: 0.9 }}><Tag label={w.payeeType === 'organizer' ? 'Organizer' : 'Venue'} cls="tag-dim" /></span>
              <span style={{ flex: 0.9, fontWeight: 700 }}>₹{fmt(w.amount)}</span>
              <span style={{ flex: 0.9 }} className="tiny muted">{fmtDate(w.createdAt)}</span>
              <span style={{ flex: 1.6 }} className="tiny">{w.rejectedReason ?? '—'}</span>
              <span style={{ flex: 1 }}>
                {w.rejectionResolved ? <Tag label="Resolved" cls="tag-dim" /> : <Tag label="Needs follow-up" cls="tag-amber" />}
              </span>
              <span style={{ flex: 0.8, display: 'flex', justifyContent: 'flex-end' }}>
                <Link to={`/payments/payee/${w.payeeType}/${w.payeeId}`} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {w.rejectionResolved ? 'View' : 'Follow up'} <ArrowRight size={12} />
                </Link>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="ph" style={{ height: 120, borderRadius: 10 }}>{tab} — coming with backend integration</div>
      )}
      <div className="tiny hint">
        commission % per row comes from each event's own rate — set in the event editor · sale/refund ledger moved to its own <Link to="/transactions" className="link">Transactions</Link> section.
      </div>
    </div>
  );
}
