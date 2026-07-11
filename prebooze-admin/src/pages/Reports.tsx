import { useState } from 'react';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';

const CHIPS = ['Sales', 'Commission by event', 'GST / tax', 'Refunds', 'Attendance', 'Promos', 'Organizer leaderboard'];

export default function Reports() {
  const { events, toast } = useAdmin();
  const [chip, setChip] = useState(CHIPS[0]);

  const top = [...events]
    .filter((e) => e.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3);

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <div className="page-hd">
        <h1 className="page-title">Reports</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="chip">1 Jun – 8 Jul ▾</span>
          <span className="chip">vs prev. period</span>
          <button className="btn btn-ghost btn-sm" onClick={() => toast('Export started ✓')}>⬇ Export</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CHIPS.map((c) => (
          <button key={c} className={`chip ${chip === c ? 'on' : ''}`} onClick={() => setChip(c)}>{c}</button>
        ))}
      </div>

      <div className="two-col">
        <div className="card">
          <div className="display" style={{ fontWeight: 700, marginBottom: 8 }}>
            {chip === 'Sales' ? 'Gross sales vs commission — daily' : `${chip} — daily`}
          </div>
          <div className="ph" style={{ height: 120 }}>dual-line chart — {chip.toLowerCase()}</div>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <div className="card">
            <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>By category</div>
            <div className="ph" style={{ height: 44 }}>donut</div>
          </div>
          <div className="card small">
            <div style={{ fontWeight: 700, marginBottom: 3 }}>Top events</div>
            {top.map((e) => (
              <div key={e.id}>
                {e.title} — ₹{fmt(e.revenue)}
                {e.commission != null && <span className="muted"> · {e.commission}%</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dashed-box tiny" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: 'var(--muted)' }}>
        <span><b style={{ color: 'var(--text)' }}>GST report:</b> monthly, download-ready for filing</span>
        <span><b style={{ color: 'var(--text)' }}>Payout register:</b> per organizer, with UTRs</span>
        <span><b style={{ color: 'var(--text)' }}>Scheduled email:</b> weekly summary to owner ▾</span>
      </div>
    </div>
  );
}
