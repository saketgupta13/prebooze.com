import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { liveSettlements, LiveApiError } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PhonePeSettlementDetail() {
  const { id } = useParams();
  const session = useLiveSession();
  const { token } = session;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    setErr('');
    liveSettlements
      .detailPhonePe(id)
      .then(setData)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, id]);

  const gate = useLiveGate('PhonePe Settlement', session);
  if (gate) return gate;

  if (loading) return <div className="tiny muted">Loading…</div>;
  if (err) return <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>;
  if (!data) return <div className="tiny muted">Settlement not found</div>;

  const { file, totals, methodBreakdown, payments } = data;

  return (
    <div className="stack fade" style={{ maxWidth: 1200, gap: 14 }}>
      <LiveHeaderBar title="Settlement Detail" session={session} />

      <div className="page-hd">
        <h1 className="page-title">PhonePe Settlement — {new Date(file.fileDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</h1>
        <span className="tag tag-dim">{file.status}</span>
      </div>

      <div className="card" style={{ padding: '12px 16px', gap: 12, display: 'flex', flexDirection: 'column' }}>
        <div>
          <span className="tiny muted">File</span>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{file.filename}</div>
        </div>
        <div>
          <span className="tiny muted">Downloaded</span>
          <div style={{ fontSize: 12 }}>{new Date(file.downloadedAt).toLocaleString('en-GB')}</div>
        </div>
      </div>

      <div className="card" style={{ padding: '12px 16px', gap: 12, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <span className="tiny muted">Total Settled</span>
          <div className="green" style={{ fontSize: 18, fontWeight: 700 }}>₹{fmt(totals.amount)}</div>
        </div>
        <div>
          <span className="tiny muted">Total Fee + GST</span>
          <div style={{ fontSize: 18, fontWeight: 700 }}>₹{fmt(totals.fee + totals.gst)}</div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Payment Method Breakdown</h3>
        <div className="tblwrap">
          <div className="thead">
            <span style={{ flex: 1 }}>Method</span>
            <span style={{ flex: 1 }}>Transactions</span>
            <span style={{ flex: 1 }}>Amount</span>
            <span style={{ flex: 1 }}>Fee</span>
            <span style={{ flex: 1 }}>GST</span>
          </div>
          {methodBreakdown.map((m: any) => (
            <div key={m.paymentMethod} className="trow">
              <span style={{ flex: 1 }} className="muted">{m.paymentMethod}</span>
              <span style={{ flex: 1 }}>{m.transactionCount}</span>
              <span style={{ flex: 1 }} className="green">₹{fmt(m.totalAmount)}</span>
              <span style={{ flex: 1 }}>₹{fmt(m.totalFee)}</span>
              <span style={{ flex: 1 }}>₹{fmt(m.totalGST)}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Transaction Details ({payments.length} items)</h3>
        <div className="tblwrap" style={{ maxHeight: 400, overflow: 'auto' }}>
          <div className="thead">
            <span style={{ flex: 1.5 }}>Payment ID</span>
            <span style={{ flex: 1 }}>Amount</span>
            <span style={{ flex: 0.8 }}>Fee</span>
            <span style={{ flex: 0.8 }}>GST</span>
            <span style={{ flex: 1 }}>Method</span>
            <span style={{ flex: 1 }}>Booking / Featured</span>
          </div>
          {payments.map((p: any) => (
            <div key={p.paymentId} className="trow">
              <span style={{ flex: 1.5 }} className="muted" title={p.paymentId}>{p.paymentId.slice(0, 16)}…</span>
              <span style={{ flex: 1 }}>₹{fmt(p.amount)}</span>
              <span style={{ flex: 0.8 }} className="muted">₹{fmt(p.fee)}</span>
              <span style={{ flex: 0.8 }} className="muted">₹{fmt(p.gst)}</span>
              <span style={{ flex: 1 }} className="muted">{p.paymentMethod}</span>
              <span style={{ flex: 1 }} className="muted">
                {p.bookingId ? `Booking ${p.bookingId}` : p.featuredId ? `Featured ${p.featuredId}` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
