import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Kpi } from '../components/ui';
import { livePayments, LiveApiError, type LivePayoutRow } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Run payout batch';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

/** Real payout register (PaymentsService.due/markPaid) — but there's no
 * bank/IMPS/NEFT integration behind it. "Due" only ever lists events that
 * have actually finished; recording one as paid requires the real UTR from
 * a transfer made outside the platform, entered per event here. This page
 * used to claim it settled transfers itself and fabricate a UTR on
 * confirm — it never did either. */
export default function RunPayoutBatch() {
  const session = useLiveSession();
  const { token } = session;
  const navigate = useNavigate();

  const [due, setDue] = useState<LivePayoutRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [utrs, setUtrs] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setErr('');
    livePayments
      .due()
      .then(({ rows }) => {
        const outstanding = rows.filter((r) => !r.paidOut);
        setDue(outstanding);
        setSelected(new Set(outstanding.filter((d) => d.revenue > 0).map((d) => d.id)));
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const picked = due.filter((d) => selected.has(d.id));
  const totals = picked.reduce(
    (a, d) => ({ gross: a.gross + d.revenue, comm: a.comm + d.commissionAmt, gst: a.gst + d.gst, net: a.net + d.net }),
    { gross: 0, comm: 0, gst: 0, net: 0 }
  );
  const missingUtr = picked.some((d) => !utrs[d.id]?.trim());

  const run = async () => {
    setRunning(true);
    setErr('');
    try {
      for (const p of picked) {
        await livePayments.markPaid(p.id, utrs[p.id].trim());
      }
      navigate('/payments');
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to record one or more payouts');
      setRunning(false);
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 900, gap: 14 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/payments" style={{ fontSize: 13 }}>← Payments</Link>
        <h1 className="page-title">Run payout batch</h1>
        <div style={{ flex: 1 }} />
        <span className="tiny muted">records transfers you've already made — doesn't send money</span>
      </div>

      <div className="kpi-grid">
        <Kpi label="Transfers selected" value={picked.length} />
        <Kpi label="Gross covered" value={`₹${fmt(totals.gross)}`} />
        <Kpi label="Commission + GST kept" value={`₹${fmt(totals.comm + totals.gst)}`} />
        <Kpi label="Total payable now" value={<span className="green">₹{fmt(totals.net)}</span>} />
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 820 }}>
          <span style={{ width: 26 }} />
          <span style={{ flex: 1.3 }}>Organizer</span>
          <span style={{ flex: 1.3 }}>Event</span>
          <span style={{ flex: 0.9 }}>Gross</span>
          <span style={{ flex: 0.9 }}>Commission</span>
          <span style={{ flex: 0.7 }}>GST</span>
          <span style={{ flex: 0.9 }}>Net payout</span>
          <span style={{ flex: 1.3 }}>UTR / reference</span>
        </div>
        {due.map((d) => (
          <div key={d.id} className="trow" style={{ minWidth: 820, opacity: selected.has(d.id) ? 1 : 0.5 }}>
            <span style={{ width: 26 }}>
              <input
                type="checkbox"
                checked={selected.has(d.id)}
                onChange={() => toggle(d.id)}
                style={{ accentColor: 'var(--green)', width: 14, height: 14 }}
              />
            </span>
            <span style={{ flex: 1.3, fontWeight: 700 }}>{d.organizer}</span>
            <span style={{ flex: 1.3 }} className="muted">{d.title}</span>
            <span style={{ flex: 0.9 }}>₹{fmt(d.revenue)}</span>
            <span style={{ flex: 0.9 }}>₹{fmt(d.commissionAmt)} <span className="muted">({d.commission ?? 0}%)</span></span>
            <span style={{ flex: 0.7 }}>₹{fmt(d.gst)}</span>
            <span style={{ flex: 0.9, fontWeight: 700 }} className="green">₹{fmt(d.net)}</span>
            <span style={{ flex: 1.3 }}>
              {selected.has(d.id) && (
                <input
                  className="input"
                  style={{ fontSize: 12.5, padding: '5px 8px' }}
                  placeholder="real UTR…"
                  value={utrs[d.id] ?? ''}
                  onChange={(e) => setUtrs((prev) => ({ ...prev, [d.id]: e.target.value }))}
                />
              )}
            </span>
          </div>
        ))}
        {due.length === 0 && !loading && <div className="trow muted">Nothing due — every completed event has been paid out.</div>}
      </div>

      <div className="dashed-box tiny" style={{ color: 'var(--muted)' }}>
        Only events that have already happened show up here · commission % comes from each event's own rate · enter the
        real UTR from a transfer you've already made for each one you're recording.
      </div>

      {!confirming ? (
        <button className="btn btn-pri" style={{ padding: 12, fontSize: 13.5 }} disabled={picked.length === 0} onClick={() => setConfirming(true)}>
          Review &amp; confirm {picked.length} payout{picked.length === 1 ? '' : 's'} →
        </button>
      ) : (
        <div className="card" style={{ border: '1px solid var(--green)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="display" style={{ fontWeight: 700 }}>Confirm payouts</div>
          <div className="small muted">
            Marks {picked.length} transfer{picked.length === 1 ? '' : 's'} totalling{' '}
            <b style={{ color: 'var(--text)' }}>₹{fmt(totals.net)}</b> as paid, using the UTR you entered for each — this
            only records what you've already sent, it doesn't move any money itself.
          </div>
          {missingUtr && <div className="tiny" style={{ color: 'var(--red)' }}>Enter a UTR for every selected transfer before confirming.</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-pri" style={{ flex: 1, padding: 10 }} disabled={running || missingUtr} onClick={run}>
              {running ? 'Recording…' : `Mark ₹${fmt(totals.net)} as paid ✓`}
            </button>
            <button className="btn btn-ghost" style={{ padding: 10 }} onClick={() => setConfirming(false)} disabled={running}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
