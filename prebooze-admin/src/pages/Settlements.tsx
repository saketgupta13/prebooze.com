import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Kpi, Tag } from '../components/ui';
import { downloadCsv } from '../lib/csv';
import { liveSettlements, LiveApiError, type LiveSettlement, type LivePhonePeSettlement } from '../lib/liveApi';
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
  // Real, automatic PhonePe settlement batches from their own webhook — no
  // CSV needed for these, unlike phonePeSettlements above (which stays
  // CSV-based for the per-transaction fee/GST breakdown).
  const [autoSettlements, setAutoSettlements] = useState<LivePhonePeSettlement[]>([]);
  const [autoTotal, setAutoTotal] = useState(0);
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
        setAutoSettlements(r.auto);
        setAutoTotal(r.autoTotal);
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
  // Most recent across all three sources (Razorpay / PhonePe CSV / PhonePe
  // auto-webhook) — whichever actually happened last, not just Razorpay's.
  const latestCandidates: { date: string; amount: number }[] = [
    ...(latest ? [{ date: latest.settledAt, amount: latest.amount }] : []),
    ...(phonePeSettlements[0] ? [{ date: phonePeSettlements[0].fileDate, amount: phonePeSettlements[0].totalAmount }] : []),
    ...(autoSettlements[0] ? [{ date: autoSettlements[0].settledAt, amount: autoSettlements[0].amount }] : []),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const mostRecent = latestCandidates[0];

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
        <Kpi
          label="Total settled (lifetime)"
          value={<span className="green">₹{fmt(total + phonePeTotal)}</span>}
          delta={`Razorpay: ₹${fmt(total)} + PhonePe: ₹${fmt(phonePeTotal)} (₹${fmt(autoTotal)} auto)`}
          deltaColor="var(--muted)"
        />
        <Kpi
          label="Most recent settlement"
          value={mostRecent ? `₹${fmt(mostRecent.amount)}` : '—'}
          delta={mostRecent ? new Date(mostRecent.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined}
          deltaColor="var(--muted)"
        />
        <Kpi
          label="Settlement records"
          value={settlements.length + phonePeSettlements.length + autoSettlements.length}
          delta={`Razorpay: ${settlements.length} | PhonePe (CSV): ${phonePeSettlements.length} | PhonePe (auto): ${autoSettlements.length}`}
          deltaColor="var(--muted)"
        />
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
            {/* listPhonePe already converts paise -> rupees server-side (fixed
                2026-09-24) — dividing by 100 again here was a real bug that
                would have shown 100x too small once real imports worked. */}
            <span style={{ flex: 1, fontWeight: 700 }} className="green">₹{fmt(Number(s.totalAmount))}</span>
            <span style={{ flex: 1 }}>
              <Tag label={s.status} cls={s.status === 'RECONCILED' ? 'tag-green' : 'tag-dim'} />
            </span>
            <span style={{ flex: 1 }} className="muted">PhonePe (CSV)</span>
            <span style={{ flex: 1.5 }} className="muted">{s.filename}</span>
          </Link>
        ))}
        {autoSettlements.map((s) => (
          <div key={`auto-${s.id}`} className="trow" style={{ minWidth: 680 }}>
            <span style={{ flex: 1 }} className="muted">{new Date(s.settledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span style={{ flex: 1, fontWeight: 700 }} className="green">₹{fmt(s.amount)}</span>
            <span style={{ flex: 1 }}>
              <Tag label={s.state} cls={s.state === 'PROCESSED' ? 'tag-green' : s.state === 'ATTEMPT_FAILED' ? 'tag-red' : 'tag-dim'} />
            </span>
            <span style={{ flex: 1 }} className="muted">PhonePe (auto)</span>
            <span style={{ flex: 1.5 }} className="muted">{s.utr ?? s.id}</span>
          </div>
        ))}
        {settlements.length === 0 && phonePeSettlements.length === 0 && autoSettlements.length === 0 && !loading && (
          <div className="trow muted">No settlements yet.</div>
        )}
      </div>
    </div>
  );
}
