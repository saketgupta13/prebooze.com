import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtMoney } from '../../data/mock';
import Loader from '../../components/Loader';
import { organizer, type OrgLedgerTx } from '../../api';
import { ApiError } from '../../api/client';
import { X, Check, Download, BadgeCheck, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

interface PromoterPayoutRow {
  eventId: string; eventTitle: string; eventDate: string; promoterId: string; promoterName: string;
  // perHead: guest-list headcount payout (event's perHeadPayout toggle).
  // commission: revenue-share % on paid ticket sales through their link
  // (event's per-promoter revenueShare %). Independent settings — either,
  // both, or neither can be nonzero for a given promoter on a given event.
  perHead: number; commission: number; total: number; status: 'pending' | 'reminder_sent' | 'received';
}
const STATUS_LABEL: Record<PromoterPayoutRow['status'], ReactNode> = {
  pending: 'Not paid yet', reminder_sent: 'Promoter sent a reminder',
  received: <>Promoter confirmed received <Check size={11} /></>,
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
  const [defaultBankLast4, setDefaultBankLast4] = useState<string | null>(null);
  const [promoterPayouts, setPromoterPayouts] = useState<PromoterPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([organizer.payouts(), organizer.paymentProfiles(), organizer.promoterPayouts()])
      .then(([p, profiles, pp]) => {
        setBalance(p.balance); setLedger(p.ledger);
        setDefaultBankLast4(profiles.find((pr) => pr.isDefault)?.bankLast4 ?? null);
        setPromoterPayouts(pp);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load payouts'))
      .finally(() => setLoading(false));
  }, []);

  const [tab, setTab] = useState<'payouts' | 'transactions'>('payouts');
  const payoutRows = ledger.filter((t) => t.type === 'withdrawal');
  const transactionRows = ledger.filter((t) => t.type !== 'withdrawal');
  const lifetimePaidOut = payoutRows.reduce((a, t) => a + Math.abs(t.amount), 0);
  const rows = tab === 'payouts' ? payoutRows : transactionRows;

  const exportCsv = () => {
    const csv = [
      'date,type,event,amount',
      ...rows.map((t) => `${t.createdAt},${t.type},"${t.eventTitle ?? ''}",${t.amount}`),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = tab === 'payouts' ? 'payout-history.csv' : 'transactions.csv';
    a.click();
  };

  if (loading) return <Loader />;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Payouts</h1>
      {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><X size={14} /> {err}</div>}

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
          Payout to <span className="bold">{defaultBankLast4 ? `•••• ${defaultBankLast4}` : 'no bank on file'}</span>{' '}
          {defaultBankLast4 && <span className="verified" style={{ display: 'inline-flex', alignItems: 'center' }}><BadgeCheck size={13} /></span>}{' '}
          <span className="muted">· processed by our team after each withdrawal request</span>
        </span>
        <Link to="/organizer/settings/payment-profiles" className="btn btn-ghost btn-sm">change</Link>
      </div>

      {promoterPayouts.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ marginBottom: 4 }}>What you owe promoters</h3>
            <Link to="/organizer/promoters" className="link tiny" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Promoter profiles + bank details <ArrowRight size={12} /></Link>
          </div>
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
                  <div className="tiny" style={{ color: r.status === 'received' ? 'var(--green, #2a9d5c)' : 'var(--muted-2)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    {STATUS_LABEL[r.status]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card tbl-wrap">
        <div className="tabs" style={{ marginBottom: 10 }}>
          <button className={tab === 'payouts' ? 'on' : ''} onClick={() => setTab('payouts')}>Payout history ({payoutRows.length})</button>
          <button className={tab === 'transactions' ? 'on' : ''} onClick={() => setTab('transactions')}>Transactions ({transactionRows.length})</button>
        </div>
        {tab === 'transactions' && (
          <p className="tiny muted-2" style={{ marginBottom: 12 }}>
            Every sale and refund that builds your balance. Withdrawals themselves are under Payout history.
          </p>
        )}
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
            {rows.map((t) => (
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
            {rows.length === 0 && (
              <tr><td colSpan={4} className="muted center">{tab === 'payouts' ? 'No withdrawals yet.' : 'No transactions yet.'}</td></tr>
            )}
          </tbody>
        </table>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={exportCsv} disabled={!rows.length}>
          <Download size={14} /> Download {tab === 'payouts' ? 'payout history' : 'transactions'} (CSV)
        </button>
      </div>
    </div>
  );
}
