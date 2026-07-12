import { Link } from 'react-router-dom';
import { EVENTS, PAYOUTS, PROMOTERS, fmtMoney } from '../../data/mock';
import { PROMOTER_COMMISSION_RATE, COMMISSION_LABEL } from '../../lib/promoterEarnings';
import { useApp } from '../../store/AppContext';

export default function Payouts() {
  const { orgBalance, withdrawals, myEvents, promoterGuests, bookings, toast } = useApp();

  // What this organizer owes promoters — per-head on verified arrivals + gate
  // commission when a listed guest arrives late and buys a ticket. Organizer-funded.
  const orgEvents = [
    ...myEvents,
    ...EVENTS.filter((e) => e.organizerId === 'livewire' && !myEvents.some((m) => m.id === e.id)),
  ];
  const orgEventIds = new Set(orgEvents.map((e) => e.id));
  const promoterDues = PROMOTERS.map((pr) => {
    let perHead = 0;
    let commission = 0;
    orgEvents.forEach((e) => {
      const cfg = e.promoterConfig;
      if (!cfg?.enabled) return;
      if (cfg.perHeadPayout) {
        const arrived = promoterGuests.filter((g) => g.eventId === e.id && g.promoterSlug === pr.slug && g.arrived).length;
        perHead += arrived * cfg.perHeadAmount;
      }
    });
    bookings.forEach((b) => {
      if (b.promoterRef === pr.slug && orgEventIds.has(b.eventId) && b.status !== 'cancelled') {
        commission += Math.round(b.subtotal * PROMOTER_COMMISSION_RATE);
      }
    });
    return { pr, perHead, commission, total: perHead + commission };
  }).filter((d) => d.total > 0);
  const promoterTotal = promoterDues.reduce((a, d) => a + d.total, 0);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Payouts</h1>

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi" style={{ borderColor: 'rgba(155,225,61,.4)' }}>
          <div className="l">Available balance</div>
          <div className="v accent">{fmtMoney(orgBalance)}</div>
          <Link to="/organizer/payouts/withdraw" className="btn btn-pri btn-sm" style={{ marginTop: 10 }}>
            Withdraw now
          </Link>
        </div>
        <div className="kpi">
          <div className="l">Pending (settles after event)</div>
          <div className="v">₹31,750</div>
        </div>
        <div className="kpi">
          <div className="l">Lifetime paid out</div>
          <div className="v">₹4.2L</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="small">
          Payout to <span className="bold">HDFC •••• 8821</span> <span className="verified">✓</span>{' '}
          <span className="muted">· weekly auto-payout every Monday</span>
        </span>
        <button className="btn btn-ghost btn-sm">change</button>
      </div>

      <div className="card tbl-wrap">
        <h3 style={{ marginBottom: 10 }}>Payout history</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((w) => (
              <tr key={w.id}>
                <td>{w.date}</td>
                <td className="bold">Manual withdrawal</td>
                <td>{fmtMoney(w.amount)}</td>
                <td>
                  <span className="badge badge-pending">Processing ◌ · UTR pending</span>
                </td>
              </tr>
            ))}
            {PAYOUTS.map((p) => (
              <tr key={p.date + p.event}>
                <td>{p.date}</td>
                <td className="bold">{p.event}</td>
                <td>{fmtMoney(p.amount)}</td>
                <td>
                  {p.status === 'paid' ? (
                    <span className="badge badge-ok">Paid ✓</span>
                  ) : (
                    <span className="badge badge-pending">Processing ◌</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }}>
          ⬇ Download statements (CSV / PDF)
        </button>
      </div>

      {/* Promoter payouts — you pay your promoters directly */}
      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          <h3>Promoter payouts <span className="badge badge-accent">you pay these</span></h3>
          <span className="small muted">total owed <b className="accent">{fmtMoney(promoterTotal)}</b></span>
        </div>
        <p className="tiny muted-2" style={{ marginBottom: 12 }}>
          You pay your promoters directly — Prebooze doesn’t fund these. Per-head is owed on verified arrivals; a{' '}
          {COMMISSION_LABEL} gate commission is owed when a listed guest arrives after the free cutoff and buys a ticket.
        </p>
        {promoterDues.length === 0 ? (
          <div className="muted small">No promoter dues yet — enable a promoter guest list on an event and arrivals will show up here.</div>
        ) : (
          <>
            <div className="evrow" style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)' }}>
              <span style={{ flex: 1.6 }}>Promoter</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Per-head</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Gate commission</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Total owed</span>
              <span style={{ flex: 0.8 }} />
            </div>
            {promoterDues.map((d) => (
              <div key={d.pr.slug} className="evrow">
                <span style={{ flex: 1.6 }} className="bold small">📣 {d.pr.name}</span>
                <span style={{ flex: 1, textAlign: 'right' }} className="small">{fmtMoney(d.perHead)}</span>
                <span style={{ flex: 1, textAlign: 'right' }} className="small">{fmtMoney(d.commission)}</span>
                <span style={{ flex: 1, textAlign: 'right' }} className="bold accent">{fmtMoney(d.total)}</span>
                <span style={{ flex: 0.8, textAlign: 'right' }}>
                  <button className="btn btn-pri btn-sm" onClick={() => toast(`${fmtMoney(d.total)} paid to ${d.pr.name} ✓`)}>Pay</button>
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
