import { useMemo, useState } from 'react';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { Kpi, Tag } from '../components/ui';
import type { LedgerEntry } from '../types';
import { downloadCsv } from '../lib/csv';

/** Income & expenses ledger. Ticket commission (and booking fees) post automatically
 * from event sales; everything else is entered manually with its own category. */
export default function Finance() {
  const { events, settings, ledger, ledgerCategories, addLedgerEntry, removeLedgerEntry, addLedgerCategory, toast } = useAdmin();

  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [newCat, setNewCat] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  // Auto income — commission + booking fees from every selling event
  const autoRows = useMemo<LedgerEntry[]>(
    () =>
      events
        .filter((e) => e.status !== 'draft' && e.commission != null && e.revenue > 0)
        .flatMap((e) => [
          {
            id: 'auto-c-' + e.id,
            kind: 'income' as const,
            category: 'Ticket commission',
            amount: Math.round((e.revenue * (e.commission as number)) / 100),
            note: `${e.title} · ${e.commission}% of ₹${fmt(e.revenue)} — auto`,
            date: e.date,
            auto: true,
          },
          {
            id: 'auto-f-' + e.id,
            kind: 'income' as const,
            category: 'Booking fees',
            amount: e.sold * settings.bookingFee,
            note: `${e.title} · ${fmt(e.sold)} tickets × ₹${settings.bookingFee} — auto`,
            date: e.date,
            auto: true,
          },
        ]),
    [events, settings.bookingFee]
  );

  const all = useMemo(() => [...ledger, ...autoRows], [ledger, autoRows]);
  const income = all.filter((e) => e.kind === 'income').reduce((a, e) => a + e.amount, 0);
  const expenses = all.filter((e) => e.kind === 'expense').reduce((a, e) => a + e.amount, 0);
  const list = filter === 'all' ? all : all.filter((e) => e.kind === filter);

  const cats = ledgerCategories[kind];

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['Date', 'Kind', 'Category', 'Amount (₹)', 'Note', 'Auto-posted'],
      ...list.map((e) => [e.date, e.kind, e.category, e.amount, e.note ?? '', e.auto ? 'yes' : 'no']),
      [],
      ['Total income', '', '', income],
      ['Total expenses', '', '', expenses],
      ['Net profit', '', '', income - expenses],
    ];
    downloadCsv(`prebooze-ledger-${filter}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast('Ledger exported as CSV ✓');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(amount.replace(/\D/g, ''), 10);
    if (!amt) {
      toast('Enter an amount');
      return;
    }
    addLedgerEntry({
      id: 'l' + Date.now(),
      kind,
      category: category || cats[0],
      amount: amt,
      note: note.trim() || undefined,
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    });
    setAmount('');
    setNote('');
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1000, gap: 14 }}>
      <div className="page-hd">
        <h1 className="page-title">Income &amp; expenses</h1>
        <button className="btn btn-ghost btn-sm" onClick={exportCsv}>⬇ Export</button>
      </div>

      <div className="kpi-grid">
        <Kpi label="Total income" value={<span className="green">₹{fmt(income)}</span>} delta="commission + fees post automatically" deltaColor="var(--muted)" />
        <Kpi label="Total expenses" value={<span className="red">₹{fmt(expenses)}</span>} />
        <Kpi label="Net profit" value={`₹${fmt(income - expenses)}`} delta={`${income > 0 ? Math.round(((income - expenses) / income) * 100) : 0}% margin`} deltaColor={income - expenses >= 0 ? 'var(--green)' : 'var(--red)'} />
        <Kpi label="Auto-posted entries" value={autoRows.length} delta="from ticket sales" deltaColor="var(--muted)" />
      </div>

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
            <select className="input" value={category || cats[0]} onChange={(e) => setCategory(e.target.value)}>
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
              <button
                type="button"
                className="btn btn-pri btn-sm"
                onClick={() => {
                  if (!newCat.trim()) return;
                  addLedgerCategory(kind, newCat.trim());
                  setCategory(newCat.trim());
                  setNewCat('');
                  setShowNewCat(false);
                }}
              >
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
            {f === 'all' ? `All (${all.length})` : f === 'income' ? `Income (${all.filter((x) => x.kind === 'income').length})` : `Expenses (${all.filter((x) => x.kind === 'expense').length})`}
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
            <span style={{ flex: 0.8 }} className="muted">{e.date}</span>
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
                <button className="btn btn-danger btn-sm" style={{ padding: '2px 7px' }} onClick={() => removeLedgerEntry(e.id)} title="Remove entry">
                  ✕
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="tiny hint">this ledger feeds the Profit &amp; loss report and balance sheet under Reports</div>
    </div>
  );
}
