import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { downloadCsv } from '../lib/csv';

const CHIPS = ['Sales', 'Profit & loss', 'Balance sheet', 'Commission by event', 'GST / tax', 'Refunds', 'Attendance', 'Promos'];

function Line({ label, value, bold, red, indent }: { label: string; value: string; bold?: boolean; red?: boolean; indent?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '7px 0',
        borderBottom: '1px solid rgba(139,195,74,.08)',
        fontWeight: bold ? 700 : 400,
        fontSize: bold ? 13.5 : 12.5,
        paddingLeft: indent ? 16 : 0,
      }}
    >
      <span className={bold ? '' : 'muted'}>{label}</span>
      <span className={red ? 'red' : bold ? 'green' : ''}>{value}</span>
    </div>
  );
}

export default function Reports() {
  const { events, ledger, settings, toast } = useAdmin();
  const [chip, setChip] = useState(CHIPS[0]);
  const [cityF, setCityF] = useState('All');
  const cityEvents = cityF === 'All' ? events : events.filter((e) => e.city === cityF);

  const fin = useMemo(() => {
    const selling = events.filter((e) => e.status !== 'draft' && e.commission != null && e.revenue > 0);
    const commissionIncome = selling.reduce((a, e) => a + (e.revenue * (e.commission as number)) / 100, 0);
    const feeIncome = selling.reduce((a, e) => a + e.sold * settings.bookingFee, 0);
    const otherIncome = ledger.filter((l) => l.kind === 'income').reduce((a, l) => a + l.amount, 0);
    const expensesByCat = new Map<string, number>();
    ledger.filter((l) => l.kind === 'expense').forEach((l) => expensesByCat.set(l.category, (expensesByCat.get(l.category) ?? 0) + l.amount));
    const totalExpenses = [...expensesByCat.values()].reduce((a, v) => a + v, 0);
    const gstPayable = Math.round((feeIncome * settings.gstPct) / 100);
    const gross = selling.reduce((a, e) => a + e.revenue, 0);
    const payoutsDue = selling.filter((e) => !e.paidOut).reduce((a, e) => a + (e.revenue - (e.revenue * (e.commission as number)) / 100), 0);
    const paidOut = selling.filter((e) => e.paidOut).reduce((a, e) => a + (e.revenue - (e.revenue * (e.commission as number)) / 100), 0);
    const totalIncome = commissionIncome + feeIncome + otherIncome;
    const netProfit = totalIncome - totalExpenses - gstPayable;
    const cash = gross + otherIncome - paidOut - totalExpenses;
    return { commissionIncome, feeIncome, otherIncome, expensesByCat, totalExpenses, gstPayable, gross, payoutsDue, paidOut, totalIncome, netProfit, cash };
  }, [events, ledger, settings]);

  const top = [...cityEvents].filter((e) => e.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 3);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['Prebooze — Profit & loss statement'],
      ['Section', 'Line', 'Amount (₹)'],
      ['Income', 'Ticket commission (auto)', Math.round(fin.commissionIncome)],
      ['Income', 'Booking fees (auto)', Math.round(fin.feeIncome)],
      ['Income', 'Other income (sponsorships etc.)', Math.round(fin.otherIncome)],
      ['Income', 'Total income', Math.round(fin.totalIncome)],
      ...[...fin.expensesByCat.entries()].map(([cat, amt]) => ['Expenses', cat, -Math.round(amt)]),
      ['Expenses', 'GST payable on platform fees', -Math.round(fin.gstPayable)],
      ['Expenses', 'Total expenses', -Math.round(fin.totalExpenses + fin.gstPayable)],
      ['Summary', 'Net profit', Math.round(fin.netProfit)],
      ['Summary', 'Cash & bank', Math.round(fin.cash)],
      [],
      ['Top selling events', 'City', 'Revenue (₹)'],
      ...top.map((e) => [e.title, e.city, e.revenue]),
    ];
    downloadCsv(`prebooze-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast('Report exported ✓');
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <div className="page-hd">
        <h1 className="page-title">Reports</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="chip">1 Jun – 8 Jul ▾</span>
          <span className="chip">vs prev. period</span>
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}>⬇ Export</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {CHIPS.map((c) => (
          <button key={c} className={`chip ${chip === c ? 'on' : ''}`} onClick={() => setChip(c)}>{c}</button>
        ))}
        <span style={{ flex: 1 }} />
        {['All', ...new Set(events.map((e) => e.city))].map((c) => (
          <button key={c} className={`chip ${cityF === c ? 'on' : ''}`} onClick={() => setCityF(c)}>{c}</button>
        ))}
      </div>

      {chip === 'Profit & loss' ? (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Profit &amp; loss statement</div>
          <div className="tiny muted" style={{ marginBottom: 10 }}>period: 1 Jun – 8 Jul · accrual basis · commission &amp; fees auto-posted from ticket sales</div>
          <Line label="Income" value="" bold />
          <Line label="Ticket commission (auto)" value={`₹${fmt(fin.commissionIncome)}`} indent />
          <Line label="Booking fees (auto)" value={`₹${fmt(fin.feeIncome)}`} indent />
          <Line label="Other income (sponsorships etc.)" value={`₹${fmt(fin.otherIncome)}`} indent />
          <Line label="Total income" value={`₹${fmt(fin.totalIncome)}`} bold />
          <div style={{ height: 10 }} />
          <Line label="Expenses" value="" bold />
          {[...fin.expensesByCat.entries()].map(([cat, amt]) => (
            <Line key={cat} label={cat} value={`−₹${fmt(amt)}`} indent red />
          ))}
          <Line label="GST payable on platform fees" value={`−₹${fmt(fin.gstPayable)}`} indent red />
          <Line label="Total expenses" value={`−₹${fmt(fin.totalExpenses + fin.gstPayable)}`} bold red />
          <div style={{ height: 10 }} />
          <Line label="Net profit" value={`₹${fmt(fin.netProfit)}`} bold red={fin.netProfit < 0} />
          <div className="tiny hint" style={{ marginTop: 10 }}>
            margin {fin.totalIncome > 0 ? Math.round((fin.netProfit / fin.totalIncome) * 100) : 0}% · manage entries under{' '}
            <Link to="/finance">Income &amp; expenses →</Link>
          </div>
        </div>
      ) : chip === 'Balance sheet' ? (
        <div className="two-col" style={{ maxWidth: 900 }}>
          <div className="card">
            <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Assets</div>
            <div className="tiny muted" style={{ marginBottom: 10 }}>as of today</div>
            <Line label="Cash & bank (collections − payouts − expenses)" value={`₹${fmt(fin.cash)}`} indent />
            <Line label="Receivables (gateway settlements in transit)" value="₹42,300" indent />
            <Line label="Security deposits (venues)" value="₹50,000" indent />
            <Line label="Total assets" value={`₹${fmt(fin.cash + 42300 + 50000)}`} bold />
          </div>
          <div className="card">
            <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Liabilities &amp; equity</div>
            <div className="tiny muted" style={{ marginBottom: 10 }}>as of today</div>
            <Line label="Organizer payouts due" value={`₹${fmt(fin.payoutsDue)}`} indent red />
            <Line label="GST payable" value={`₹${fmt(fin.gstPayable)}`} indent red />
            <Line label="Refunds pending" value="₹1,450" indent red />
            <Line label="Total liabilities" value={`₹${fmt(fin.payoutsDue + fin.gstPayable + 1450)}`} bold red />
            <div style={{ height: 10 }} />
            <Line label="Owner's equity (balancing)" value={`₹${fmt(fin.cash + 42300 + 50000 - (fin.payoutsDue + fin.gstPayable + 1450))}`} bold />
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
