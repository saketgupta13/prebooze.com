import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { Kpi } from '../components/ui';

const TABS = ['Payouts due', 'Transactions', 'Refunds', 'Disputes'];

export default function Payments() {
  const { events, runPayoutBatch } = useAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState(TABS[0]);

  // Each row's commission % is pulled from that event's own rate — the event editor is the source of truth.
  const rows = events
    .filter((e) => e.status !== 'draft' && e.commission != null)
    .map((e) => {
      const commission = (e.revenue * (e.commission as number)) / 100;
      return { ...e, commissionAmt: commission, net: e.revenue - commission };
    });
  const totalCommission = rows.reduce((a, r) => a + r.commissionAmt, 0);

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <div className="page-hd">
        <h1 className="page-title">Payments &amp; payouts</h1>
        <button className="btn btn-pri" onClick={() => navigate('/payments/run')}>Run payout batch →</button>
      </div>

      <div className="kpi-grid">
        <Kpi label="Collected" value="₹3.4L" />
        <Kpi label="Commission kept" value={`₹${fmt(totalCommission)}`} />
        <Kpi label="GST collected" value="₹7.4k" />
        <Kpi label="Due Friday" value={<span className="red">₹2.9L</span>} alert />
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
          {rows.map((r) => (
            <div key={r.id} className="trow" style={{ minWidth: 640 }}>
              <span style={{ flex: 1.6, fontWeight: 700 }}>{r.organizer} ✓</span>
              <span style={{ flex: 1.6 }} className="muted">{r.title}</span>
              <span style={{ flex: 1 }}>₹{fmt(r.revenue)}</span>
              <span style={{ flex: 1.1 }}>
                ₹{fmt(r.commissionAmt)} <span className="muted">({r.commission}%)</span>
              </span>
              <span style={{ flex: 1, fontWeight: 700 }} className="green">
                ₹{fmt(r.net)}
                {r.paidOut && r.payoutUtr && <span className="tiny muted" style={{ display: 'block', fontWeight: 400 }}>{r.payoutUtr}</span>}
              </span>
              <span style={{ flex: 0.9, display: 'flex', justifyContent: 'flex-end' }}>
                {r.paidOut ? (
                  <span className="tag tag-green" title={r.payoutUtr}>Paid ✓</span>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => runPayoutBatch([r.id])}>Pay ⏸</button>
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="ph" style={{ height: 120, borderRadius: 10 }}>{tab} — coming with backend integration</div>
      )}
      <div className="tiny hint">
        each row expands → per-booking breakdown, invoice PDF, UTR after transfer · commission % per row comes from each event's own rate — set in the event editor.
      </div>
    </div>
  );
}
