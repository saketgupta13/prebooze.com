import { useEffect, useState } from 'react';
import { Kpi, Tag } from '../components/ui';
import { downloadCsv } from '../lib/csv';
import { liveFinance, liveLedger, LiveApiError, type LiveFinance, type LiveLedgerEntry } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Income & expenses';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

/** Real income & expenses ledger (LedgerService) — commission and booking
 * fees post automatically per real event sale; everything else is entered
 * manually. KPIs come from the same real P&L (ReportsService.finance) the
 * Reports page's Profit & loss chip already uses. */
export default function Finance() {
  const session = useLiveSession();
  const { token } = session;

  const [finance, setFinance] = useState<LiveFinance | null>(null);
  const [entries, setEntries] = useState<LiveLedgerEntry[]>([]);
  const [categories, setCategories] = useState<{ income: string[]; expense: string[] }>({ income: [], expense: [] });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [newCat, setNewCat] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveFinance.get(), liveLedger.list(), liveLedger.categories()])
      .then(([f, l, c]) => {
        setFinance(f);
        setEntries(l.entries);
        setCategories(c);
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

  const cats = categories[kind];
  const income = entries.filter((e) => e.kind === 'income').reduce((a, e) => a + e.amount, 0);
  const expenses = entries.filter((e) => e.kind === 'expense').reduce((a, e) => a + e.amount, 0);
  const autoCount = entries.filter((e) => e.auto).length;
  const list = filter === 'all' ? entries : entries.filter((e) => e.kind === filter);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['Date', 'Kind', 'Category', 'Amount (₹)', 'Note', 'Auto-posted'],
      ...list.map((e) => [e.createdAt.slice(0, 10), e.kind, e.category, e.amount, e.note ?? '', e.auto ? 'yes' : 'no']),
      [],
      ['Total income', '', '', income],
      ['Total expenses', '', '', expenses],
      ['Net profit', '', '', income - expenses],
    ];
    downloadCsv(`prebooze-ledger-${filter}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(amount.replace(/\D/g, ''), 10);
    if (!amt) {
      setErr('Enter an amount');
      return;
    }
    try {
      await liveLedger.addEntry({ kind, category: category || cats[0], amount: amt, note: note.trim() || undefined });
      setAmount('');
      setNote('');
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to add entry');
    }
  };

  const remove = async (id: string) => {
    try {
      await liveLedger.removeEntry(id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : "Failed to remove — auto-posted entries can't be deleted");
    }
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    try {
      await liveLedger.addCategory(kind, newCat.trim());
      setCategory(newCat.trim());
      setNewCat('');
      setShowNewCat(false);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to add category');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1000, gap: 14 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Income &amp; expenses</h1>
        <button className="btn btn-ghost btn-sm" onClick={exportCsv}>⬇ Export</button>
      </div>

      <div className="kpi-grid">
        <Kpi label="Total income" value={<span className="green">₹{fmt(income)}</span>} delta="commission + fees post automatically" deltaColor="var(--muted)" />
        <Kpi label="Total expenses" value={<span className="red">₹{fmt(expenses)}</span>} />
        <Kpi label="Net profit" value={`₹${fmt(income - expenses)}`} delta={`${income > 0 ? Math.round(((income - expenses) / income) * 100) : 0}% margin`} deltaColor={income - expenses >= 0 ? 'var(--green)' : 'var(--red)'} />
        <Kpi label="Auto-posted entries" value={autoCount} delta="from ticket sales" deltaColor="var(--muted)" />
      </div>

      {finance && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="card" style={{ minWidth: 130, flex: 1 }}><div className="tiny muted">Cash</div><div style={{ fontSize: 16, fontWeight: 800 }}>₹{fmt(finance.cash)}</div></div>
          <div className="card" style={{ minWidth: 130, flex: 1 }}><div className="tiny muted">Refunds pending</div><div style={{ fontSize: 16, fontWeight: 800 }}>₹{fmt(finance.refundsPending)}</div></div>
        </div>
      )}

      {/* Record entry */}
      <form className="card" style={{ border: '1px solid var(--green)', display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={submit}>
        <div className="display" style={{ fontWeight: 700 }}>Record {kind}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ width: 130 }}>
            <label>Type</label>
            <select
              className="input"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as 'income' | 'expense');
                setCategory('');
              }}
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 150 }}>
            <label>Category</label>
            <select className="input" value={category || cats[0] || ''} onChange={(e) => setCategory(e.target.value)}>
              {cats.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ width: 130 }}>
            <label>Amount ₹</label>
            <input className="input" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
          </div>
          <div className="field" style={{ flex: 1.4, minWidth: 160 }}>
            <label>Note (optional)</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="what was this for?" />
          </div>
          <button type="submit" className="btn btn-pri" style={{ height: 38 }}>Add ✓</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {!showNewCat ? (
            <button type="button" className="chip" onClick={() => setShowNewCat(true)}>+ new {kind} category</button>
          ) : (
            <>
              <input className="input" style={{ width: 190, padding: '5px 10px', fontSize: 12 }} value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={`New ${kind} category`} autoFocus />
              <button type="button" className="btn btn-pri btn-sm" onClick={addCategory}>
                Add
              </button>
            </>
          )}
          <span className="tiny hint">· “Ticket commission” and “Booking fees” income posts automatically per event and can't be edited</span>
        </div>
      </form>

      {/* Ledger */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['all', 'income', 'expense'] as const).map((f) => (
          <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? `All (${entries.length})` : f === 'income' ? `Income (${entries.filter((x) => x.kind === 'income').length})` : `Expenses (${entries.filter((x) => x.kind === 'expense').length})`}
          </button>
        ))}
      </div>
      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 620 }}>
          <span style={{ flex: 0.8 }}>Date</span>
          <span style={{ flex: 1 }}>Type</span>
          <span style={{ flex: 1.3 }}>Category</span>
          <span style={{ flex: 2 }}>Note</span>
          <span style={{ flex: 1 }}>Amount</span>
          <span style={{ width: 40 }} />
        </div>
        {list.map((e) => (
          <div key={e.id} className="trow" style={{ minWidth: 620 }}>
            <span style={{ flex: 0.8 }} className="muted">{new Date(e.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            <span style={{ flex: 1 }}>
              {e.kind === 'income' ? <Tag label={e.auto ? 'Income · auto' : 'Income'} cls="tag-green" /> : <Tag label="Expense" cls="tag-red" />}
            </span>
            <span style={{ flex: 1.3, fontWeight: 700 }}>{e.category}</span>
            <span style={{ flex: 2 }} className="muted">{e.note ?? '—'}</span>
            <span style={{ flex: 1, fontWeight: 700 }} className={e.kind === 'income' ? 'green' : 'red'}>
              {e.kind === 'income' ? '+' : '−'}₹{fmt(e.amount)}
            </span>
            <span style={{ width: 40, display: 'flex', justifyContent: 'flex-end' }}>
              {!e.auto && (
                <button className="btn btn-danger btn-sm" style={{ padding: '2px 7px' }} onClick={() => remove(e.id)} title="Remove entry">
                  ✕
                </button>
              )}
            </span>
          </div>
        ))}
        {list.length === 0 && !loading && <div className="trow muted">No entries yet.</div>}
      </div>
      <div className="tiny hint">this ledger feeds the Profit &amp; loss report and balance sheet under Reports</div>
    </div>
  );
}
