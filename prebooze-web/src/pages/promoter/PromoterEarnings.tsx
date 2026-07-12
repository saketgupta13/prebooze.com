import { useApp } from '../../store/AppContext';
import { EVENTS, fmtMoney } from '../../data/mock';
import {
  COMMISSION_LABEL,
  PROMOTER_COMMISSION_RATE,
  commissionEarnings,
  perHeadEarnings,
} from '../../lib/promoterEarnings';

const MIN_WITHDRAW = 500;

/** What a promoter has earned — per-head payouts on verified arrivals + affiliate
 * commission on paid tickets sold through their link — and can withdraw. */
export default function PromoterEarnings() {
  const { user, myEvents, promoterGuests, bookings, promoterWithdrawals, promoterWithdraw, toast } = useApp();
  const mySlug = user?.promoterUsername ?? '';
  const allEvents = [...myEvents, ...EVENTS.filter((e) => !myEvents.some((m) => m.id === e.id))];

  // per-event breakdown
  const rows = allEvents
    .filter((e) => e.promoterConfig?.enabled && e.promoterConfig.allowedPromoters.includes(mySlug))
    .map((e) => {
      const cfg = e.promoterConfig!;
      const arrived = promoterGuests.filter((g) => g.eventId === e.id && g.promoterSlug === mySlug && g.arrived).length;
      const perHead = cfg.perHeadPayout ? arrived * cfg.perHeadAmount : 0;
      const sales = bookings.filter((b) => b.promoterRef === mySlug && b.eventId === e.id && b.status !== 'cancelled');
      const commission = sales.reduce((a, b) => a + Math.round(b.subtotal * PROMOTER_COMMISSION_RATE), 0);
      const tickets = sales.reduce((a, b) => a + b.qty, 0);
      return { e, cfg, arrived, perHead, commission, tickets, total: perHead + commission };
    })
    .filter((r) => r.total > 0 || r.arrived > 0 || r.tickets > 0);

  const perHeadTotal = perHeadEarnings(allEvents, promoterGuests, mySlug);
  const comm = commissionEarnings(bookings, mySlug);
  const grossEarned = perHeadTotal + comm.amount;
  const withdrawn = promoterWithdrawals.reduce((a, w) => a + w.amount, 0);
  const available = Math.max(0, grossEarned - withdrawn);

  const requestPayout = () => {
    if (available < MIN_WITHDRAW) {
      toast(`Minimum payout is ${fmtMoney(MIN_WITHDRAW)}`);
      return;
    }
    promoterWithdraw(available);
    toast(`Payout of ${fmtMoney(available)} requested ✓`);
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Earnings</h1>
      <p className="muted small" style={{ marginBottom: 18 }}>
        The <b>organizer</b> pays you directly (not Prebooze): a per-head payout on every guest who shows up, plus a{' '}
        {COMMISSION_LABEL} commission whenever a guest from your list arrives after the free cutoff and buys a ticket at
        the gate.
      </p>

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi">
          <div className="l">Per-head payouts</div>
          <div className="v">{fmtMoney(perHeadTotal)}</div>
        </div>
        <div className="kpi">
          <div className="l">Ticket commission</div>
          <div className="v">{fmtMoney(comm.amount)}<span className="muted small"> · {comm.tickets} sold</span></div>
        </div>
        <div className="kpi">
          <div className="l">Total earned</div>
          <div className="v accent">{fmtMoney(grossEarned)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="tiny muted-2">Available to withdraw</div>
            <div style={{ fontSize: 26, fontWeight: 800 }} className="accent">{fmtMoney(available)}</div>
            <div className="tiny muted-2">{fmtMoney(withdrawn)} withdrawn to date · min payout {fmtMoney(MIN_WITHDRAW)}</div>
          </div>
          <button className="btn btn-pri" disabled={available < MIN_WITHDRAW} onClick={requestPayout}>
            Request payout →
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 10 }}>By event</h3>
        {rows.length === 0 ? (
          <div className="muted small">No earnings yet — fill a list and get guests through the door, or share your ticket link.</div>
        ) : (
          rows.map((r) => (
            <div key={r.e.id} className="evrow">
              <div style={{ flex: 1.6, minWidth: 0 }}>
                <div className="bold small">{r.e.title}</div>
                <div className="tiny muted-2">
                  {r.arrived} arrival{r.arrived === 1 ? '' : 's'}
                  {r.cfg.perHeadPayout && ` × ₹${r.cfg.perHeadAmount}`}
                  {r.tickets > 0 && ` · ${r.tickets} ticket${r.tickets === 1 ? '' : 's'} sold`}
                </div>
              </div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                {r.perHead > 0 && <div className="tiny muted">per-head {fmtMoney(r.perHead)}</div>}
                {r.commission > 0 && <div className="tiny muted">commission {fmtMoney(r.commission)}</div>}
                <div className="bold accent">{fmtMoney(r.total)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {promoterWithdrawals.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Payout history</h3>
          {promoterWithdrawals.map((w) => (
            <div key={w.id} className="evrow">
              <span className="small" style={{ flex: 1 }}>{w.date}</span>
              <span className="bold small" style={{ flex: 1, textAlign: 'right' }}>{fmtMoney(w.amount)}</span>
              <span style={{ flex: 0.8, textAlign: 'right' }}>
                <span className={`badge ${w.status === 'paid' ? 'badge-ok' : 'badge-pending'}`}>{w.status}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="tiny muted-2" style={{ marginTop: 14 }}>
        🔒 payouts are simulated for now · you're paid by the <b>organizer</b> running each event — Prebooze doesn't fund
        promoter payouts · per-head amounts and commission are set per event by the organizer
      </div>
    </div>
  );
}
