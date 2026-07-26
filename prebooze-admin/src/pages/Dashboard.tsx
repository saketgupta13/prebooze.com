import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Kpi, Tag } from '../components/ui';
import { liveDashboard, liveEvents, LiveApiError, type LiveDashboard } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Dashboard';
const RANGES: Record<string, number> = { 'Last 7 days': 7, 'Last 14 days': 14, 'Last 30 days': 30, 'Last 90 days': 90 };
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const fmtMoney = (n: number) => `₹${fmt(n)}`;
const STATUS_TAG: Record<string, { label: string; cls: string }> = {
  approved: { label: '● Live', cls: 'tag-green' },
  pending: { label: 'Pending', cls: 'tag-red' },
};

/** Real KPIs, computed live from the database on every request (grossSales,
 * trend, ticket stats, top events/promoters — DashboardService.overview) —
 * no hardcoded display padding like the old mock had, so a small dataset
 * legitimately looks sparse (honest, not broken). Same layout as before. */
export default function Dashboard() {
  const session = useLiveSession();
  const { token } = session;
  const navigate = useNavigate();

  const [data, setData] = useState<LiveDashboard | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [range, setRange] = useState('Last 14 days');
  const [topCity, setTopCity] = useState('All');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const days = RANGES[range];

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setErr('');
    Promise.all([liveDashboard.overview(days, topCity === 'All' ? undefined : topCity), liveEvents.list()])
      .then(([d, evs]) => {
        setData(d);
        setCities([...new Set(evs.map((e) => e.venue.city))]);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token, days, topCity]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const trend = data?.salesTrend ?? [];
  const max = Math.max(...trend.map((t) => t.gross), 1);
  const labelEvery = Math.max(1, Math.ceil(trend.length / 7));

  return (
    <div className="stack fade" style={{ maxWidth: 1200, gap: 16 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="display" style={{ fontSize: 22 }}>Good morning, Admin 👋</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="chip" style={{ appearance: 'none', cursor: 'pointer', background: 'var(--bg)' }} value={range} onChange={(e) => setRange(e.target.value)}>
            {Object.keys(RANGES).map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <Link to="/organizers/new" className="btn btn-pri btn-sm">+ Add organizer</Link>
        </div>
      </div>

      {data && (
        <>
          <div className="kpi-grid">
            <Kpi label="Gross sales" value={fmtMoney(data.grossSales)} />
            <Kpi label="Tickets sold" value={fmt(data.ticketsSold)} />
            <Kpi label="Commission earned" value={fmtMoney(data.commissionEarned)} />
            <Kpi label="Refunds" value={fmtMoney(data.refundsAmount)} delta={`${data.refundedTickets} tickets`} deltaColor="var(--red)" alert />
          </div>

          <div className="kpi-grid">
            <Kpi label="Total customers" value={fmt(data.totalCustomers)} delta="registered guests" deltaColor="var(--muted)" />
            <Kpi label="Total organizers" value={data.totalOrganizers} delta={`${data.verifiedOrganizers} verified`} deltaColor="var(--muted)" />
            <Kpi label="Total events" value={data.totalEvents} delta={`${data.liveNow} live now`} deltaColor="var(--muted)" />
            <Kpi label="Total bookings" value={fmt(data.totalBookings)} delta={`${data.pendingRefunds} refund requests`} deltaColor="var(--muted)" />
          </div>

          <div className="two-col">
            <div className="card">
              <div className="display" style={{ marginBottom: 2, fontWeight: 700 }}>Sales trend</div>
              <div className="tiny muted" style={{ marginBottom: 8 }}>
                daily gross sales (₹) · {range.toLowerCase()}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 220, textAlign: 'right' }} className="tiny muted">
                  <span>₹{fmt(max)}</span>
                  <span>₹{fmt(Math.round((max * 3) / 4))}</span>
                  <span>₹{fmt(Math.round(max / 2))}</span>
                  <span>₹{fmt(Math.round(max / 4))}</span>
                  <span>₹0</span>
                </div>
                <div style={{ flex: 1, borderLeft: '1px solid rgba(139,195,74,.25)', borderBottom: '1px solid rgba(139,195,74,.25)', paddingLeft: 4 }}>
                  <div className="bars" style={{ height: 218 }}>
                    {trend.map((t, i) => (
                      <div key={i} className="bar">
                        <div style={{ height: `${(t.gross / max) * 100}%`, opacity: 0.35 + (t.gross / max) * 0.65 }} title={`${t.date} — ₹${fmt(t.gross)}`} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, paddingLeft: 38 }}>
                <div style={{ flex: 1, display: 'flex' }} className="tiny muted">
                  {trend.map((t, i) => (
                    <span key={i} style={{ flex: 1, textAlign: 'center', overflow: 'visible', whiteSpace: 'nowrap', fontSize: 9 }}>
                      {i % labelEvery === 0 ? t.date.slice(5) : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="card" style={{ borderColor: 'rgba(255,107,94,.3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="display" style={{ fontWeight: 700, color: 'var(--red)' }}>Needs attention</div>
              <button
                className="dashed-box"
                style={{ borderColor: 'rgba(255,107,94,.4)', color: 'var(--red-soft)', background: 'none', textAlign: 'left', fontSize: 12 }}
                onClick={() => navigate('/events?tab=pending')}
              >
                ⚠ {data.pendingEvents} event{data.pendingEvents === 1 ? '' : 's'} awaiting approval →
              </button>
              <button
                className="dashed-box"
                style={{ background: 'none', textAlign: 'left', fontSize: 12 }}
                onClick={() => navigate('/bookings?status=refund_requested')}
              >
                ↩ {data.pendingRefunds} refund request{data.pendingRefunds === 1 ? '' : 's'} pending →
              </button>
              {data.liveNow > 0 && (
                <button
                  className="dashed-box"
                  style={{ borderColor: 'rgba(139,195,74,.5)', color: 'var(--green)', background: 'none', textAlign: 'left', fontSize: 12 }}
                  onClick={() => navigate('/events')}
                >
                  ● {data.liveNow} event{data.liveNow === 1 ? '' : 's'} live now →
                </button>
              )}
              <button
                className="dashed-box"
                style={{ background: 'none', textAlign: 'left', fontSize: 12 }}
                onClick={() => navigate('/organizers')}
              >
                🛡 {data.pendingKyc} organizer KYC to review →
              </button>
            </div>
          </div>

          <div className="two-col">
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                <span className="display" style={{ fontWeight: 700 }}>Top selling events</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['All', ...cities].map((c) => (
                    <button key={c} className={`chip ${topCity === c ? 'on' : ''}`} style={{ fontSize: 10.5, padding: '3px 10px' }} onClick={() => setTopCity(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              {data.topSellingEvents.length ? (
                <div className="stack" style={{ gap: 8 }}>
                  {(() => {
                    const maxSold = Math.max(...data.topSellingEvents.map((e) => e.sold), 1);
                    return data.topSellingEvents.map((e) => (
                      <div key={e.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/events/${e.id}`)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <b>{e.title}</b>
                          <span className="muted">{fmt(e.sold)} sold · {e.city}</span>
                        </div>
                        <div style={{ height: 8, background: 'rgba(139,195,74,.12)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
                          <div style={{ width: `${(e.sold / maxSold) * 100}%`, height: '100%', background: 'var(--green)', opacity: 0.5 + (e.sold / maxSold) * 0.5 }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <div className="muted small">No selling events in {topCity} yet.</div>
              )}
            </div>

            <div className="card">
              <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Ticket statistics</div>
              {(() => {
                const rows: [string, number, string][] = [
                  ['Sold', data.ticketStats.sold, 'var(--green)'],
                  ['Available', data.ticketStats.available, 'rgba(139,195,74,.35)'],
                  ['Checked in', data.ticketStats.checkedIn, '#8ab4f8'],
                  ['Refunded', data.ticketStats.refunded, 'var(--red)'],
                ];
                const maxV = Math.max(...rows.map((r) => r[1]), 1);
                const { sold, cap, checkedIn } = data.ticketStats;
                return (
                  <div className="stack" style={{ gap: 8 }}>
                    <div className="tiny muted">capacity {fmt(cap)}</div>
                    {rows.map(([label, v, color]) => (
                      <div key={label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span>{label}</span>
                          <b>{fmt(v)}</b>
                        </div>
                        <div style={{ height: 8, background: 'rgba(241,243,234,.06)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
                          <div style={{ width: `${(v / maxV) * 100}%`, height: '100%', background: color }} />
                        </div>
                      </div>
                    ))}
                    <div className="tiny hint">sell-through {cap ? Math.round((sold / cap) * 100) : 0}% · check-in rate {sold ? Math.round((checkedIn / sold) * 100) : 0}%</div>
                  </div>
                );
              })()}
            </div>
          </div>

          {data.topPromoters.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span className="display" style={{ fontWeight: 700 }}>🏆 Top promoters</span>
                <Link to="/promoters" className="small">All promoters →</Link>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                {data.topPromoters.map((p, i) => {
                  const maxE = data.topPromoters[0].earned;
                  return (
                    <div key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/promoters/${p.id}`)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <b>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {p.name}</b>
                        <span className="muted">₹{fmt(p.earned)} earned · {p.showRate}% show-rate</span>
                      </div>
                      <div style={{ height: 8, background: 'rgba(139,195,74,.12)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
                        <div style={{ width: `${(p.earned / maxE) * 100}%`, height: '100%', background: 'var(--green)', opacity: 0.5 + (p.earned / maxE) * 0.5 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="tblwrap">
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
              <span className="display" style={{ fontWeight: 700 }}>Live &amp; upcoming events</span>
              <Link to="/events" className="small">All events →</Link>
            </div>
            <div className="thead" style={{ minWidth: 560 }}>
              <span style={{ flex: 2 }}>Event</span>
              <span style={{ flex: 1 }}>Date</span>
              <span style={{ flex: 1 }}>Sold</span>
              <span style={{ flex: 1 }}>Revenue</span>
              <span style={{ flex: 1 }}>Status</span>
            </div>
            {data.liveAndUpcoming.length === 0 && <div className="trow muted">Nothing upcoming.</div>}
            {data.liveAndUpcoming.map((ev) => {
              const sm = STATUS_TAG[ev.status] ?? { label: ev.status, cls: '' };
              return (
                <div key={ev.id} className="trow clickable" style={{ minWidth: 560 }} onClick={() => navigate(`/events/${ev.id}`)}>
                  <span style={{ flex: 2, fontWeight: 700 }}>{ev.title}</span>
                  <span style={{ flex: 1 }} className="muted">{new Date(ev.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  <span style={{ flex: 1 }}>{fmt(ev.sold)}</span>
                  <span style={{ flex: 1 }}>₹{fmt(ev.revenue)}</span>
                  <span style={{ flex: 1 }}><Tag {...sm} /></span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
