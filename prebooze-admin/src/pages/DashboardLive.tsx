import { useEffect, useState } from 'react';
import { liveDashboard, LiveApiError, type LiveDashboard } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Dashboard (live)';
const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card" style={{ minWidth: 140, flex: 1 }}>
      <div className="tiny muted">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

/** Real KPIs, computed live from the database every request — no hardcoded
 * display padding (the mock Dashboard.tsx added canned numbers to make an
 * empty dev dataset look populated; this doesn't, so small seed data will
 * legitimately look sparse — that's honest, not broken). */
export default function DashboardLive() {
  const session = useLiveSession();
  const { token } = session;

  const [data, setData] = useState<LiveDashboard | null>(null);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveDashboard
      .overview(days)
      .then(setData)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, days]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  return (
    <div className="stack fade" style={{ maxWidth: 1200 }}>
      <LiveHeaderBar title={TITLE} session={session} />

      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="tabs">
        {[7, 14, 30, 90].map((d) => (
          <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d}d</button>
        ))}
      </div>

      {data && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Stat label="Gross sales" value={fmtMoney(data.grossSales)} />
            <Stat label="Tickets sold" value={data.ticketsSold.toLocaleString('en-IN')} />
            <Stat label="Commission earned" value={fmtMoney(data.commissionEarned)} />
            <Stat label="Refunds" value={fmtMoney(data.refundsAmount)} />
            <Stat label="Live now" value={data.liveNow} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Stat label="Pending events" value={data.pendingEvents} />
            <Stat label="Pending refunds" value={data.pendingRefunds} />
            <Stat label="Pending KYC" value={data.pendingKyc} />
            <Stat label="Customers" value={data.totalCustomers} />
            <Stat label="Organizers (verified)" value={`${data.verifiedOrganizers}/${data.totalOrganizers}`} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Stat label="Total events" value={data.totalEvents} />
            <Stat label="Total bookings" value={data.totalBookings} />
            <Stat label="Tickets sold/cap" value={`${data.ticketStats.sold}/${data.ticketStats.cap}`} />
            <Stat label="Checked in" value={data.ticketStats.checkedIn} />
          </div>

          <div className="tblwrap">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)', fontWeight: 700 }}>
              Top selling events (last {days}d)
            </div>
            {data.topSellingEvents.length === 0 ? (
              <div className="trow muted">No sales in this window.</div>
            ) : (
              data.topSellingEvents.map((e) => (
                <div key={e.id} className="trow">
                  <span style={{ flex: 2, fontWeight: 700 }}>{e.title}</span>
                  <span style={{ flex: 1 }} className="muted">{e.city}</span>
                  <span style={{ flex: 0.6 }}>{e.sold} sold</span>
                </div>
              ))
            )}
          </div>

          <div className="tblwrap">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)', fontWeight: 700 }}>
              Top promoters
            </div>
            {data.topPromoters.length === 0 ? (
              <div className="trow muted">No promoter earnings yet.</div>
            ) : (
              data.topPromoters.map((p) => (
                <div key={p.id} className="trow">
                  <span style={{ flex: 2, fontWeight: 700 }}>{p.name}</span>
                  <span style={{ flex: 1 }} className="muted">show rate {p.showRate}%</span>
                  <span style={{ flex: 0.8 }}>{fmtMoney(p.earned)}</span>
                </div>
              ))
            )}
          </div>

          <div className="tblwrap">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)', fontWeight: 700 }}>
              Live &amp; upcoming
            </div>
            {data.liveAndUpcoming.length === 0 ? (
              <div className="trow muted">Nothing upcoming.</div>
            ) : (
              data.liveAndUpcoming.map((e) => (
                <div key={e.id} className="trow">
                  <span style={{ flex: 2, fontWeight: 700 }}>{e.title}</span>
                  <span style={{ flex: 1 }} className="muted">{new Date(e.date).toLocaleDateString('en-IN')} · {e.status}</span>
                  <span style={{ flex: 0.8 }}>{fmtMoney(e.revenue)} · {e.sold} sold</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
