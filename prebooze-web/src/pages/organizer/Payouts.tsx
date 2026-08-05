import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtMoney } from '../../data/mock';
import Loader from '../../components/Loader';
import { organizer, type OrgLedgerTx } from '../../api';
import { ApiError } from '../../api/client';
import type { Organizer } from '../../types';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

interface PromoterPayoutRow {
  eventId: string; eventTitle: string; eventDate: string; promoterId: string; promoterName: string;
  // perHead: guest-list headcount payout (event's perHeadPayout toggle).
  // commission: revenue-share % on paid ticket sales through their link
  // (event's per-promoter revenueShare %). Independent settings — either,
  // both, or neither can be nonzero for a given promoter on a given event.
  perHead: number; commission: number; total: number; status: 'pending' | 'reminder_sent' | 'received';
}
const STATUS_LABEL: Record<PromoterPayoutRow['status'], string> = {
  pending: 'Not paid yet', reminder_sent: 'Promoter sent a reminder', received: 'Promoter confirmed received ✓',
};

/** Real payout ledger — GET /organizer/payouts + GET /organizer/me for the
 * bank-on-file display, plus what's owed to promoters per event (GET
 * /organizer/promoter-payouts — per-head arrivals + revenue-share on paid
 * bookings, same numbers the promoter's own earnings page shows for
 * themselves). Real transfers to a promoter still happen entirely outside
 * Prebooze; the status here is the promoter's own attestation, not
 * something this page can mark — an organizer who's paid can only wait for
 * the promoter to confirm it or ask them directly. */
export default function Payouts() {
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<OrgLedgerTx[]>([]);
  const [org, setOrg] = useState<Organizer | null>(null);
  const [promoterPayouts, setPromoterPayouts] = useState<PromoterPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([organizer.payouts(), organizer.me(), organizer.promoterPayouts()])
      .then(([p, o, pp]) => { setBalance(p.balance); setLedger(p.ledger); setOrg(o); setPromoterPayouts(pp); })
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

      {promoterPayouts.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 4 }}>What you owe promoters</h3>
          <p className="tiny muted-2" style={{ marginBottom: 12 }}>
            Per-head payouts and revenue-share you set per event, per promoter. This is settled directly between you
            and each promoter — Prebooze doesn't move this money — the status is whatever the promoter has confirmed.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {promoterPayouts.map((r) => (
              <div key={`${r.eventId}-${r.promoterId}`} className="evrow">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small bold">{r.promoterName}</div>
                  <div className="tiny muted-2">{r.eventTitle} · {fmtDate(r.eventDate)}</div>
                  <div className="tiny muted-2" style={{ marginTop: 4 }}>
                    {r.perHead > 0 && <span>Guest list {fmtMoney(r.perHead)}</span>}
                    {r.perHead > 0 && r.commission > 0 && ' · '}
                    {r.commission > 0 && <span>Revenue share {fmtMoney(r.commission)}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="small bold">{fmtMoney(r.total)}</div>
                  <div className="tiny" style={{ color: r.status === 'received' ? 'var(--green, #2a9d5c)' : 'var(--muted-2)' }}>
                    {STATUS_LABEL[r.status]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
