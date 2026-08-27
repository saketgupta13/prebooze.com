import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Kpi, Tag } from '../components/ui';
import { liveSettlements, LiveApiError, type LiveSettlementDetail } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

/** One real Razorpay settlement batch, broken down to the payment level —
 * exact data from Razorpay's own settlement reconciliation report, not an
 * approximation by date range. Razorpay's cut and the GST on it are shown
 * separately since Razorpay's `fee` field already bundles both together. */
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

  return (
    <div className="stack fade" style={{ maxWidth: 1000, gap: 14 }}>
      <LiveHeaderBar title="Settlement" session={session} />
      <Link to="/settlements" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Settlements</Link>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      {data && (
        <>
          <div className="page-hd">
            <h1 className="page-title">
              ₹{fmt(data.settlement.amount)} settlement
              <span style={{ marginLeft: 10 }}>
                <Tag label={data.settlement.status} cls={data.settlement.status === 'processed' ? 'tag-green' : 'tag-dim'} />
              </span>
            </h1>
          </div>
          <div className="tiny muted">
            {new Date(data.settlement.settledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · UTR {data.settlement.utr ?? '—'}
          </div>

          <div className="kpi-grid">
            <Kpi label="Gross payments" value={`₹${fmt(data.grossTotal)}`} delta={`${data.payments.length} payment${data.payments.length === 1 ? '' : 's'}`} deltaColor="var(--muted)" />
            <Kpi label="Razorpay's cut" value={<span className="red">₹{fmt(data.razorpayCutTotal)}</span>} delta="their processing fee, before GST" deltaColor="var(--muted)" />
            <Kpi label="GST on that fee" value={<span className="red">₹{fmt(data.gstCutTotal)}</span>} delta="18% of Razorpay's cut" deltaColor="var(--muted)" />
            <Kpi label="Net settled" value={<span className="green">₹{fmt(data.grossTotal - data.feeTotal)}</span>} delta="gross minus both cuts" deltaColor="var(--muted)" />
          </div>

          <div className="tiny hint">
            Real per-payment breakdown from Razorpay's own settlement reconciliation report — not an estimate. Only payments are shown here, not refunds/adjustments that may also be part of this batch.
          </div>

          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 700 }}>
              <span style={{ flex: 1.5 }}>Guest / event</span>
              <span style={{ flex: 1 }}>Paid</span>
              <span style={{ flex: 1 }}>Razorpay cut</span>
              <span style={{ flex: 1 }}>GST cut</span>
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
                <span style={{ flex: 1 }} className="red">−₹{fmt(p.razorpayCut)}</span>
                <span style={{ flex: 1 }} className="red">−₹{fmt(p.gstCut)}</span>
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
