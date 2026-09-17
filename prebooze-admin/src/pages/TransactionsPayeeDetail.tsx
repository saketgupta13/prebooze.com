import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { liveTransactions, LiveApiError, type LiveTxEventRow, type LiveTxSaleRow, type LiveTxRefundRow } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { Kpi, Tag } from '../components/ui';

const TITLE = 'Transactions';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** One payee's events, each expandable into its own real Sales/Refunds tabs
 * (2026-09-18) — built off `Booking` rows directly, not ledger entries, so
 * a refund can show exactly how much commission it gave up
 * (`Booking.commission`, locked in at sale time) with no derivation. */
export default function TransactionsPayeeDetail() {
  const session = useLiveSession();
  const { token } = session;
  const { payeeType, payeeId } = useParams<{ payeeType: 'organizer' | 'venue'; payeeId: string }>();

  const [payeeName, setPayeeName] = useState('');
  const [rows, setRows] = useState<LiveTxEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [expanded, setExpanded] = useState<string | null>(null);
  const [eventTab, setEventTab] = useState<'sales' | 'refunds'>('sales');
  const [eventData, setEventData] = useState<Record<string, { eventTitle: string; sales: LiveTxSaleRow[]; refunds: LiveTxRefundRow[] }>>({});
  const [loadingEvent, setLoadingEvent] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !payeeType || !payeeId) return;
    setLoading(true);
    setErr('');
    liveTransactions.payeeEvents(payeeType, payeeId)
      .then((d) => { setPayeeName(d.payeeName); setRows(d.rows); })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, payeeType, payeeId]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const toggleEvent = async (eventId: string) => {
    if (expanded === eventId) { setExpanded(null); return; }
    setExpanded(eventId);
    setEventTab('sales');
    if (!eventData[eventId]) {
      setLoadingEvent(eventId);
      try {
        const d = await liveTransactions.eventTransactions(eventId);
        setEventData((prev) => ({ ...prev, [eventId]: d }));
      } catch (e) {
        setErr(e instanceof LiveApiError ? e.message : 'Failed to load event transactions');
      } finally {
        setLoadingEvent(null);
      }
    }
  };

  const totals = rows.reduce((a, r) => ({ salesTotal: a.salesTotal + r.salesTotal, refundsTotal: a.refundsTotal + r.refundsTotal, net: a.net + r.net }), { salesTotal: 0, refundsTotal: 0, net: 0 });

  return (
    <div className="stack fade" style={{ maxWidth: 1000 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <Link to="/transactions" className="tiny link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={13} /> Back to Transactions</Link>

      <div className="page-hd" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>{payeeName}</h1>
        {payeeType && <Tag label={payeeType === 'organizer' ? 'Organizer' : 'Venue'} cls="tag-dim" />}
      </div>

      <div className="kpi-grid">
        <Kpi label="Sales" value={`₹${fmt(totals.salesTotal)}`} />
        <Kpi label="Refunds" value={totals.refundsTotal > 0 ? <span className="red">₹{fmt(totals.refundsTotal)}</span> : `₹0`} />
        <Kpi label="Net" value={`₹${fmt(totals.net)}`} />
      </div>

      {loading && <div className="tiny muted">Loading…</div>}
      {!loading && rows.length === 0 && <div className="card"><div className="tiny muted">No transactions yet.</div></div>}

      <div className="stack" style={{ gap: 10 }}>
        {rows.map((r) => {
          const isOpen = expanded === r.eventId;
          const data = eventData[r.eventId];
          return (
            <div key={r.eventId} className="card">
              <button
                type="button"
                onClick={() => toggleEvent(r.eventId)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
              >
                <div>
                  <div className="bold">{r.eventTitle}</div>
                  <div className="tiny muted">
                    {fmtDate(r.eventDate)} · {r.salesCount} sale{r.salesCount === 1 ? '' : 's'}
                    {r.refundsCount ? `, ${r.refundsCount} refund${r.refundsCount === 1 ? '' : 's'}` : ''}
                    {r.pendingRefundsCount ? `, ${r.pendingRefundsCount} pending` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="bold">₹{fmt(r.net)}</span>
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </button>

              {isOpen && (
                <div style={{ marginTop: 12 }}>
                  <div className="tabs" style={{ marginBottom: 10 }}>
                    <button className={eventTab === 'sales' ? 'on' : ''} onClick={() => setEventTab('sales')}>Sales ({r.salesCount})</button>
                    <button className={eventTab === 'refunds' ? 'on' : ''} onClick={() => setEventTab('refunds')}>Refunds ({r.refundsCount + r.pendingRefundsCount})</button>
                  </div>
                  {loadingEvent === r.eventId && <div className="tiny muted">Loading…</div>}
                  {data && eventTab === 'sales' && (
                    <div className="tblwrap">
                      <div className="thead" style={{ minWidth: 500 }}>
                        <span style={{ flex: 1.4 }}>Guest</span>
                        <span style={{ flex: 1 }}>Amount</span>
                        <span style={{ flex: 1 }}>Commission</span>
                        <span style={{ flex: 1 }}>Date</span>
                      </div>
                      {data.sales.length === 0 && <div className="trow muted">No sales.</div>}
                      {data.sales.map((s) => (
                        <div key={s.id} className="trow" style={{ minWidth: 500 }}>
                          <span style={{ flex: 1.4 }}>{s.guest}</span>
                          <span style={{ flex: 1 }} className="green">₹{fmt(s.amount)}</span>
                          <span style={{ flex: 1 }} className="tiny muted">₹{fmt(s.commission)}</span>
                          <span style={{ flex: 1 }} className="tiny muted">{fmtDate(s.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {data && eventTab === 'refunds' && (
                    <div className="tblwrap">
                      <div className="thead" style={{ minWidth: 560 }}>
                        <span style={{ flex: 1.3 }}>Guest</span>
                        <span style={{ flex: 0.9 }}>Amount</span>
                        <span style={{ flex: 1 }}>Commission reversed</span>
                        <span style={{ flex: 0.9 }}>Status</span>
                        <span style={{ flex: 0.9 }}>Date</span>
                      </div>
                      {data.refunds.length === 0 && <div className="trow muted">No refunds.</div>}
                      {data.refunds.map((rf) => (
                        <div key={rf.id} className="trow" style={{ minWidth: 560 }}>
                          <span style={{ flex: 1.3 }}>{rf.guest}</span>
                          <span style={{ flex: 0.9 }} className="red">₹{fmt(rf.amount)}</span>
                          <span style={{ flex: 1 }} className="tiny muted">₹{fmt(rf.commissionReversed)} given up</span>
                          <span style={{ flex: 0.9 }}>
                            {rf.status === 'refund_requested' ? <Tag label="Requested" cls="tag-amber" /> : rf.failed ? <Tag label="Failed" cls="tag-red" /> : <Tag label="Refunded" cls="tag-dim" />}
                          </span>
                          <span style={{ flex: 0.9 }} className="tiny muted">{fmtDate(rf.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
