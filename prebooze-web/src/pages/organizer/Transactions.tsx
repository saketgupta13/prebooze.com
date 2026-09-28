import { Fragment, useEffect, useMemo, useState } from 'react';
import { fmtMoney } from '../../data/mock';
import Loader from '../../components/Loader';
import { organizer, type OrgLedgerTx } from '../../api';
import { ApiError } from '../../api/client';
import { X, Download, ChevronDown, ChevronRight } from 'lucide-react';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Sale/refund detail behind the balance — GET /organizer/payouts, same
 * source as Payouts.tsx, filtered to non-withdrawal rows. Withdrawals
 * themselves live on the Payouts page; this is purely the per-sale ledger,
 * with an event filter since a running organizer can have hundreds of rows
 * across many events. */
export default function Transactions() {
  const [ledger, setLedger] = useState<OrgLedgerTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [eventId, setEventId] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    organizer.payouts()
      .then((p) => setLedger(p.ledger.filter((t) => t.type !== 'withdrawal')))
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load transactions'))
      .finally(() => setLoading(false));
  }, []);

  const events = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of ledger) if (t.eventId && !seen.has(t.eventId)) seen.set(t.eventId, t.eventTitle ?? t.eventId);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [ledger]);

  const rows = eventId === 'all' ? ledger : ledger.filter((t) => t.eventId === eventId);

  const exportCsv = () => {
    const csv = ['date,type,event,amount', ...rows.map((t) => `${t.createdAt},${t.type},"${t.eventTitle ?? ''}",${t.amount}`)].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'transactions.csv';
    a.click();
  };

  if (loading) return <Loader />;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Transactions</h1>
      {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><X size={14} /> {err}</div>}
      <p className="tiny muted-2" style={{ marginBottom: 18 }}>
        Every sale and refund that builds your balance. Withdrawals are on the Payouts page.
      </p>

      <div className="card tbl-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <select style={{ maxWidth: 280 }} value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="all">All events ({ledger.length})</option>
            {events.map(([id, title]) => (
              <option key={id} value={id}>{title} ({ledger.filter((t) => t.eventId === id).length})</option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={exportCsv} disabled={!rows.length}>
            <Download size={14} /> Download (CSV)
          </button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th></th>
              <th>Date</th>
              <th>Event</th>
              <th>Amount</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const b = t.bookingBreakup;
              const isOpen = expanded.has(t.id);
              return (
                <Fragment key={t.id}>
                  <tr className={b ? 'clickable' : undefined} onClick={b ? () => toggleExpanded(t.id) : undefined}>
                    <td style={{ width: 24 }}>
                      {b && (isOpen ? <ChevronDown size={14} className="muted-2" /> : <ChevronRight size={14} className="muted-2" />)}
                    </td>
                    <td>{fmtDate(t.createdAt)}</td>
                    <td className="bold">{t.eventTitle ?? '—'}</td>
                    <td className={t.amount < 0 ? 'danger-text' : ''}>{t.amount < 0 ? '-' : ''}{fmtMoney(Math.abs(t.amount))}</td>
                    <td>
                      {t.type === 'sale' && <span className="badge badge-ok">Sale</span>}
                      {t.type === 'refund' && <span className="badge badge-danger">Refund</span>}
                    </td>
                  </tr>
                  {b && isOpen && (
                    <tr>
                      <td></td>
                      <td colSpan={4}>
                        <div className="tiny" style={{ display: 'grid', gap: 4, padding: '8px 0', maxWidth: 320 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="muted-2">Ticket subtotal</span><span>{fmtMoney(b.subtotal)}</span>
                          </div>
                          {b.includesFeeAndGst && (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="muted-2">Booking fee</span><span className="danger-text">−{fmtMoney(b.fee)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="muted-2">GST</span><span className="danger-text">−{fmtMoney(b.gstAmount)}</span>
                              </div>
                            </>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="muted-2">Prebooze commission</span><span className="danger-text">−{fmtMoney(b.commission)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 2, fontWeight: 700 }}>
                            <span>You get</span><span>{fmtMoney(Math.abs(t.amount))}</span>
                          </div>
                          {!b.includesFeeAndGst && (
                            <div className="muted-2" style={{ marginTop: 2 }}>Booking fee + GST were collected directly from the guest — they never touch your balance.</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="muted center">No transactions {eventId === 'all' ? 'yet' : 'for this event'}.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
