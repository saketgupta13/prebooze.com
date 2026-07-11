import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { Kpi } from '../components/ui';

/** Full payout-batch flow: review every transfer, untick any to hold, confirm the batch. */
export default function RunPayoutBatch() {
  const { events, settings, runPayoutBatch } = useAdmin();
  const navigate = useNavigate();

  const due = useMemo(
    () =>
      events
        .filter((e) => e.status !== 'draft' && e.commission != null && !e.paidOut)
        .map((e) => {
          const commission = (e.revenue * (e.commission as number)) / 100;
          const gst = (commission * settings.gstPct) / 100;
          return { ...e, commissionAmt: commission, gst, net: e.revenue - commission - gst };
        }),
    [events, settings.gstPct]
  );

  const [selected, setSelected] = useState<Set<string>>(() => new Set(due.filter((d) => d.revenue > 0).map((d) => d.id)));
  const [confirming, setConfirming] = useState(false);

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

  const run = () => {
    runPayoutBatch(picked.map((p) => p.id));
    navigate('/payments');
  };

  return (
    <div className="stack fade" style={{ maxWidth: 900, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/payments" style={{ fontSize: 13 }}>← Payments</Link>
        <h1 className="page-title">Run payout batch</h1>
        <div style={{ flex: 1 }} />
        <span className="tiny muted">batch settles via IMPS/NEFT · UTR issued per transfer</span>
      </div>

      <div className="kpi-grid">
        <Kpi label="Transfers selected" value={picked.length} />
        <Kpi label="Gross covered" value={`₹${fmt(totals.gross)}`} />
        <Kpi label="Commission + GST kept" value={`₹${fmt(totals.comm + totals.gst)}`} />
        <Kpi label="Total payable now" value={<span className="green">₹{fmt(totals.net)}</span>} />
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 720 }}>
          <span style={{ width: 26 }} />
          <span style={{ flex: 1.5 }}>Organizer</span>
          <span style={{ flex: 1.5 }}>Event</span>
          <span style={{ flex: 1 }}>Gross</span>
          <span style={{ flex: 1 }}>Commission</span>
          <span style={{ flex: 0.8 }}>GST</span>
          <span style={{ flex: 1 }}>Net payout</span>
          <span style={{ flex: 1 }}>Bank</span>
        </div>
        {due.map((d) => {
          const held = d.revenue === 0;
          return (
            <div key={d.id} className="trow" style={{ minWidth: 720, opacity: selected.has(d.id) ? 1 : 0.5 }}>
              <span style={{ width: 26 }}>
                <input
                  type="checkbox"
                  checked={selected.has(d.id)}
                  onChange={() => toggle(d.id)}
                  style={{ accentColor: 'var(--green)', width: 14, height: 14 }}
                />
              </span>
              <span style={{ flex: 1.5, fontWeight: 700 }}>{d.organizer} ✓</span>
              <span style={{ flex: 1.5 }} className="muted">{d.title}</span>
              <span style={{ flex: 1 }}>₹{fmt(d.revenue)}</span>
              <span style={{ flex: 1 }}>₹{fmt(d.commissionAmt)} <span className="muted">({d.commission}%)</span></span>
              <span style={{ flex: 0.8 }}>₹{fmt(d.gst)}</span>
              <span style={{ flex: 1, fontWeight: 700 }} className="green">₹{fmt(d.net)}</span>
              <span style={{ flex: 1 }} className="muted">HDFC •••• 8821{held ? ' · no sales yet' : ''}</span>
            </div>
          );
        })}
        {due.length === 0 && <div className="trow muted">Nothing due — every settled event has been paid out.</div>}
      </div>

      <div className="dashed-box tiny" style={{ color: 'var(--muted)' }}>
        Payouts settle to each organizer's penny-drop-verified account · commission % comes from each event's own rate ·
        GST invoice PDFs generate automatically per transfer · next auto-batch: {settings.payoutDay}
        {settings.autoPayout ? ' (auto-payout on)' : ' (auto-payout off)'}
      </div>

      {!confirming ? (
        <button className="btn btn-pri" style={{ padding: 12, fontSize: 13.5 }} disabled={picked.length === 0} onClick={() => setConfirming(true)}>
          Review &amp; confirm batch of {picked.length} →
        </button>
      ) : (
        <div className="card" style={{ border: '1px solid var(--green)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="display" style={{ fontWeight: 700 }}>Confirm payout batch</div>
          <div className="small muted">
            {picked.length} transfer{picked.length === 1 ? '' : 's'} totalling{' '}
            <b style={{ color: 'var(--text)' }}>₹{fmt(totals.net)}</b> will be initiated immediately. This cannot be undone —
            reversals require the organizer's consent.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-pri" style={{ flex: 1, padding: 10 }} onClick={run}>
              Pay ₹{fmt(totals.net)} now ✓
            </button>
            <button className="btn btn-ghost" style={{ padding: 10 }} onClick={() => setConfirming(false)}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
