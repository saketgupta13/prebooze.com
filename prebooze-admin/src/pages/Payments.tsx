import { useEffect, useState } from 'react';
import { livePayments, LiveApiError, type LivePayoutRow } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { Kpi } from '../components/ui';

const TITLE = 'Payments & payouts';
const TABS = ['Payouts due', 'Transactions', 'Refunds', 'Disputes'];
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

/** Real per-event payout batch (PaymentsService.due/runBatch) — genuinely
 * flips paidOut + records a real payout UTR, not a mock toast. "Payouts
 * due" is the only tab with a real backend; the rest stay the same
 * placeholder they always were. */
export default function Payments() {
  const session = useLiveSession();
  const { token } = session;
  const [tab, setTab] = useState(TABS[0]);

  const [rows, setRows] = useState<LivePayoutRow[]>([]);
  const [summary, setSummary] = useState({ collected: 0, commissionKept: 0, gstCollected: 0, dueTotal: 0 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    livePayments
      .due()
      .then(({ rows: r, ...s }) => {
        setRows(r);
        setSummary(s);
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

  const pay = async (id: string) => {
    setPayingId(id);
    setErr('');
    try {
      await livePayments.runBatch([id]);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to run payout');
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Payments &amp; payouts</h1>
      </div>

      <div className="kpi-grid">
        <Kpi label="Collected" value={`₹${fmt(summary.collected)}`} />
        <Kpi label="Commission kept" value={`₹${fmt(summary.commissionKept)}`} />
        <Kpi label="GST collected" value={`₹${fmt(summary.gstCollected)}`} />
        <Kpi label="Due total" value={<span className="red">₹{fmt(summary.dueTotal)}</span>} alert />
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Payouts due' ? (
        <div className="tblwrap">
          <div className="thead" style={{ minWidth: 640 }}>
            <span style={{ flex: 1.6 }}>Organizer</span>
            <span style={{ flex: 1.6 }}>Event</span>
            <span style={{ flex: 1 }}>Gross</span>
            <span style={{ flex: 1.1 }}>Commission</span>
            <span style={{ flex: 1 }}>Net payout</span>
            <span style={{ flex: 0.9 }} />
          </div>
          {rows.length === 0 && !loading && <div className="trow muted">No payouts due.</div>}
          {rows.map((r) => (
            <div key={r.id} className="trow" style={{ minWidth: 640 }}>
              <span style={{ flex: 1.6, fontWeight: 700 }}>{r.organizer}</span>
              <span style={{ flex: 1.6 }} className="muted">{r.title}</span>
              <span style={{ flex: 1 }}>₹{fmt(r.revenue)}</span>
              <span style={{ flex: 1.1 }}>
                ₹{fmt(r.commissionAmt)} <span className="muted">({r.commission ?? 0}%)</span>
              </span>
              <span style={{ flex: 1, fontWeight: 700 }} className="green">
                ₹{fmt(r.net)}
                {r.paidOut && r.payoutUtr && <span className="tiny muted" style={{ display: 'block', fontWeight: 400 }}>{r.payoutUtr}</span>}
              </span>
              <span style={{ flex: 0.9, display: 'flex', justifyContent: 'flex-end' }}>
                {r.paidOut ? (
                  <span className="tag tag-green" title={r.payoutUtr ?? undefined}>Paid ✓</span>
                ) : (
                  <button className="btn btn-ghost btn-sm" disabled={payingId === r.id} onClick={() => pay(r.id)}>
                    {payingId === r.id ? 'Paying…' : 'Pay ⏸'}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="ph" style={{ height: 120, borderRadius: 10 }}>{tab} — coming with backend integration</div>
      )}
      <div className="tiny hint">
        commission % per row comes from each event's own rate — set in the event editor.
      </div>
    </div>
  );
}
