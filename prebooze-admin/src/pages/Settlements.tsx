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
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveSettlements
      .list()
      .then((r) => {
        setSettlements(r.settlements);
        setTotal(r.total);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
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
        <Kpi label="Total settled (lifetime)" value={<span className="green">₹{fmt(total)}</span>} delta="real payouts from Razorpay to the bank" deltaColor="var(--muted)" />
        <Kpi label="Most recent settlement" value={latest ? `₹${fmt(latest.amount)}` : '—'} delta={latest ? new Date(latest.settledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined} deltaColor="var(--muted)" />
        <Kpi label="Batches" value={settlements.length} delta="not per-event — Razorpay bundles its own schedule" deltaColor="var(--muted)" />
      </div>

      <div className="tiny hint">
        This is the real bank-side picture — what Razorpay actually paid out, batch by batch, with the UTR to match your bank statement. It won't line up 1:1 with any single event: Razorpay bundles multiple events'/days' payments into one settlement on its own schedule. For per-event commission/fee breakdowns, see Income &amp; expenses instead.
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 560 }}>
          <span style={{ flex: 1 }}>Date</span>
          <span style={{ flex: 1 }}>Amount</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ flex: 1.5 }}>UTR</span>
        </div>
        {settlements.map((s) => (
          <Link key={s.id} to={`/settlements/${encodeURIComponent(s.id)}`} className="trow" style={{ minWidth: 560, cursor: 'pointer' }}>
            <span style={{ flex: 1 }} className="muted">{new Date(s.settledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span style={{ flex: 1, fontWeight: 700 }} className="green">₹{fmt(s.amount)}</span>
            <span style={{ flex: 1 }}>
              <Tag label={s.status} cls={s.status === 'processed' ? 'tag-green' : 'tag-dim'} />
            </span>
            <span style={{ flex: 1.5 }} className="muted">{s.utr ?? '—'}</span>
          </Link>
        ))}
        {settlements.length === 0 && !loading && <div className="trow muted">No settlements yet.</div>}
      </div>
    </div>
  );
}
