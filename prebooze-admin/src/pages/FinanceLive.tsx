import { useEffect, useState } from 'react';
import { liveFinance, livePayments, liveLedger, LiveApiError, type LiveFinance, type LivePayoutRow, type LiveLedgerEntry } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Finance (live)';
const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'payouts', label: 'Payouts due' },
  { key: 'ledger', label: 'Ledger' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/** Real platform P&L (reports.finance), real per-event payout batch run
 * (payments.due/run-batch — genuinely flips paidOut + a real UTR), and the
 * real manual income/expense ledger. Three real backend slices that share
 * one "money" page rather than three separate near-empty ones. */
export default function FinanceLive() {
  const session = useLiveSession();
  const { token } = session;
  const [tab, setTab] = useState<TabKey>('overview');

  const [finance, setFinance] = useState<LiveFinance | null>(null);
  const [payouts, setPayouts] = useState<{ rows: LivePayoutRow[]; collected: number; commissionKept: number; gstCollected: number; dueTotal: number } | null>(null);
  const [ledger, setLedger] = useState<{ entries: LiveLedgerEntry[]; totalIncome: number; totalExpense: number; net: number } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [entryKind, setEntryKind] = useState<'income' | 'expense'>('expense');
  const [entryCategory, setEntryCategory] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveFinance.get(), livePayments.due(), liveLedger.list()])
      .then(([f, p, l]) => {
        setFinance(f);
        setPayouts(p);
        setLedger(l);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const runBatch = async () => {
    if (!selected.length) return;
    try {
      await livePayments.runBatch(selected);
      setSelected([]);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to run payout batch');
    }
  };

  const addEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(entryAmount.replace(/\D/g, ''), 10);
    if (!entryCategory.trim() || Number.isNaN(amount) || amount <= 0) {
      setErr('Category and a positive amount are required');
      return;
    }
    try {
      await liveLedger.addEntry({ kind: entryKind, category: entryCategory.trim(), amount, note: entryNote.trim() || undefined });
      setEntryCategory('');
      setEntryAmount('');
      setEntryNote('');
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to add entry');
    }
  };

  const removeEntry = async (id: string) => {
    try {
      await liveLedger.removeEntry(id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to remove — auto-posted entries can\'t be deleted');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && finance && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {([
            ['Commission income', finance.commissionIncome],
            ['Fee income', finance.feeIncome],
            ['Other income', finance.otherIncome],
            ['Total expenses', finance.totalExpenses],
            ['GST payable', finance.gstPayable],
            ['Net profit', finance.netProfit],
            ['Cash', finance.cash],
            ['Refunds pending', finance.refundsPending],
          ] as [string, number][]).map(([label, val]) => (
            <div key={label} className="card" style={{ minWidth: 150, flex: 1 }}>
              <div className="tiny muted">{label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{fmtMoney(val)}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'payouts' && payouts && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="card" style={{ minWidth: 150, flex: 1 }}><div className="tiny muted">Collected</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmtMoney(payouts.collected)}</div></div>
            <div className="card" style={{ minWidth: 150, flex: 1 }}><div className="tiny muted">Commission kept</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmtMoney(payouts.commissionKept)}</div></div>
            <div className="card" style={{ minWidth: 150, flex: 1 }}><div className="tiny muted">Due total</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmtMoney(payouts.dueTotal)}</div></div>
          </div>
          <button className="btn btn-pri" disabled={!selected.length} onClick={runBatch} style={{ alignSelf: 'flex-start' }}>
            Run payout batch ({selected.length} selected)
          </button>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 600 }}>
              <span style={{ width: 24 }} />
              <span style={{ flex: 2 }}>Event / organizer</span>
              <span style={{ flex: 1 }}>Net</span>
              <span style={{ flex: 0.9 }}>Status</span>
            </div>
            {payouts.rows.map((r) => (
              <div key={r.id} className="trow" style={{ minWidth: 600 }}>
                <span style={{ width: 24 }}>
                  {!r.paidOut && (
                    <input
                      type="checkbox"
                      checked={selected.includes(r.id)}
                      onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id)))}
                    />
                  )}
                </span>
                <span style={{ flex: 2 }}>
                  <div style={{ fontWeight: 700 }}>{r.title}</div>
                  <div className="tiny muted">{r.organizer}</div>
                </span>
                <span style={{ flex: 1 }}>{fmtMoney(r.net)}</span>
                <span style={{ flex: 0.9 }}>
                  <span className={`tag ${r.paidOut ? 'tag-green' : ''}`}>{r.paidOut ? `paid · ${r.payoutUtr}` : 'due'}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'ledger' && ledger && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="card" style={{ minWidth: 150, flex: 1 }}><div className="tiny muted">Total income</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmtMoney(ledger.totalIncome)}</div></div>
            <div className="card" style={{ minWidth: 150, flex: 1 }}><div className="tiny muted">Total expense</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmtMoney(ledger.totalExpense)}</div></div>
            <div className="card" style={{ minWidth: 150, flex: 1 }}><div className="tiny muted">Net</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmtMoney(ledger.net)}</div></div>
          </div>
          <form className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={addEntry}>
            <div className="field" style={{ width: 110 }}>
              <label>Kind</label>
              <select className="input" value={entryKind} onChange={(e) => setEntryKind(e.target.value as 'income' | 'expense')}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label>Category</label>
              <input className="input" value={entryCategory} onChange={(e) => setEntryCategory(e.target.value)} placeholder="e.g. AWS hosting" />
            </div>
            <div className="field" style={{ width: 120 }}>
              <label>Amount ₹</label>
              <input className="input" inputMode="numeric" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label>Note (optional)</label>
              <input className="input" value={entryNote} onChange={(e) => setEntryNote(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-pri">+ Add</button>
          </form>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 600 }}>
              <span style={{ flex: 0.7 }}>Kind</span>
              <span style={{ flex: 1.4 }}>Category / note</span>
              <span style={{ flex: 1 }}>Amount</span>
              <span style={{ flex: 0.7 }} />
            </div>
            {ledger.entries.length === 0 && <div className="trow muted">No entries yet.</div>}
            {ledger.entries.map((e) => (
              <div key={e.id} className="trow" style={{ minWidth: 600 }}>
                <span style={{ flex: 0.7 }}><span className={`tag ${e.kind === 'income' ? 'tag-green' : 'tag-red'}`}>{e.kind}</span></span>
                <span style={{ flex: 1.4 }}>
                  <div style={{ fontWeight: 700 }}>{e.category}{e.auto ? ' · auto' : ''}</div>
                  {e.note && <div className="tiny muted">{e.note}</div>}
                </span>
                <span style={{ flex: 1 }}>{fmtMoney(e.amount)}</span>
                <span style={{ flex: 0.7 }}>
                  {!e.auto && <button className="btn btn-ghost btn-sm" onClick={() => removeEntry(e.id)}>Remove</button>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
