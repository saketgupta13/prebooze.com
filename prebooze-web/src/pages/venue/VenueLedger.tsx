import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtMoney } from '../../data/mock';
import Loader from '../../components/Loader';
import { venuePartner, type VenueLedgerTx } from '../../api';
import { ApiError } from '../../api/client';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Ledger for this venue's own hosted events — GET /venue/hosting/ledger
 * (VenueService.myLedger), with a real self-service withdraw (POST
 * /venue/hosting/withdraw), same shape as organizer/Payouts.tsx+Withdraw.tsx.
 * Only ever has rows for events with hostedByVenue true; a normal
 * organizer-booked event at this venue never appears here, that revenue
 * still credits the organizer's own ledger untouched. */
export default function VenueLedger() {
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<VenueLedgerTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    venuePartner.myLedger()
      .then((r) => { setBalance(r.balance); setLedger(r.transactions); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load ledger'))
      .finally(() => setLoading(false));
  }, []);

  const exportCsv = () => {
    const csv = ['date,type,event,amount', ...ledger.map((t) => `${t.createdAt},${t.type},"${t.eventTitle ?? ''}",${t.amount}`)].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'hosting-ledger.csv';
    a.click();
  };

  if (loading) return <Loader />;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Hosting ledger</h1>
      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi" style={{ borderColor: 'rgba(155,225,61,.4)' }}>
          <div className="l">Balance from hosted events</div>
          <div className="v accent">{fmtMoney(balance)}</div>
          <Link to="/venue/hosting/ledger/withdraw" className="btn btn-pri btn-sm" style={{ marginTop: 10 }}>
            Withdraw now
          </Link>
        </div>
      </div>
      <div className="tiny muted" style={{ marginBottom: 14 }}>
        Only sales from events you host yourself land here — Prebooze only ever deducts its usual commission, any
        split with a collaborating organizer is settled directly between you two.
      </div>

      <div className="card tbl-wrap">
        <h3 style={{ marginBottom: 10 }}>Transaction history</h3>
        <table className="tbl">
          <thead>
            <tr><th>Date</th><th>Event</th><th>Amount</th><th>Type</th></tr>
          </thead>
          <tbody>
            {ledger.map((t) => (
              <tr key={t.id}>
                <td>{fmtDate(t.createdAt)}</td>
                <td className="bold">{t.eventTitle ?? '—'}</td>
                <td className={t.amount < 0 ? 'danger-text' : ''}>{t.amount < 0 ? '-' : ''}{fmtMoney(Math.abs(t.amount))}</td>
                <td>
                  {t.type === 'sale' && <span className="badge badge-ok">Sale</span>}
                  {t.type === 'refund' && <span className="badge badge-danger">Refund</span>}
                  {t.type === 'withdrawal' && <span className="badge badge-pending">Withdrawal</span>}
                </td>
              </tr>
            ))}
            {ledger.length === 0 && <tr><td colSpan={4} className="muted center">No transactions yet.</td></tr>}
          </tbody>
        </table>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={exportCsv} disabled={!ledger.length}>⬇ Download statement (CSV)</button>
      </div>
    </div>
  );
}
