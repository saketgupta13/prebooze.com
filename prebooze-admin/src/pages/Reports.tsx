import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { enabledCityNames, fmt, parseEventDate } from '../store/data';
import { CityFilterDropdown, DonutChart, LineChart } from '../components/ui';
import { downloadCsv } from '../lib/csv';
import type { AdminEvent, LedgerEntry } from '../types';

const CHIPS = ['Sales', 'Profit & loss', 'Balance sheet', 'Commission by event', 'GST / tax', 'Refunds', 'Attendance', 'Promos'];
const DONUT_COLORS = ['#8bc34a', '#f1c40f', '#e67e22', '#e74c3c', '#9b59b6', '#3498db', '#1abc9c'];

function Line({ label, value, bold, red, indent, delta }: { label: string; value: string; bold?: boolean; red?: boolean; indent?: boolean; delta?: string }) {
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
      <span>
        <span className={red ? 'red' : bold ? 'green' : ''}>{value}</span>
        {delta && <span className="tiny muted" style={{ marginLeft: 8 }}>{delta}</span>}
      </span>
    </div>
  );
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function computeFin(rangeEvents: AdminEvent[], rangeLedger: LedgerEntry[], bookingFee: number, gstPct: number) {
  const selling = rangeEvents.filter((e) => e.status !== 'draft' && e.commission != null && e.revenue > 0);
  const commissionIncome = selling.reduce((a, e) => a + (e.revenue * (e.commission as number)) / 100, 0);
  const feeIncome = selling.reduce((a, e) => a + e.sold * bookingFee, 0);
  const otherIncome = rangeLedger.filter((l) => l.kind === 'income').reduce((a, l) => a + l.amount, 0);
  const expensesByCat = new Map<string, number>();
  rangeLedger.filter((l) => l.kind === 'expense').forEach((l) => expensesByCat.set(l.category, (expensesByCat.get(l.category) ?? 0) + l.amount));
  const totalExpenses = [...expensesByCat.values()].reduce((a, v) => a + v, 0);
  const gstPayable = Math.round((feeIncome * gstPct) / 100);
  const gross = selling.reduce((a, e) => a + e.revenue, 0);
  const payoutsDue = selling.filter((e) => !e.paidOut).reduce((a, e) => a + (e.revenue - (e.revenue * (e.commission as number)) / 100), 0);
  const paidOut = selling.filter((e) => e.paidOut).reduce((a, e) => a + (e.revenue - (e.revenue * (e.commission as number)) / 100), 0);
  const totalIncome = commissionIncome + feeIncome + otherIncome;
  const netProfit = totalIncome - totalExpenses - gstPayable;
  const cash = gross + otherIncome - paidOut - totalExpenses;
  return { commissionIncome, feeIncome, otherIncome, expensesByCat, totalExpenses, gstPayable, gross, payoutsDue, paidOut, totalIncome, netProfit, cash };
}

function deltaPct(cur: number, prev: number): string | undefined {
  if (!prev) return undefined;
  const pct = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs prev period`;
}

export default function Reports() {
  const { events, ledger, settings, toast, locations } = useAdmin();
  const [chip, setChip] = useState(CHIPS[0]);
  const [cityF, setCityF] = useState('All');
  const [to, setTo] = useState(() => toDateInput(new Date()));
  const [from, setFrom] = useState(() => toDateInput(new Date(Date.now() - 29 * 86400000)));
  const [compare, setCompare] = useState(false);
  const cities = enabledCityNames(locations);

  const cityEvents = cityF === 'All' ? events : events.filter((e) => e.city === cityF);

  const fromDate = useMemo(() => new Date(`${from}T00:00:00`), [from]);
  const toDate = useMemo(() => new Date(`${to}T23:59:59`), [to]);
  const spanMs = Math.max(86400000, toDate.getTime() - fromDate.getTime());

  const inRange = (d: Date, start: Date, end: Date) => d.getTime() >= start.getTime() && d.getTime() <= end.getTime();

  const rangeEvents = useMemo(() => cityEvents.filter((e) => inRange(parseEventDate(e.date), fromDate, toDate)), [cityEvents, fromDate, toDate]);
  const rangeLedger = useMemo(() => ledger.filter((l) => inRange(parseEventDate(l.date), fromDate, toDate)), [ledger, fromDate, toDate]);

  const fin = useMemo(() => computeFin(rangeEvents, rangeLedger, settings.bookingFee, settings.gstPct), [rangeEvents, rangeLedger, settings]);

  const prevFin = useMemo(() => {
    if (!compare) return null;
    const prevEnd = new Date(fromDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - spanMs);
    const prevEvents = cityEvents.filter((e) => inRange(parseEventDate(e.date), prevStart, prevEnd));
    const prevLedger = ledger.filter((l) => inRange(parseEventDate(l.date), prevStart, prevEnd));
    return computeFin(prevEvents, prevLedger, settings.bookingFee, settings.gstPct);
  }, [compare, cityEvents, ledger, fromDate, spanMs, settings]);

  const top = [...rangeEvents].filter((e) => e.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 3);

  // ---- real daily chart data (bucketed from each event's own date — the
  // mock has no per-day sales history, so an event's full revenue/commission
  // is attributed to its own date, which is the most honest real bucketing
  // this data supports) ----
  const dayCount = Math.min(60, Math.max(1, Math.round(spanMs / 86400000) + 1));
  const chartDays = useMemo(() => Array.from({ length: dayCount }, (_, i) => new Date(fromDate.getTime() + i * 86400000)), [fromDate, dayCount]);
  const grossByDay = chartDays.map((d) =>
    rangeEvents.filter((e) => parseEventDate(e.date).toDateString() === d.toDateString()).reduce((a, e) => a + e.revenue, 0)
  );
  const commissionByDay = chartDays.map((d) =>
    rangeEvents
      .filter((e) => e.commission != null && parseEventDate(e.date).toDateString() === d.toDateString())
      .reduce((a, e) => a + (e.revenue * (e.commission as number)) / 100, 0)
  );
  const dayLabels = [chartDays[0]?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), chartDays[chartDays.length - 1]?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })];

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    rangeEvents.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + e.revenue));
    return [...m.entries()].map(([label, value], i) => ({ label, value, color: DONUT_COLORS[i % DONUT_COLORS.length] }));
  }, [rangeEvents]);

  const exportCsv = () => {
    const period = `${from} to ${to}`;
    let rows: (string | number)[][];
    if (chip === 'Profit & loss') {
      rows = [
        ['Prebooze — Profit & loss statement', period],
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
      ];
    } else if (chip === 'Balance sheet') {
      rows = [
        ['Prebooze — Balance sheet', period],
        ['Section', 'Line', 'Amount (₹)'],
        ['Assets', 'Cash & bank', Math.round(fin.cash)],
        ['Liabilities', 'Organizer payouts due', Math.round(fin.payoutsDue)],
        ['Liabilities', 'GST payable', Math.round(fin.gstPayable)],
      ];
    } else {
      rows = [
        [`Prebooze — ${chip}`, period, cityF === 'All' ? 'All cities' : cityF],
        ['Date', 'Gross sales (₹)', 'Commission (₹)'],
        ...chartDays.map((d, i) => [d.toISOString().slice(0, 10), Math.round(grossByDay[i]), Math.round(commissionByDay[i])]),
        [],
        ['By category', 'Revenue (₹)'],
        ...byCategory.map((c) => [c.label, Math.round(c.value)]),
        [],
        ['Top events', 'City', 'Revenue (₹)'],
        ...top.map((e) => [e.title, e.city, e.revenue]),
      ];
    }
    downloadCsv(`prebooze-report-${chip.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${to}.csv`, rows);
    toast('Report exported ✓');
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <div className="page-hd">
        <h1 className="page-title">Reports</h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" type="date" style={{ width: 140 }} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <span className="tiny muted">–</span>
          <input className="input" type="date" style={{ width: 140 }} value={to} min={from} max={toDateInput(new Date())} onChange={(e) => setTo(e.target.value)} />
          <button className={`chip ${compare ? 'on' : ''}`} onClick={() => setCompare((v) => !v)}>vs prev. period</button>
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}>⬇ Export</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {CHIPS.map((c) => (
          <button key={c} className={`chip ${chip === c ? 'on' : ''}`} onClick={() => setChip(c)}>{c}</button>
        ))}
        <span style={{ flex: 1 }} />
        <CityFilterDropdown value={cityF} onChange={setCityF} cities={cities} />
      </div>

      {chip === 'Profit & loss' ? (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Profit &amp; loss statement</div>
          <div className="tiny muted" style={{ marginBottom: 10 }}>period: {from} – {to} · accrual basis · commission &amp; fees auto-posted from ticket sales</div>
          <Line label="Income" value="" bold />
          <Line label="Ticket commission (auto)" value={`₹${fmt(fin.commissionIncome)}`} indent />
          <Line label="Booking fees (auto)" value={`₹${fmt(fin.feeIncome)}`} indent />
          <Line label="Other income (sponsorships etc.)" value={`₹${fmt(fin.otherIncome)}`} indent />
          <Line label="Total income" value={`₹${fmt(fin.totalIncome)}`} bold delta={prevFin ? deltaPct(fin.totalIncome, prevFin.totalIncome) : undefined} />
          <div style={{ height: 10 }} />
          <Line label="Expenses" value="" bold />
          {[...fin.expensesByCat.entries()].map(([cat, amt]) => (
            <Line key={cat} label={cat} value={`−₹${fmt(amt)}`} indent red />
          ))}
          <Line label="GST payable on platform fees" value={`−₹${fmt(fin.gstPayable)}`} indent red />
          <Line label="Total expenses" value={`−₹${fmt(fin.totalExpenses + fin.gstPayable)}`} bold red />
          <div style={{ height: 10 }} />
          <Line label="Net profit" value={`₹${fmt(fin.netProfit)}`} bold red={fin.netProfit < 0} delta={prevFin ? deltaPct(fin.netProfit, prevFin.netProfit) : undefined} />
          <div className="tiny hint" style={{ marginTop: 10 }}>
            margin {fin.totalIncome > 0 ? Math.round((fin.netProfit / fin.totalIncome) * 100) : 0}% · manage entries under{' '}
            <Link to="/finance">Income &amp; expenses →</Link>
          </div>
        </div>
      ) : chip === 'Balance sheet' ? (
        <div className="two-col" style={{ maxWidth: 900 }}>
          <div className="card">
            <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Assets</div>
            <div className="tiny muted" style={{ marginBottom: 10 }}>as of {to}</div>
            <Line label="Cash & bank (collections − payouts − expenses)" value={`₹${fmt(fin.cash)}`} indent delta={prevFin ? deltaPct(fin.cash, prevFin.cash) : undefined} />
            <Line label="Receivables (gateway settlements in transit)" value="not modeled" indent />
            <Line label="Security deposits (venues)" value="not modeled" indent />
            <Line label="Total assets" value={`₹${fmt(fin.cash)}`} bold />
          </div>
          <div className="card">
            <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Liabilities &amp; equity</div>
            <div className="tiny muted" style={{ marginBottom: 10 }}>as of {to}</div>
            <Line label="Organizer payouts due" value={`₹${fmt(fin.payoutsDue)}`} indent red />
            <Line label="GST payable" value={`₹${fmt(fin.gstPayable)}`} indent red />
            <Line label="Total liabilities" value={`₹${fmt(fin.payoutsDue + fin.gstPayable)}`} bold red />
            <div style={{ height: 10 }} />
            <Line label="Owner's equity (balancing)" value={`₹${fmt(fin.cash - (fin.payoutsDue + fin.gstPayable))}`} bold />
          </div>
        </div>
      ) : (
        <>
          <div className="two-col">
            <div className="card">
              <div className="display" style={{ fontWeight: 700, marginBottom: 8 }}>
                {chip === 'Sales' ? 'Gross sales vs commission — daily' : `${chip} — daily`}
              </div>
              <LineChart
                height={120}
                labels={dayLabels as string[]}
                series={[
                  { label: 'Gross sales', color: '#8bc34a', points: grossByDay },
                  { label: 'Commission', color: '#f1c40f', points: commissionByDay },
                ]}
              />
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <div className="card">
                <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>By category</div>
                <DonutChart data={byCategory} size={90} />
              </div>
              <div className="card small">
                <div style={{ fontWeight: 700, marginBottom: 3 }}>Top events</div>
                {top.map((e) => (
                  <div key={e.id}>
                    {e.title} — ₹{fmt(e.revenue)}
                    {e.commission != null && <span className="muted"> · {e.commission}%</span>}
                  </div>
                ))}
                {top.length === 0 && <div className="tiny muted">No selling events in range</div>}
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
