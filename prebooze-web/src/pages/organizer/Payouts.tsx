import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtMoney } from '../../data/mock';
import Loader from '../../components/Loader';
import { organizer, type OrgLedgerTx } from '../../api';
import { ApiError } from '../../api/client';
import type { Organizer } from '../../types';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Real payout ledger — GET /organizer/payouts + GET /organizer/me for the
 * bank-on-file display. Dropped from the old mock: a "Pending (settles
 * after event)" KPI and an auto-payout schedule claim, neither of which
 * exist in the real model (withdrawals are organizer-initiated, settled
 * manually by the team — see the memo on OrganizerService.withdraw); and the
 * whole "promoter payouts you owe" section, which had no real backend at
 * all (not a data-source gap — the capability itself doesn't exist yet). */
export default function Payouts() {
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<OrgLedgerTx[]>([]);
  const [org, setOrg] = useState<Organizer | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([organizer.payouts(), organizer.me()])
      .then(([p, o]) => { setBalance(p.balance); setLedger(p.ledger); setOrg(o); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load payouts'))
      .finally(() => setLoading(false));
  }, []);

  const lifetimePaidOut = ledger.filter((t) => t.type === 'withdrawal').reduce((a, t) => a + Math.abs(t.amount), 0);

  const exportCsv = () => {
    const csv = [
      'date,type,event,amount',
      ...ledger.map((t) => `${t.createdAt},${t.type},"${t.eventTitle ?? ''}",${t.amount}`),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'payouts.csv';
    a.click();
  };

  if (loading) return <Loader />;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Payouts</h1>
      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi" style={{ borderColor: 'rgba(155,225,61,.4)' }}>
          <div className="l">Available balance</div>
          <div className="v accent">{fmtMoney(balance)}</div>
          <Link to="/organizer/payouts/withdraw" className="btn btn-pri btn-sm" style={{ marginTop: 10 }}>
            Withdraw now
          </Link>
        </div>
        <div className="kpi">
          <div className="l">Lifetime paid out</div>
          <div className="v">{fmtMoney(lifetimePaidOut)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="small">
          Payout to <span className="bold">{org?.bankLast4 ? `•••• ${org.bankLast4}` : 'no bank on file'}</span>{' '}
          {org?.bankLast4 && <span className="verified">✓</span>}{' '}
          <span className="muted">· processed by our team after each withdrawal request</span>
        </span>
        <Link to="/organizer/settings" className="btn btn-ghost btn-sm">change</Link>
      </div>

      <div className="card tbl-wrap">
        <h3 style={{ marginBottom: 10 }}>Payout history</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Amount</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((t) => (
              <tr key={t.id}>
                <td>{fmtDate(t.createdAt)}</td>
                <td className="bold">{t.eventTitle ?? (t.type === 'withdrawal' ? 'Manual withdrawal' : '—')}</td>
                <td className={t.amount < 0 ? 'danger-text' : ''}>{t.amount < 0 ? '-' : ''}{fmtMoney(Math.abs(t.amount))}</td>
                <td>
                  {t.type === 'sale' && <span className="badge badge-ok">Sale</span>}
                  {t.type === 'refund' && <span className="badge badge-danger">Refund</span>}
                  {t.type === 'withdrawal' && <span className="badge badge-pending">Withdrawal</span>}
                </td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr><td colSpan={4} className="muted center">No transactions yet.</td></tr>
            )}
          </tbody>
        </table>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={exportCsv} disabled={!ledger.length}>
          ⬇ Download statement (CSV)
        </button>
      </div>
    </div>
  );
}
