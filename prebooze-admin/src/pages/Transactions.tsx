import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { liveTransactions, LiveApiError, type LiveTxPayeeSummary } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { Kpi, Tag } from '../components/ui';

const TITLE = 'Transactions';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

/** Real sale/refund ledger, grouped by payee (2026-09-18) — a standalone
 * admin section, deliberately separate from "Payments & payouts" (this
 * never touches who gets paid or when, just what actually sold and what
 * got refunded). Click a name for that payee's event-by-event breakdown,
 * with real Sales/Refunds tabs per event (TransactionsPayeeDetail.tsx).
 * Only *completed* refunds count against the totals here — a still-pending
 * refund request hasn't moved any money yet. */
export default function Transactions() {
  const session = useLiveSession();
  const { token } = session;

  const [rows, setRows] = useState<LiveTxPayeeSummary[]>([]);
  const [totals, setTotals] = useState({ salesTotal: 0, refundsTotal: 0, net: 0 });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setErr('');
    liveTransactions.payeesSummary(from || undefined, to || undefined)
      .then((d) => { setRows(d.rows); setTotals(d.totals); })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, from, to]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  return (
    <div className="stack fade" style={{ maxWidth: 1000 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div className="page-hd" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 className="page-title">Transactions</h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" type="date" style={{ width: 140 }} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          <span className="tiny muted">–</span>
          <input className="input" type="date" style={{ width: 140 }} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          {(from || to) && <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); }}>All time</button>}
        </div>
      </div>
      <div className="tiny muted">Every real sale and refund, grouped by organizer/venue — click a name for the event-by-event breakdown.</div>

      <div className="kpi-grid">
        <Kpi label="Sales" value={`₹${fmt(totals.salesTotal)}`} />
        <Kpi label="Refunds" value={totals.refundsTotal > 0 ? <span className="red">₹{fmt(totals.refundsTotal)}</span> : `₹0`} />
        <Kpi label="Net" value={`₹${fmt(totals.net)}`} />
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 700 }}>
          <span style={{ flex: 1.4 }}>Name</span>
          <span style={{ flex: 0.9 }}>Type</span>
          <span style={{ flex: 1 }}>Sales</span>
          <span style={{ flex: 1 }}>Refunds</span>
          <span style={{ flex: 1 }}>Net</span>
          <span style={{ flex: 0.8 }} />
        </div>
        {rows.length === 0 && !loading && <div className="trow muted">No transactions in this range.</div>}
        {rows.map((r) => (
          <div key={`${r.payeeType}:${r.payeeId}`} className="trow" style={{ minWidth: 700 }}>
            <span style={{ flex: 1.4, fontWeight: 700 }}>
              <Link to={`/transactions/payee/${r.payeeType}/${r.payeeId}`} className="link" style={{ color: 'var(--green)' }}>{r.payeeName}</Link>
            </span>
            <span style={{ flex: 0.9 }}><Tag label={r.payeeType === 'organizer' ? 'Organizer' : 'Venue'} cls="tag-dim" /></span>
            <span style={{ flex: 1 }} className="green">₹{fmt(r.salesTotal)} <span className="tiny muted">({r.salesCount})</span></span>
            <span style={{ flex: 1 }}>
              {r.refundsTotal > 0 ? <span className="red">₹{fmt(r.refundsTotal)} <span className="tiny muted">({r.refundsCount})</span></span> : <span className="tiny muted">—</span>}
              {r.pendingRefundsCount > 0 && <span className="tiny" style={{ display: 'block', color: '#d99a2b' }}>{r.pendingRefundsCount} pending</span>}
            </span>
            <span style={{ flex: 1, fontWeight: 700 }}>₹{fmt(r.net)}</span>
            <span style={{ flex: 0.8, display: 'flex', justifyContent: 'flex-end' }}>
              <Link to={`/transactions/payee/${r.payeeType}/${r.payeeId}`} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                View <ArrowRight size={12} />
              </Link>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
