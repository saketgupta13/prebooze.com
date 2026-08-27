import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { liveSettlements, LiveApiError, type LiveSettlementDetail } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      style={{ padding: '2px 6px', fontSize: 11 }}
      onClick={() => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title="Copy"
    >
      {copied ? '✓' : '📋'}
    </button>
  );
}

/** One real Razorpay settlement batch, broken down to the payment level —
 * exact data from Razorpay's own settlement reconciliation report, not an
 * approximation by date range. Deliberately mirrors Razorpay's own
 * dashboard settlement-detail layout and terminology (Amount Breakup →
 * Gross Settlements / Deductions / Net Settlements) so this page reads as
 * the same picture staff would see if they opened Razorpay directly. */
export default function SettlementDetail() {
  const { id } = useParams();
  const session = useLiveSession();
  const { token } = session;

  const [data, setData] = useState<LiveSettlementDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    setErr('');
    liveSettlements
      .detail(id)
      .then(setData)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, id]);

  const gate = useLiveGate('Settlement', session);
  if (gate) return gate;

  const net = data ? data.grossTotal - data.feeTotal : 0;

  return (
    <div className="stack fade" style={{ maxWidth: 900, gap: 14 }}>
      <LiveHeaderBar title="Settlement" session={session} />
      <Link to="/settlements" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Settlements</Link>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      {data && (
        <>
          {/* Header — mirrors Razorpay's own settlement-detail header */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--green-soft, #d7f5da)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--green)', flexShrink: 0 }}>
              {data.settlement.status === 'processed' ? '✓' : '⏳'}
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>₹{fmt(data.settlement.amount)}</div>
              <div className="tiny muted">
                {data.settlement.status === 'processed' ? 'Deposited on ' : 'Status: ' + data.settlement.status + ' — '}
                {new Date(data.settlement.settledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="display" style={{ fontWeight: 700, fontSize: 14 }}>Details</div>
            <div className="kv"><span className="k muted">Settlement ID</span><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{data.settlement.id} <CopyChip value={data.settlement.id} /></span></div>
            <div className="kv"><span className="k muted">UTR number</span><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{data.settlement.utr ?? '—'} {data.settlement.utr && <CopyChip value={data.settlement.utr} />}</span></div>
          </div>

          {/* Amount Breakup — same structure/order Razorpay's own dashboard uses */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="display" style={{ fontWeight: 700, fontSize: 14 }}>Amount Breakup</div>

            <div className="kv"><span className="k" style={{ fontWeight: 700 }}>Gross Settlements</span><span className="green" style={{ fontWeight: 700 }}>₹{fmt(data.grossTotal)}</span></div>
            <div className="kv" style={{ paddingLeft: 14 }}><span className="k muted tiny">Payment</span><span className="tiny">₹{fmt(data.grossTotal)}</span></div>

            <div className="kv" style={{ marginTop: 4 }}><span className="k" style={{ fontWeight: 700 }}>Deductions</span><span className="red" style={{ fontWeight: 700 }}>₹{fmt(data.feeTotal)}</span></div>
            <div className="kv" style={{ paddingLeft: 14 }}><span className="k muted tiny">Goods and services tax (GST)</span><span className="tiny">₹{fmt(data.gstCutTotal)}</span></div>
            <div className="kv" style={{ paddingLeft: 14 }}><span className="k muted tiny">Platform fee charged on payments</span><span className="tiny">₹{fmt(data.razorpayCutTotal)}</span></div>

            <div className="kv" style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border, #eee)' }}>
              <span className="k" style={{ fontWeight: 800 }}>Net Settlements</span>
              <span className="green" style={{ fontWeight: 800 }}>₹{fmt(net)}</span>
            </div>
          </div>

          <div className="tiny hint">
            Real per-payment breakdown from Razorpay's own settlement reconciliation report — not an estimate. Only payments are shown below, not refunds/adjustments that may also be part of this batch.
          </div>

          {/* Payments */}
          <div className="display" style={{ fontWeight: 700, fontSize: 14 }}>
            Payments <span className="chip" style={{ display: 'inline-block', marginLeft: 4 }}>{data.payments.length}</span>
          </div>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 700 }}>
              <span style={{ flex: 1.5 }}>Guest / event</span>
              <span style={{ flex: 1 }}>Paid</span>
              <span style={{ flex: 1 }}>GST</span>
              <span style={{ flex: 1 }}>Platform fee</span>
              <span style={{ flex: 1 }}>Net</span>
              <span style={{ flex: 0.8 }}>Date</span>
            </div>
            {data.payments.map((p) => (
              <div key={p.paymentId} className="trow" style={{ minWidth: 700 }}>
                <span style={{ flex: 1.5 }}>
                  {p.bookingId ? (
                    <>
                      <Link to={`/bookings/${encodeURIComponent(p.bookingId)}`} style={{ fontWeight: 700 }}>{p.guestName ?? p.bookingId}</Link>
                      <div className="tiny muted">{p.eventTitle}</div>
                    </>
                  ) : (
                    <span className="muted tiny">{p.paymentId}</span>
                  )}
                </span>
                <span style={{ flex: 1, fontWeight: 700 }}>₹{fmt(p.amount)}</span>
                <span style={{ flex: 1 }} className="red">−₹{fmt(p.gstCut)}</span>
                <span style={{ flex: 1 }} className="red">−₹{fmt(p.razorpayCut)}</span>
                <span style={{ flex: 1, fontWeight: 700 }} className="green">₹{fmt(p.net)}</span>
                <span style={{ flex: 0.8 }} className="muted tiny">{new Date(p.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
            {data.payments.length === 0 && !loading && <div className="trow muted">No payment-level detail synced for this batch yet — check back after the next daily sync.</div>}
          </div>
        </>
      )}
    </div>
  );
}
