import { useEffect, useState } from 'react';
import { liveCustomers, LiveApiError, type LiveCustomer } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Customers (live)';
const SEGMENTS: { key: 'all' | LiveCustomer['segment']; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'guests', label: 'Guests' },
  { key: 'organizers', label: 'Business accounts' },
];
const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Real customer directory — block/unblock actually flips User.blocked
 * (enforced at login/booking time server-side), and bookings/spend are real
 * aggregates, not mock numbers. Add-customer stays on the mock AddCustomer
 * page for now — same disclosed boundary as the other live pages. */
export default function CustomersLive() {
  const session = useLiveSession();
  const { token } = session;

  const [customers, setCustomers] = useState<LiveCustomer[]>([]);
  const [segment, setSegment] = useState<'all' | LiveCustomer['segment']>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveCustomers
      .list()
      .then(setCustomers)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const toggleBlocked = async (c: LiveCustomer) => {
    try {
      await liveCustomers.setBlocked(c.id, c.status !== 'blocked');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update');
    }
  };

  const list = customers
    .filter((c) => segment === 'all' || c.segment === segment)
    .filter((c) => !query.trim() || c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query));

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      <div className="tiny hint" style={{ marginTop: -6 }}>
        Real accounts, real booking counts/spend. Blocking here really prevents login/booking — see AuthService.
      </div>

      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" placeholder="Search name or phone…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <div className="tabs">
          {SEGMENTS.map((s) => (
            <button key={s.key} className={segment === s.key ? 'on' : ''} onClick={() => setSegment(s.key)}>
              {s.label} ({s.key === 'all' ? customers.length : customers.filter((c) => c.segment === s.key).length})
            </button>
          ))}
        </div>
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 680 }}>
          <span style={{ flex: 1.6 }}>Customer</span>
          <span style={{ flex: 1 }}>City</span>
          <span style={{ flex: 0.8 }}>Bookings</span>
          <span style={{ flex: 1 }}>Spend</span>
          <span style={{ flex: 0.9 }}>Status</span>
          <span style={{ flex: 0.9 }}>Action</span>
        </div>
        {list.length === 0 && <div className="trow muted">No customers match.</div>}
        {list.map((c) => (
          <div key={c.id} className="trow" style={{ minWidth: 680 }}>
            <span style={{ flex: 1.6 }}>
              <div style={{ fontWeight: 700 }}>{c.name}{c.verified ? ' ✓' : ''}</div>
              <div className="tiny muted">{c.phone}{c.email ? ` · ${c.email}` : ''}</div>
            </span>
            <span style={{ flex: 1 }} className="muted">{c.city || '—'}</span>
            <span style={{ flex: 0.8 }}>{c.bookings}</span>
            <span style={{ flex: 1 }}>{fmtMoney(c.spend)}</span>
            <span style={{ flex: 0.9 }}>
              <span className={`tag ${c.status === 'blocked' ? 'tag-red' : c.status === 'active' ? 'tag-green' : ''}`}>{c.status}</span>
            </span>
            <span style={{ flex: 0.9 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleBlocked(c)}>
                {c.status === 'blocked' ? 'Unblock' : 'Block'}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
