import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { enabledCityNames, fmt, parseEventDate } from '../store/data';
import { CityFilterDropdown, DonutChart, Kpi, LineChart, Tag } from '../components/ui';
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
  const { events, ledger, bookings, promos, settings, toast, locations } = useAdmin();
  const [chip, setChip] = useState(CHIPS[0]);
  const [cityF, setCityF] = useState('All');
  // Revenue here is recognized on the event's own date (see parseEventDate),
  // and seed/real events are typically upcoming (on-sale) rather than past —
  // defaulting `to` to today excluded every event that hasn't happened yet,
  // making ticket commission/booking-fee income silently show ₹0 on first
  // load despite real sales existing. Extend the default window forward so
  // already-sold revenue for near-term upcoming events is included too.
  const [to, setTo] = useState(() => toDateInput(new Date(Date.now() + 60 * 86400000)));
  const [from, setFrom] = useState(() => toDateInput(new Date(Date.now() - 29 * 86400000)));
  const [compare, setCompare] = useState(false);
  const cities = enabledCityNames(locations);

  const cityEvents = cityF === 'All' ? events : events.filter((e) => e.city === cityF);

  const fromDate = useMemo(() => new Date(`${from}T00:00:00`), [from]);
  const toDate = useMemo(() => new Date(`${to}T23:59:59`), [to]);
  const spanMs = Math.max(86400000, toDate.getTime() - fromDate.getTime());

  const inRange = (d: Date, start: Date, end: Date) => d.getTime() >= start.getTime() && d.getTime() <= end.getTime();

  const rangeEvents = useMemo(() => cityEvents.filter((e) => inRange(parseEventDate(e.date), fromDate, toDate)), [cityEvents, fromDate, toDate]);
  // LedgerEntry has no city field — it's Prebooze's own company-wide book
  // (staff salaries, marketing, sponsorships...), not per-event. Blending it
  // into a single city's P&L would misrepresent company overhead as that
  // city's own numbers (e.g. a city with zero events would still show the
  // full platform's "other income", making the filter look disconnected) —
  // so it's included only in the All-cities view, and a note in the UI says
  // so explicitly rather than leaving it silently unfiltered-looking.
  const rangeLedger = useMemo(
    () => (cityF === 'All' ? ledger.filter((l) => inRange(parseEventDate(l.date), fromDate, toDate)) : []),
    [ledger, fromDate, toDate, cityF]
  );

  const fin = useMemo(() => computeFin(rangeEvents, rangeLedger, settings.bookingFee, settings.gstPct), [rangeEvents, rangeLedger, settings]);

  const prevFin = useMemo(() => {
    if (!compare) return null;
    const prevEnd = new Date(fromDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - spanMs);
    const prevEvents = cityEvents.filter((e) => inRange(parseEventDate(e.date), prevStart, prevEnd));
    const prevLedger = cityF === 'All' ? ledger.filter((l) => inRange(parseEventDate(l.date), prevStart, prevEnd)) : [];
    return computeFin(prevEvents, prevLedger, settings.bookingFee, settings.gstPct);
  }, [compare, cityEvents, ledger, fromDate, spanMs, settings, cityF]);

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

  const eventTitle = (id: string) => events.find((e) => e.id === id)?.title ?? id;

  // ---- Commission by event — same selling-events set as the P&L, just
  // broken out per row instead of summed into one line ----
  const commissionRows = useMemo(
    () =>
      rangeEvents
        .filter((e) => e.status !== 'draft' && e.commission != null && e.revenue > 0)
        .map((e) => ({ ...e, commissionAmt: (e.revenue * (e.commission as number)) / 100 }))
        .sort((a, b) => b.commissionAmt - a.commissionAmt),
    [rangeEvents]
  );
  const avgCommissionRate = commissionRows.length
    ? Math.round(commissionRows.reduce((a, e) => a + (e.commission as number), 0) / commissionRows.length)
    : 0;

  // ---- GST / tax — GST is charged on Prebooze's booking-fee income only
  // (see computeFin), so its daily series is the fee series scaled by rate
  // rather than a separate bucketing pass ----
  const feeByDay = chartDays.map((d) =>
    rangeEvents
      .filter((e) => e.commission != null && parseEventDate(e.date).toDateString() === d.toDateString())
      .reduce((a, e) => a + e.sold * settings.bookingFee, 0)
  );
  const gstByDay = feeByDay.map((v) => (v * settings.gstPct) / 100);

  // ---- Refunds / Attendance — both derive from bookings tied to an event
  // in the current range + city filter (AdminBooking itself has no date, so
  // it's bucketed via its event's date, same convention as everything else
  // in this file) ----
  const rangeEventIds = useMemo(() => new Set(rangeEvents.map((e) => e.id)), [rangeEvents]);
  const rangeBookings = useMemo(() => bookings.filter((b) => rangeEventIds.has(b.eventId)), [bookings, rangeEventIds]);

  const refundRequested = rangeBookings.filter((b) => b.status === 'refund_requested');
  const refunded = rangeBookings.filter((b) => b.status === 'refunded');
  const refundedValue = refunded.reduce((a, b) => a + b.amount, 0);
  const refundRate = rangeBookings.length ? Math.round(((refunded.length + refundRequested.length) / rangeBookings.length) * 100) : 0;
  const refundRows = [...refundRequested, ...refunded];

  const ticketsSold = rangeBookings.filter((b) => b.status !== 'refunded').reduce((a, b) => a + b.qty, 0);
  const ticketsCheckedIn = rangeBookings.filter((b) => b.status === 'checked_in').reduce((a, b) => a + b.qty, 0);
  const turnoutRate = ticketsSold ? Math.round((ticketsCheckedIn / ticketsSold) * 100) : 0;
  const attendanceRows = useMemo(() => {
    const m = new Map<string, { sold: number; checkedIn: number }>();
    rangeBookings.forEach((b) => {
      const cur = m.get(b.eventId) ?? { sold: 0, checkedIn: 0 };
      if (b.status !== 'refunded') cur.sold += b.qty;
      if (b.status === 'checked_in') cur.checkedIn += b.qty;
      m.set(b.eventId, cur);
    });
    return [...m.entries()].map(([id, v]) => ({ id, title: eventTitle(id), ...v })).sort((a, b) => b.sold - a.sold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeBookings]);

  // ---- Promos — codes are platform-wide, not scoped to a date range, so
  // this tab shows lifetime usage rather than filtering by `from`/`to` ----
  const parseUsed = (label: string) => parseInt(label.split('/')[0].replace(/\D/g, ''), 10) || 0;
  const totalRedemptions = promos.reduce((a, p) => a + parseUsed(p.usedLabel), 0);

  const exportCsv = () => {
    const period = `${from} to ${to}`;
    let rows: (string | number)[][];
    if (chip === 'Profit & loss') {
      rows = [
        ['Prebooze — Profit & loss statement', period, cityF === 'All' ? 'All cities' : cityF],
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
        ['Prebooze — Balance sheet', period, cityF === 'All' ? 'All cities' : cityF],
        ['Section', 'Line', 'Amount (₹)'],
        ['Assets', 'Cash & bank', Math.round(fin.cash)],
        ['Liabilities', 'Organizer payouts due', Math.round(fin.payoutsDue)],
        ['Liabilities', 'GST payable', Math.round(fin.gstPayable)],
      ];
    } else if (chip === 'Commission by event') {
      rows = [
        [`Prebooze — ${chip}`, period, cityF === 'All' ? 'All cities' : cityF],
        ['Event', 'City', 'Gross (₹)', 'Rate (%)', 'Commission (₹)', 'Paid out'],
        ...commissionRows.map((e) => [e.title, e.city, Math.round(e.revenue), e.commission as number, Math.round(e.commissionAmt), e.paidOut ? 'yes' : 'no']),
      ];
    } else if (chip === 'GST / tax') {
      rows = [
        [`Prebooze — ${chip}`, period, cityF === 'All' ? 'All cities' : cityF],
        ['GST rate (%)', settings.gstPct],
        ['Taxable base — booking fees (₹)', Math.round(fin.feeIncome)],
        ['GST payable (₹)', Math.round(fin.gstPayable)],
        [],
        ['Date', 'Booking fees (₹)', 'GST payable (₹)'],
        ...chartDays.map((d, i) => [d.toISOString().slice(0, 10), Math.round(feeByDay[i]), Math.round(gstByDay[i])]),
      ];
    } else if (chip === 'Refunds') {
      rows = [
        [`Prebooze — ${chip}`, period, cityF === 'All' ? 'All cities' : cityF],
        ['Booking', 'Guest', 'Event', 'Amount (₹)', 'Status'],
        ...refundRows.map((b) => [b.id, b.guest, eventTitle(b.eventId), b.amount, b.status]),
      ];
    } else if (chip === 'Attendance') {
      rows = [
        [`Prebooze — ${chip}`, period, cityF === 'All' ? 'All cities' : cityF],
        ['Event', 'Sold', 'Checked in', 'Turnout (%)'],
        ...attendanceRows.map((r) => [r.title, r.sold, r.checkedIn, r.sold ? Math.round((r.checkedIn / r.sold) * 100) : 0]),
      ];
    } else if (chip === 'Promos') {
      rows = [
        [`Prebooze — ${chip}`, 'lifetime totals — not date-scoped', cityF === 'All' ? 'All cities' : cityF],
        ['Code', 'Discount', 'Scope', 'Used', 'Status'],
        ...promos.map((p) => [p.code, p.discountLabel, p.scope, p.usedLabel, p.status]),
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
          <input className="input" type="date" style={{ width: 140 }} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
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
          <div className="tiny muted" style={{ marginBottom: 10 }}>period: {from} – {to} · {cityF === 'All' ? 'all cities' : cityF} · accrual basis · commission &amp; fees auto-posted from ticket sales</div>
          {cityF !== 'All' && (
            <div className="tiny hint" style={{ marginBottom: 10 }}>
              Showing {cityF}'s ticket commission &amp; booking fees only — other income and expenses are company-wide overhead not attributed to a single city, and only appear in the All-cities view.
            </div>
          )}
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
        <div className="stack" style={{ maxWidth: 900, gap: 10 }}>
          {cityF !== 'All' && (
            <div className="tiny hint">
              Showing {cityF}'s ticket cash flow only — other income and expenses are company-wide overhead not attributed to a single city, and only appear in the All-cities view.
            </div>
          )}
          <div className="two-col">
          <div className="card">
            <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Assets</div>
            <div className="tiny muted" style={{ marginBottom: 10 }}>as of {to} · {cityF === 'All' ? 'all cities' : cityF}</div>
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
        </div>
      ) : chip === 'Sales' ? (
        <>
          <div className="two-col">
            <div className="card">
              <div className="display" style={{ fontWeight: 700, marginBottom: 8 }}>Gross sales vs commission — daily</div>
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
      ) : chip === 'Commission by event' ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="kpi-grid">
            <Kpi label="Selling events" value={fmt(commissionRows.length)} />
            <Kpi label="Total commission" value={`₹${fmt(fin.commissionIncome)}`} delta={prevFin ? deltaPct(fin.commissionIncome, prevFin.commissionIncome) : undefined} deltaColor="var(--green)" />
            <Kpi label="Avg commission rate" value={`${avgCommissionRate}%`} />
            <Kpi label="Not yet paid out" value={`₹${fmt(fin.payoutsDue)}`} delta="organizer payouts due" deltaColor="var(--muted)" />
          </div>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 680 }}>
              <span style={{ flex: 1.4 }}>Event</span>
              <span style={{ flex: 1 }}>City</span>
              <span style={{ flex: 1 }}>Gross</span>
              <span style={{ flex: 0.8 }}>Rate</span>
              <span style={{ flex: 1 }}>Commission</span>
              <span style={{ flex: 1 }}>Payout</span>
            </div>
            {commissionRows.map((e) => (
              <div key={e.id} className="trow" style={{ minWidth: 680 }}>
                <span style={{ flex: 1.4, fontWeight: 700 }}>{e.title}</span>
                <span style={{ flex: 1 }} className="muted">{e.city}</span>
                <span style={{ flex: 1 }}>₹{fmt(e.revenue)}</span>
                <span style={{ flex: 0.8 }} className="muted">{e.commission}%</span>
                <span style={{ flex: 1, fontWeight: 700 }} className="green">₹{fmt(e.commissionAmt)}</span>
                <span style={{ flex: 1 }}>{e.paidOut ? <Tag label="Paid" cls="tag-green" /> : <Tag label="Due" cls="tag-red" />}</span>
              </div>
            ))}
            {commissionRows.length === 0 && <div className="trow muted">No selling events in range.</div>}
          </div>
        </div>
      ) : chip === 'GST / tax' ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="kpi-grid">
            <Kpi label="GST rate" value={`${settings.gstPct}%`} />
            <Kpi label="Taxable base (booking fees)" value={`₹${fmt(fin.feeIncome)}`} />
            <Kpi label="GST payable" value={`₹${fmt(fin.gstPayable)}`} delta={prevFin ? deltaPct(fin.gstPayable, prevFin.gstPayable) : undefined} deltaColor="var(--red)" />
            <Kpi label="Net of GST" value={`₹${fmt(fin.feeIncome - fin.gstPayable)}`} />
          </div>
          <div className="card">
            <div className="display" style={{ fontWeight: 700, marginBottom: 8 }}>GST payable — daily</div>
            <LineChart height={120} labels={dayLabels as string[]} series={[{ label: 'GST payable', color: '#e74c3c', points: gstByDay }]} />
          </div>
          <div className="tiny hint">GST is charged on Prebooze's booking-fee income only (not the organizer's ticket price or commission) · rate is editable under <Link to="/settings">Settings →</Link></div>
        </div>
      ) : chip === 'Refunds' ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="kpi-grid">
            <Kpi label="Refund requests" value={fmt(refundRequested.length)} alert={refundRequested.length > 0} />
            <Kpi label="Refunded" value={fmt(refunded.length)} />
            <Kpi label="Refunded value" value={`₹${fmt(refundedValue)}`} delta="returned to guests" deltaColor="var(--red)" />
            <Kpi label="Refund rate" value={`${refundRate}%`} delta="of bookings in range" deltaColor="var(--muted)" />
          </div>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 680 }}>
              <span style={{ flex: 1 }}>Booking</span>
              <span style={{ flex: 1.4 }}>Guest</span>
              <span style={{ flex: 1.4 }}>Event</span>
              <span style={{ flex: 0.8 }}>Amount</span>
              <span style={{ flex: 1 }}>Status</span>
            </div>
            {refundRows.map((b) => (
              <div key={b.id} className="trow" style={{ minWidth: 680 }}>
                <span style={{ flex: 1 }} className="muted">{b.id}</span>
                <span style={{ flex: 1.4, fontWeight: 700 }}>{b.guest}</span>
                <span style={{ flex: 1.4 }} className="muted">{eventTitle(b.eventId)}</span>
                <span style={{ flex: 0.8 }}>₹{fmt(b.amount)}</span>
                <span style={{ flex: 1 }}>{b.status === 'refund_requested' ? <Tag label="Requested" cls="tag-red" /> : <Tag label="Refunded" cls="tag-dim" />}</span>
              </div>
            ))}
            {refundRows.length === 0 && <div className="trow muted">No refund activity in range.</div>}
          </div>
          <div className="tiny hint">bucketed by each booking's event date, within the selected range and city · manage refunds under <Link to="/bookings">Bookings →</Link></div>
        </div>
      ) : chip === 'Attendance' ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="kpi-grid">
            <Kpi label="Tickets sold" value={fmt(ticketsSold)} />
            <Kpi label="Checked in" value={fmt(ticketsCheckedIn)} />
            <Kpi label="Turnout rate" value={`${turnoutRate}%`} deltaColor="var(--green)" />
            <Kpi label="No-shows (est.)" value={fmt(Math.max(0, ticketsSold - ticketsCheckedIn))} />
          </div>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 640 }}>
              <span style={{ flex: 1.6 }}>Event</span>
              <span style={{ flex: 1 }}>Sold</span>
              <span style={{ flex: 1 }}>Checked in</span>
              <span style={{ flex: 1 }}>Turnout</span>
            </div>
            {attendanceRows.map((r) => (
              <div key={r.id} className="trow" style={{ minWidth: 640 }}>
                <span style={{ flex: 1.6, fontWeight: 700 }}>{r.title}</span>
                <span style={{ flex: 1 }}>{fmt(r.sold)}</span>
                <span style={{ flex: 1 }} className="green">{fmt(r.checkedIn)}</span>
                <span style={{ flex: 1 }}>{r.sold ? Math.round((r.checkedIn / r.sold) * 100) : 0}%</span>
              </div>
            ))}
            {attendanceRows.length === 0 && <div className="trow muted">No ticketed bookings in range.</div>}
          </div>
          <div className="tiny hint">"checked in" reflects gate-scan status on each ticket booking · promoter guest-list arrivals are tracked separately under each event's live monitor</div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          <div className="tiny hint">promo codes are platform-wide, not scoped to the selected date range — usage figures are lifetime totals</div>
          <div className="kpi-grid">
            <Kpi label="Active codes" value={fmt(promos.filter((p) => p.status === 'active').length)} />
            <Kpi label="Paused" value={fmt(promos.filter((p) => p.status === 'paused').length)} />
            <Kpi label="Expired" value={fmt(promos.filter((p) => p.status === 'expired').length)} />
            <Kpi label="Total redemptions" value={fmt(totalRedemptions)} />
          </div>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 640 }}>
              <span style={{ flex: 1 }}>Code</span>
              <span style={{ flex: 1.2 }}>Discount</span>
              <span style={{ flex: 1.2 }}>Scope</span>
              <span style={{ flex: 1 }}>Used</span>
              <span style={{ flex: 1 }}>Status</span>
            </div>
            {promos.map((p) => (
              <div key={p.code} className="trow" style={{ minWidth: 640 }}>
                <span style={{ flex: 1, fontWeight: 700 }}>{p.code}</span>
                <span style={{ flex: 1.2 }} className="muted">{p.discountLabel}</span>
                <span style={{ flex: 1.2 }} className="muted">{p.scope}</span>
                <span style={{ flex: 1 }}>{p.usedLabel}</span>
                <span style={{ flex: 1 }}>
                  {p.status === 'active' ? <Tag label="Active" cls="tag-green" /> : p.status === 'paused' ? <Tag label="Paused" cls="" /> : <Tag label="Expired" cls="tag-dim" />}
                </span>
              </div>
            ))}
          </div>
          <div className="tiny hint">manage codes under <Link to="/promos">Promo codes →</Link></div>
        </div>
      )}
    </div>
  );
}
