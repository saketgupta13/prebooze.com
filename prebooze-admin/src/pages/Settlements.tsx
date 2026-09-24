import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Kpi, Tag } from '../components/ui';
import { downloadCsv } from '../lib/csv';
import { liveSettlements, LiveApiError, type LiveSettlement } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Settlements';
// Real bank money, settled in paise — shown with decimals, not rounded to
// whole rupees, so this always matches what actually lands in the bank.
const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Real Razorpay settlement batches — what actually landed in the bank,
 * synced daily from their Settlements API (SettlementsService). Not the
 * same thing as the per-event Income & expenses ledger: Razorpay bundles
 * multiple events'/days' payments into one batch on its own schedule, so
 * this is the "bank statement" view, not a breakdown by event. */
export default function Settlements() {
  const session = useLiveSession();
  const { token } = session;

  const [settlements, setSettlements] = useState<LiveSettlement[]>([]);
  const [total, setTotal] = useState(0);
  const [phonePeSettlements, setPhonePeSettlements] = useState<any[]>([]);
  const [phonePeTotal, setPhonePeTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([
      liveSettlements.list().then((r) => {
        setSettlements(r.settlements);
        setTotal(r.total);
      }),
      liveSettlements.listPhonePe().then((r) => {
        setPhonePeSettlements(r.settlements);
        setPhonePeTotal(r.total);
      }),
    ]).catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load')).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const latest = settlements[0];

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['Date', 'Amount (₹)', 'Status', 'UTR'],
      ...settlements.map((s) => [s.settledAt.slice(0, 10), s.amount, s.status, s.utr ?? '']),
      [],
      ['Total settled', total],
    ];
    const today = new Date();
    const todayLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    downloadCsv(`prebooze-settlements-${todayLabel}.csv`, rows);
  };

  const uploadPhonePeSettlement = async (file: File) => {
    setUploading(true);
    setUploadErr('');
    setUploadSuccess('');
    try {
      const result = await liveSettlements.importPhonePe(file);
      setUploadSuccess(`✓ Imported ${result.recordsImported} transactions. Total: ₹${fmt(result.totalAmount)}, Fee: ₹${fmt(result.totalFee)}, GST: ₹${fmt(result.totalGST)}`);
      setTimeout(() => load(), 1000); // Reload settlements list
    } catch (e) {
      setUploadErr(e instanceof LiveApiError ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1000, gap: 14 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Settlements</h1>
        <button className="btn btn-ghost btn-sm" onClick={exportCsv}>⬇ Export</button>
      </div>

      <div className="kpi-grid">
        <Kpi label="Total settled (lifetime)" value={<span className="green">₹{fmt(total + phonePeTotal)}</span>} delta={`Razorpay: ₹${fmt(total)} + PhonePe: ₹${fmt(phonePeTotal)}`} deltaColor="var(--muted)" />
        <Kpi label="Most recent settlement" value={latest ? `₹${fmt(latest.amount)}` : (phonePeSettlements[0] ? `₹${fmt(phonePeSettlements[0].totalAmount / 100)}` : '—')} delta={latest ? new Date(latest.settledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : (phonePeSettlements[0] ? new Date(phonePeSettlements[0].fileDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined)} deltaColor="var(--muted)" />
        <Kpi label="Settlement records" value={settlements.length + phonePeSettlements.length} delta={`Razorpay: ${settlements.length} | PhonePe: ${phonePeSettlements.length}`} deltaColor="var(--muted)" />
      </div>

      <div className="tiny hint">
        Real bank-side payouts. Razorpay settlements show actual bank UTR transfers on its own schedule. PhonePe settlements are T+1/T+2 payout cycles from settlement files. For per-event commission/fee breakdowns, see Income &amp; expenses instead.
      </div>

      <div className="card" style={{ padding: 12, gap: 12, display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(33, 150, 243, 0.05)', borderColor: 'rgba(33, 150, 243, 0.2)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>📤 Import PhonePe Settlement File</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Upload a CSV file from PhonePe dashboard. Expected columns: payment_id, amount, fee, gst, payment_method, booking_id, featured_id</div>

        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              uploadPhonePeSettlement(e.target.files[0]);
              e.target.value = '';
            }
          }}
          disabled={uploading}
          style={{ fontSize: 12, padding: '6px 8px', cursor: uploading ? 'not-allowed' : 'pointer' }}
        />

        {uploading && <div className="tiny muted">⏳ Importing...</div>}
        {uploadErr && <div style={{ fontSize: 12, color: 'var(--red)' }}>❌ {uploadErr}</div>}
        {uploadSuccess && <div style={{ fontSize: 12, color: 'var(--green)' }}>{uploadSuccess}</div>}
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 680 }}>
          <span style={{ flex: 1 }}>Date</span>
          <span style={{ flex: 1 }}>Amount</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ flex: 1 }}>Provider</span>
          <span style={{ flex: 1.5 }}>Ref</span>
        </div>
        {settlements.map((s) => (
          <Link key={s.id} to={`/settlements/${encodeURIComponent(s.id)}`} className="trow" style={{ minWidth: 680, cursor: 'pointer' }}>
            <span style={{ flex: 1 }} className="muted">{new Date(s.settledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span style={{ flex: 1, fontWeight: 700 }} className="green">₹{fmt(s.amount)}</span>
            <span style={{ flex: 1 }}>
              <Tag label={s.status} cls={s.status === 'processed' ? 'tag-green' : 'tag-dim'} />
            </span>
            <span style={{ flex: 1 }} className="muted">Razorpay</span>
            <span style={{ flex: 1.5 }} className="muted">{s.utr ?? '—'}</span>
          </Link>
        ))}
        {phonePeSettlements.map((s) => (
          <Link key={`pp-${s.id}`} to={`/settlements/phonepe/${encodeURIComponent(s.id)}`} className="trow" style={{ minWidth: 680, cursor: 'pointer' }}>
            <span style={{ flex: 1 }} className="muted">{new Date(s.fileDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span style={{ flex: 1, fontWeight: 700 }} className="green">₹{fmt(Number(s.totalAmount) / 100)}</span>
            <span style={{ flex: 1 }}>
              <Tag label={s.status} cls={s.status === 'RECONCILED' ? 'tag-green' : 'tag-dim'} />
            </span>
            <span style={{ flex: 1 }} className="muted">PhonePe</span>
            <span style={{ flex: 1.5 }} className="muted">{s.filename}</span>
          </Link>
        ))}
        {settlements.length === 0 && !loading && <div className="trow muted">No settlements yet.</div>}
      </div>
    </div>
  );
}
