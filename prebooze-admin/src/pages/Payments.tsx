import { useEffect, useState } from 'react';
import { livePayments, LiveApiError, type LivePayoutRow } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { Kpi } from '../components/ui';

const TITLE = 'Payments & payouts';
const TABS = ['Payouts due', 'Transactions', 'Refunds', 'Disputes'];
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

/** Real per-event payout register (PaymentsService.due/markPaid) — "due"
 * only ever lists events that have actually finished, and marking one paid
 * requires the real UTR from a transfer you already made yourself; nothing
 * here moves money or invents a reference number. "Payouts due" is the only
 * tab with a real backend; the rest stay the same placeholder they always
 * were. */
export default function Payments() {
  const session = useLiveSession();
  const { token } = session;
  const [tab, setTab] = useState(TABS[0]);

  const [rows, setRows] = useState<LivePayoutRow[]>([]);
  const [summary, setSummary] = useState({ collected: 0, commissionKept: 0, dueTotal: 0 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [utrDraft, setUtrDraft] = useState('');

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

  const startPay = (id: string) => {
    setPayingId(id);
    setUtrDraft('');
    setErr('');
  };

  const confirmPay = async (id: string) => {
    if (!utrDraft.trim()) {
      setErr('Enter the UTR / reference number from the transfer you made');
      return;
    }
    setErr('');
    try {
      await livePayments.markPaid(id, utrDraft.trim());
      setPayingId(null);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to record payout');
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
          {rows.length === 0 && !loading && <div className="trow muted">No payouts due — events only show up here once they've actually happened.</div>}
          {rows.map((r) => (
            <div key={r.id} className="trow" style={{ minWidth: 640, flexWrap: payingId === r.id ? 'wrap' : undefined }}>
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
                ) : payingId === r.id ? null : (
                  <button className="btn btn-ghost btn-sm" onClick={() => startPay(r.id)}>
                    Mark paid…
                  </button>
                )}
              </span>
              {!r.paidOut && payingId === r.id && (
                <div style={{ flex: '1 0 100%', display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder="Real UTR / transaction reference from the transfer you made"
                    value={utrDraft}
                    onChange={(e) => setUtrDraft(e.target.value)}
                    autoFocus
                  />
                  <button className="btn btn-pri btn-sm" onClick={() => confirmPay(r.id)}>Confirm</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPayingId(null)}>Cancel</button>
                </div>
              )}
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
