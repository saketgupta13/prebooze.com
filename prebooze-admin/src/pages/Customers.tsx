import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CUSTOMER_STATUS, SearchBox, Tag } from '../components/ui';
import { liveCustomers, LiveApiError, type LiveCustomer } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Customers';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

/** Real customer directory — guests only. Organizer/venue/lineup/promoter
 * accounts already have their own dedicated admin sections (Organizers,
 * Venues, Lineups, Promoters) with the role-specific fields this table
 * never showed anyway (brand, verification, payouts, etc.) — listing them
 * here too just mixed two different account types into one table with
 * neither's real detail. Segment filtering narrowed to server-side
 * 'guests' only, not a client-side tab choice. */
export default function Customers() {
  const session = useLiveSession();
  const { token } = session;
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<LiveCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [query, setQuery] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveCustomers
      .list('guests')
      .then(setCustomers)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const list = useMemo(() => {
    let l = customers;
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return l;
  }, [customers, query]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Customers</h1>
        <Link to="/customers/new" className="btn btn-pri btn-sm">+ Add customer</Link>
      </div>

      <SearchBox value={query} onChange={setQuery} placeholder="name / phone…" style={{ maxWidth: 340 }} />

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 560 }}>
          <span style={{ flex: 1.8 }}>Guest</span>
          <span style={{ flex: 0.8 }}>Gender</span>
          <span style={{ flex: 1 }}>City</span>
          <span style={{ flex: 1 }}>Bookings</span>
          <span style={{ flex: 1 }}>Spend</span>
          <span style={{ flex: 1 }}>Status</span>
        </div>
        {list.map((c) => (
          <div key={c.id} className="trow clickable" style={{ minWidth: 560 }} onClick={() => navigate(`/customers/${c.id}`)}>
            <span style={{ flex: 1.8, fontWeight: 700 }}>{c.name} {c.verified && '✓'}</span>
            <span style={{ flex: 0.8 }} className="muted">{c.gender || '—'}</span>
            <span style={{ flex: 1 }} className="muted">{c.city || '—'}</span>
            <span style={{ flex: 1 }}>{c.bookings}</span>
            <span style={{ flex: 1 }}>₹{fmt(c.spend)}</span>
            <span style={{ flex: 1 }}><Tag {...CUSTOMER_STATUS[c.status]} /></span>
          </div>
        ))}
        {list.length === 0 && !loading && <div className="trow muted">No customers match.</div>}
      </div>
      <div className="tiny hint">Click a row for the full profile: verification, booking history, WhatsApp, block.</div>
    </div>
  );
}
