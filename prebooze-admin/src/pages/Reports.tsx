import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CityFilterDropdown, DonutChart, Kpi, LineChart, Tag } from '../components/ui';
import { downloadCsv } from '../lib/csv';
import { liveReports, livePromos, LiveApiError, type LiveFinance, type LiveDailyPoint, type LiveRefundsReport, type LiveAttendanceReport, type LivePromo } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';

const TITLE = 'Reports';
const CHIPS = ['Sales', 'Profit & loss', 'Balance sheet', 'Commission by event', 'GST / tax', 'Refunds', 'Attendance', 'Promos'];
const DONUT_COLORS = ['#8bc34a', '#f1c40f', '#e67e22', '#e74c3c', '#9b59b6', '#3498db', '#1abc9c'];

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const discountLabel = (p: LivePromo) => (p.type === 'percent' ? `${p.value}% off${p.maxDiscount ? ` (up to ₹${p.maxDiscount})` : ''}` : `₹${p.value} off`);
const promoStatus = (p: LivePromo): 'active' | 'paused' | 'expired' => (new Date(p.validTill) < new Date() ? 'expired' : p.status === 'paused' ? 'paused' : 'active');

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

function deltaPct(cur: number, prev: number): string | undefined {
  if (!prev) return undefined;
  const pct = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs prev period`;
}

export default function Reports() {
  const session = useLiveSession();
  const { token } = session;
  const [chip, setChip] = useState(CHIPS[0]);
  const [cityF, setCityF] = useState('All');
  const [to, setTo] = useState(() => toDateInput(new Date()));
  const [from, setFrom] = useState(() => toDateInput(new Date(Date.now() - 29 * 86400000)));
  const [compare, setCompare] = useState(false);
  const [exported, setExported] = useState(false);
  const [err, setErr] = useState('');

  const [allCities, setAllCities] = useState<string[]>([]);
  const [finance, setFinance] = useState<LiveFinance | null>(null);
  const [prevFinance, setPrevFinance] = useState<LiveFinance | null>(null);
  const [daily, setDaily] = useState<LiveDailyPoint[] | null>(null);
  const [refunds, setRefunds] = useState<LiveRefundsReport | null>(null);
  const [attendance, setAttendance] = useState<LiveAttendanceReport | null>(null);
  const [promos, setPromos] = useState<LivePromo[] | null>(null);

  // City dropdown options — from an unfiltered, all-time snapshot, so
  // picking a city doesn't shrink the list of cities you could pick next
  // (the filtered fetch below only returns the selected city's own events).
  useEffect(() => {
    if (!token) return;
    liveReports.finance().then((f) => setAllCities([...new Set(f.sellingEvents.map((e) => e.city).filter((c): c is string => !!c))].sort())).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setErr('');
    const city = cityF === 'All' ? undefined : cityF;
    Promise.all([
      liveReports.finance(city, from, to),
      liveReports.daily(city, from, to),
      liveReports.refunds(city, from, to),
      liveReports.attendance(city, from, to),
    ])
      .then(([f, d, r, a]) => { setFinance(f); setDaily(d); setRefunds(r); setAttendance(a); })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load reports'));

    if (compare) {
      const fromDate = new Date(`${from}T00:00:00`);
      const toDate = new Date(`${to}T23:59:59`);
      const spanMs = Math.max(86400000, toDate.getTime() - fromDate.getTime());
      const prevEnd = new Date(fromDate.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - spanMs);
      liveReports.finance(city, toDateInput(prevStart), toDateInput(prevEnd)).then(setPrevFinance).catch(() => setPrevFinance(null));
    } else {
      setPrevFinance(null);
    }
  }, [token, cityF, from, to, compare]);

  // Promo codes are platform-wide, not date/city scoped — loaded once,
  // independent of the filters above (same convention the old mock used).
  useEffect(() => {
    if (!token) return;
    livePromos.list().then(setPromos).catch(() => setPromos([]));
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const fin = finance;
  const dayLabels = daily && daily.length > 0 ? [daily[0].date, daily[daily.length - 1].date] : ['', ''];
  const byCategory = useMemo(
    () => (fin ? Object.entries(fin.revenueByCategory).map(([label, value], i) => ({ label, value, color: DONUT_COLORS[i % DONUT_COLORS.length] })) : []),
    [fin]
  );
  const top3 = fin ? fin.sellingEvents.slice(0, 3) : [];

  const promosActive = promos?.filter((p) => promoStatus(p) === 'active').length ?? 0;
  const promosPaused = promos?.filter((p) => promoStatus(p) === 'paused').length ?? 0;
  const promosExpired = promos?.filter((p) => promoStatus(p) === 'expired').length ?? 0;
  const totalRedemptions = promos?.reduce((a, p) => a + p.used, 0) ?? 0;

  const exportCsv = () => {
    if (!fin) return;
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
        ...Object.entries(fin.expensesByCat).map(([cat, amt]) => ['Expenses', cat, -Math.round(amt)]),
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
        ...fin.sellingEvents.map((e) => [e.title, e.city ?? '', Math.round(e.revenue), e.commission, Math.round(e.commissionAmt), e.paidOut ? 'yes' : 'no']),
      ];
    } else if (chip === 'GST / tax') {
      rows = [
        [`Prebooze — ${chip}`, period, cityF === 'All' ? 'All cities' : cityF],
        ['GST rate (%)', fin.settings.gstPct],
        ['Taxable base — booking fees (₹)', Math.round(fin.feeIncome)],
        ['GST payable (₹)', Math.round(fin.gstPayable)],
        [],
        ['Date', 'Booking fees (₹)', 'GST payable (₹)'],
        ...(daily ?? []).map((d) => [d.date, d.bookingFees, d.gstPayable]),
      ];
    } else if (chip === 'Refunds' && refunds) {
      rows = [
        [`Prebooze — ${chip}`, period, cityF === 'All' ? 'All cities' : cityF],
        ['Booking', 'Guest', 'Event', 'Amount (₹)', 'Status'],
        ...refunds.rows.map((b) => [b.id, b.guest, b.eventTitle, b.amount, b.status]),
      ];
    } else if (chip === 'Attendance' && attendance) {
      rows = [
        [`Prebooze — ${chip}`, period, cityF === 'All' ? 'All cities' : cityF],
        ['Event', 'Sold', 'Checked in', 'Turnout (%)'],
        ...attendance.rows.map((r) => [r.title, r.sold, r.checkedIn, r.sold ? Math.round((r.checkedIn / r.sold) * 100) : 0]),
      ];
    } else if (chip === 'Promos' && promos) {
      rows = [
        [`Prebooze — ${chip}`, 'lifetime totals — not date-scoped', cityF === 'All' ? 'All cities' : cityF],
        ['Code', 'Discount', 'Scope', 'Used', 'Status'],
        ...promos.map((p) => [p.code, discountLabel(p), p.eventScope, `${p.used}/${p.usageLimit}`, promoStatus(p)]),
      ];
    } else {
      rows = [
        [`Prebooze — ${chip}`, period, cityF === 'All' ? 'All cities' : cityF],
        ['Date', 'Gross sales (₹)', 'Commission (₹)'],
        ...(daily ?? []).map((d) => [d.date, d.grossSales, d.commission]),
        [],
        ['Top events', 'City', 'Revenue (₹)'],
        ...top3.map((e) => [e.title, e.city ?? '', e.revenue]),
      ];
    }
    downloadCsv(`prebooze-report-${chip.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${to}.csv`, rows);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
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
          <button className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!fin}>⬇ Export</button>
          {exported && <span className="tiny muted">Exported ✓</span>}
        </div>
      </div>

      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {CHIPS.map((c) => (
          <button key={c} className={`chip ${chip === c ? 'on' : ''}`} onClick={() => setChip(c)}>{c}</button>
        ))}
        <span style={{ flex: 1 }} />
        <CityFilterDropdown value={cityF} onChange={setCityF} cities={allCities} />
      </div>

      {!fin ? (
        <div className="tiny muted">Loading…</div>
      ) : chip === 'Profit & loss' ? (
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
          <Line label="Total income" value={`₹${fmt(fin.totalIncome)}`} bold delta={prevFinance ? deltaPct(fin.totalIncome, prevFinance.totalIncome) : undefined} />
          <div style={{ height: 10 }} />
          <Line label="Expenses" value="" bold />
          {Object.entries(fin.expensesByCat).map(([cat, amt]) => (
            <Line key={cat} label={cat} value={`−₹${fmt(amt)}`} indent red />
          ))}
          <Line label="GST payable on platform fees" value={`−₹${fmt(fin.gstPayable)}`} indent red />
          <Line label="Total expenses" value={`−₹${fmt(fin.totalExpenses + fin.gstPayable)}`} bold red />
          <div style={{ height: 10 }} />
          <Line label="Net profit" value={`₹${fmt(fin.netProfit)}`} bold red={fin.netProfit < 0} delta={prevFinance ? deltaPct(fin.netProfit, prevFinance.netProfit) : undefined} />
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
              <Line label="Cash & bank (collections − payouts − expenses)" value={`₹${fmt(fin.cash)}`} indent delta={prevFinance ? deltaPct(fin.cash, prevFinance.cash) : undefined} />
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
                labels={dayLabels}
                series={[
                  { label: 'Gross sales', color: '#8bc34a', points: (daily ?? []).map((d) => d.grossSales) },
                  { label: 'Commission', color: '#f1c40f', points: (daily ?? []).map((d) => d.commission) },
                ]}
              />
            </div>
            <div className="stack" style={{ gap: 10 }}>
              {byCategory.length > 0 && (
                <div className="card">
                  <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>By category</div>
                  <DonutChart data={byCategory} size={90} />
                </div>
              )}
              <div className="card small">
                <div style={{ fontWeight: 700, marginBottom: 3 }}>Top events</div>
                {top3.map((e) => (
                  <div key={e.id}>
                    {e.title} — ₹{fmt(e.revenue)}
                    <span className="muted"> · {e.commission}%</span>
                  </div>
                ))}
                {top3.length === 0 && <div className="tiny muted">No selling events in range</div>}
              </div>
            </div>
          </div>
        </>
      ) : chip === 'Commission by event' ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="kpi-grid">
            <Kpi label="Selling events" value={fmt(fin.sellingEvents.length)} />
            <Kpi label="Total commission" value={`₹${fmt(fin.commissionIncome)}`} delta={prevFinance ? deltaPct(fin.commissionIncome, prevFinance.commissionIncome) : undefined} deltaColor="var(--green)" />
            <Kpi label="Avg commission rate" value={`${fin.sellingEvents.length ? Math.round(fin.sellingEvents.reduce((a, e) => a + e.commission, 0) / fin.sellingEvents.length) : 0}%`} />
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
            {fin.sellingEvents.map((e) => (
              <div key={e.id} className="trow" style={{ minWidth: 680 }}>
                <span style={{ flex: 1.4, fontWeight: 700 }}>{e.title}</span>
                <span style={{ flex: 1 }} className="muted">{e.city ?? '—'}</span>
                <span style={{ flex: 1 }}>₹{fmt(e.revenue)}</span>
                <span style={{ flex: 0.8 }} className="muted">{e.commission}%</span>
                <span style={{ flex: 1, fontWeight: 700 }} className="green">₹{fmt(e.commissionAmt)}</span>
                <span style={{ flex: 1 }}>{e.paidOut ? <Tag label="Paid" cls="tag-green" /> : <Tag label="Due" cls="tag-red" />}</span>
              </div>
            ))}
            {fin.sellingEvents.length === 0 && <div className="trow muted">No selling events in range.</div>}
          </div>
        </div>
      ) : chip === 'GST / tax' ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="kpi-grid">
            <Kpi label="GST rate" value={`${fin.settings.gstPct}%`} />
            <Kpi label="Taxable base (booking fees)" value={`₹${fmt(fin.feeIncome)}`} />
            <Kpi label="GST payable" value={`₹${fmt(fin.gstPayable)}`} delta={prevFinance ? deltaPct(fin.gstPayable, prevFinance.gstPayable) : undefined} deltaColor="var(--red)" />
            <Kpi label="Net of GST" value={`₹${fmt(fin.feeIncome - fin.gstPayable)}`} />
          </div>
          <div className="card">
            <div className="display" style={{ fontWeight: 700, marginBottom: 8 }}>GST payable — daily</div>
            <LineChart height={120} labels={dayLabels} series={[{ label: 'GST payable', color: '#e74c3c', points: (daily ?? []).map((d) => d.gstPayable) }]} />
          </div>
          <div className="tiny hint">GST is charged on Prebooze's booking-fee income only (not the organizer's ticket price or commission) · rate is editable under <Link to="/settings">Settings →</Link></div>
        </div>
      ) : chip === 'Refunds' ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="kpi-grid">
            <Kpi label="Refund requests" value={fmt(refunds?.requestedCount ?? 0)} alert={(refunds?.requestedCount ?? 0) > 0} />
            <Kpi label="Refunded" value={fmt(refunds?.refundedCount ?? 0)} />
            <Kpi label="Refunded value" value={`₹${fmt(refunds?.refundedValue ?? 0)}`} delta="returned to guests" deltaColor="var(--red)" />
            <Kpi label="Refund rate" value={`${refunds?.refundRate ?? 0}%`} delta="of bookings in range" deltaColor="var(--muted)" />
          </div>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 680 }}>
              <span style={{ flex: 1 }}>Booking</span>
              <span style={{ flex: 1.4 }}>Guest</span>
              <span style={{ flex: 1.4 }}>Event</span>
              <span style={{ flex: 0.8 }}>Amount</span>
              <span style={{ flex: 1 }}>Status</span>
            </div>
            {(refunds?.rows ?? []).map((b) => (
              <Link key={b.id} to={`/bookings/${encodeURIComponent(b.id)}`} className="trow" style={{ minWidth: 680 }}>
                <span style={{ flex: 1 }} className="muted">{b.id}</span>
                <span style={{ flex: 1.4, fontWeight: 700 }}>{b.guest}</span>
                <span style={{ flex: 1.4 }} className="muted">{b.eventTitle}</span>
                <span style={{ flex: 0.8 }}>₹{fmt(b.amount)}</span>
                <span style={{ flex: 1 }}>{b.status === 'refund_requested' ? <Tag label="Requested" cls="tag-red" /> : <Tag label="Refunded" cls="tag-dim" />}</span>
              </Link>
            ))}
            {(refunds?.rows.length ?? 0) === 0 && <div className="trow muted">No refund activity in range.</div>}
          </div>
          <div className="tiny hint">bucketed by each booking's purchase date, within the selected range and city · manage refunds under <Link to="/bookings">Bookings →</Link></div>
        </div>
      ) : chip === 'Attendance' ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="kpi-grid">
            <Kpi label="Tickets sold" value={fmt(attendance?.sold ?? 0)} />
            <Kpi label="Checked in" value={fmt(attendance?.checkedIn ?? 0)} />
            <Kpi label="Turnout rate" value={`${attendance?.turnoutRate ?? 0}%`} deltaColor="var(--green)" />
            <Kpi label="No-shows (est.)" value={fmt(Math.max(0, (attendance?.sold ?? 0) - (attendance?.checkedIn ?? 0)))} />
          </div>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 640 }}>
              <span style={{ flex: 1.6 }}>Event</span>
              <span style={{ flex: 1 }}>Sold</span>
              <span style={{ flex: 1 }}>Checked in</span>
              <span style={{ flex: 1 }}>Turnout</span>
            </div>
            {(attendance?.rows ?? []).map((r) => (
              <div key={r.id} className="trow" style={{ minWidth: 640 }}>
                <span style={{ flex: 1.6, fontWeight: 700 }}>{r.title}</span>
                <span style={{ flex: 1 }}>{fmt(r.sold)}</span>
                <span style={{ flex: 1 }} className="green">{fmt(r.checkedIn)}</span>
                <span style={{ flex: 1 }}>{r.sold ? Math.round((r.checkedIn / r.sold) * 100) : 0}%</span>
              </div>
            ))}
            {(attendance?.rows.length ?? 0) === 0 && <div className="trow muted">No ticketed bookings in range.</div>}
          </div>
          <div className="tiny hint">"checked in" counts each guest on a booking individually (partial group check-in included), based on purchase date · promoter guest-list arrivals are tracked separately under each event's live monitor</div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          <div className="tiny hint">promo codes are platform-wide, not scoped to the selected date range — usage figures are lifetime totals</div>
          <div className="kpi-grid">
            <Kpi label="Active codes" value={fmt(promosActive)} />
            <Kpi label="Paused" value={fmt(promosPaused)} />
            <Kpi label="Expired" value={fmt(promosExpired)} />
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
            {(promos ?? []).map((p) => (
              <div key={p.code} className="trow" style={{ minWidth: 640 }}>
                <span style={{ flex: 1, fontWeight: 700 }}>{p.code}</span>
                <span style={{ flex: 1.2 }} className="muted">{discountLabel(p)}</span>
                <span style={{ flex: 1.2 }} className="muted">{p.eventScope}</span>
                <span style={{ flex: 1 }}>{p.used}/{p.usageLimit}</span>
                <span style={{ flex: 1 }}>
                  {promoStatus(p) === 'active' ? <Tag label="Active" cls="tag-green" /> : promoStatus(p) === 'paused' ? <Tag label="Paused" cls="" /> : <Tag label="Expired" cls="tag-dim" />}
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
