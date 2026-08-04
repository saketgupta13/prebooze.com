import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtMoney } from '../../data/mock';
import { promoter as promoterApi, type PromoterWithdrawal } from '../../api';
import { ApiError } from '../../api/client';
import Loader from '../../components/Loader';

const MIN_WITHDRAW = 500;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** What a promoter has earned — per-head payouts on verified arrivals + affiliate
 * commission on paid tickets sold through their link — and can withdraw.
 * GET /promoter/earnings computes both live off PromoterGuest/Booking, not a
 * stored ledger; per-event granularity lives on the "My promotions" page
 * instead of being reconstructed here, since there's no per-event earnings
 * endpoint (only per-event guest counts) and faking a split isn't worth it. */
export default function PromoterEarnings() {
  const [earnings, setEarnings] = useState({ perHead: 0, commission: 0, withdrawn: 0 });
  const [withdrawals, setWithdrawals] = useState<PromoterWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([promoterApi.earnings(), promoterApi.withdrawals()])
      .then(([e, w]) => { setEarnings(e); setWithdrawals(w); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load earnings'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <Loader />;

  const grossEarned = earnings.perHead + earnings.commission;
  const available = Math.max(0, grossEarned - earnings.withdrawn);

  const requestPayout = async () => {
    if (available < MIN_WITHDRAW) {
      setMsg(`Minimum payout is ${fmtMoney(MIN_WITHDRAW)}`);
      return;
    }
    setErr('');
    setMsg('');
    setRequesting(true);
    try {
      await promoterApi.withdraw(available);
      setMsg(`Payout of ${fmtMoney(available)} requested ✓`);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to request payout');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Earnings</h1>
      <p className="muted small" style={{ marginBottom: 18 }}>
        The <b>organizer</b> pays you directly (not Prebooze): a per-head payout on every guest who shows up, plus an
        8% commission whenever a guest from your list arrives after the free cutoff and buys a ticket at the gate.
      </p>

      {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi">
          <div className="l">Per-head payouts</div>
          <div className="v">{fmtMoney(earnings.perHead)}</div>
        </div>
        <div className="kpi">
          <div className="l">Ticket commission</div>
          <div className="v">{fmtMoney(earnings.commission)}</div>
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
            <div className="tiny muted-2">{fmtMoney(earnings.withdrawn)} withdrawn to date · min payout {fmtMoney(MIN_WITHDRAW)}</div>
            {msg && <div className="tiny" style={{ marginTop: 4 }}>{msg}</div>}
          </div>
          <button className="btn btn-pri" disabled={available < MIN_WITHDRAW || requesting} onClick={requestPayout}>
            {requesting ? 'Requesting…' : 'Request payout →'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3>Per-event breakdown</h3>
          <Link to="/promoter/promotions" className="btn btn-ghost btn-sm">My promotions →</Link>
        </div>
        <div className="muted small">
          See guests brought, arrivals, and per-event earnings for each event you're promoting under My promotions.
        </div>
      </div>

      {withdrawals.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Payout history</h3>
          {withdrawals.map((w) => (
            <div key={w.id} className="evrow">
              <span className="small" style={{ flex: 1 }}>{fmtDate(w.createdAt)}</span>
              <span className="bold small" style={{ flex: 1, textAlign: 'right' }}>{fmtMoney(w.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="tiny muted-2" style={{ marginTop: 14 }}>
        you're paid by the <b>organizer</b> running each event — Prebooze doesn't fund promoter payouts · per-head
        amounts and commission are set per event by the organizer
      </div>
    </div>
  );
}
