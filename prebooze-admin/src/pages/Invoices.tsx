import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CityFilterDropdown, Kpi, Tag } from '../components/ui';
import { liveInvoices, LiveApiError, type LiveInvoice } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Invoices';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const ROLE_LABEL: Record<string, string> = { guest: 'Guest', organizer: 'Organizer', promoter: 'Promoter', venue: 'Venue', lineup: 'Line-up' };

/** Every real payment received (booking) or billable request (featured
 * placement), from every role — real InvoicesService.list, server-side
 * filtered (role/city/type/date range) same as the mock's filter set. */
export default function Invoices() {
  const session = useLiveSession();
  const { token } = session;
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<LiveInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [role, setRole] = useState('All');
  const [city, setCity] = useState('All');
  const [type, setType] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query, setQuery] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveInvoices
      .list({
        role: role === 'All' ? undefined : role,
        type: type === 'All' ? undefined : type,
        from: from || undefined,
        to: to || undefined,
      })
      .then(setInvoices)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role, type, from, to]);

  const cities = useMemo(() => [...new Set(invoices.map((i) => i.city).filter((c): c is string => !!c))].sort(), [invoices]);

  const list = useMemo(() => {
    let l = invoices;
    if (city !== 'All') l = l.filter((i) => i.city === city);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      l = l.filter((i) => i.number.toLowerCase().includes(q) || i.payerName.toLowerCase().includes(q) || i.refId.toLowerCase().includes(q));
    }
    return l;
  }, [invoices, city, query]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const totalValue = list.filter((i) => i.status === 'issued').reduce((a, i) => a + i.total, 0);

  return (
    <div className="stack fade" style={{ maxWidth: 1200 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Invoices</h1>
        <span className="small muted">{invoices.length} total · auto-generated from real bookings &amp; featured requests</span>
      </div>

      <div className="kpi-grid">
        <Kpi label="Invoices (filtered)" value={fmt(list.length)} />
        <Kpi label="Total value" value={`₹${fmt(totalValue)}`} delta="issued only" deltaColor="var(--muted)" />
        <Kpi label="Voided" value={fmt(list.filter((i) => i.status === 'void').length)} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" style={{ flex: 1, minWidth: 180 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoice #, payer, booking/request id…" />
        <select className="input" style={{ width: 140 }} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="All">All roles</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <CityFilterDropdown value={city} onChange={setCity} cities={cities} />
        <select className="input" style={{ width: 130 }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="All">All types</option>
          <option value="booking">Booking</option>
          <option value="featured">Featured</option>
        </select>
        <input className="input" type="date" style={{ width: 140 }} value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
        <span className="tiny muted">–</span>
        <input className="input" type="date" style={{ width: 140 }} value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 900 }}>
          <span style={{ flex: 1.3 }}>Invoice #</span>
          <span style={{ flex: 1 }}>Type</span>
          <span style={{ flex: 1.4 }}>Payer</span>
          <span style={{ flex: 0.9 }}>Role</span>
          <span style={{ flex: 0.9 }}>City</span>
          <span style={{ flex: 0.9 }}>Date</span>
          <span style={{ flex: 1 }}>Total</span>
          <span style={{ flex: 0.8 }}>Status</span>
        </div>
        {list.map((inv) => (
          <div key={inv.id} className="trow clickable" style={{ minWidth: 900 }} onClick={() => navigate(`/invoices/${inv.id}`)}>
            <span style={{ flex: 1.3, fontWeight: 700 }}>{inv.number}</span>
            <span style={{ flex: 1 }} className="muted">{inv.type === 'booking' ? '🎟 Booking' : '⭐ Featured'}</span>
            <span style={{ flex: 1.4 }}>{inv.payerName}</span>
            <span style={{ flex: 0.9 }} className="muted">{ROLE_LABEL[inv.role] ?? inv.role}</span>
            <span style={{ flex: 0.9 }} className="muted">{inv.city ?? '—'}</span>
            <span style={{ flex: 0.9 }} className="muted tiny">{new Date(inv.issuedAt).toLocaleDateString('en-IN')}</span>
            <span style={{ flex: 1, fontWeight: 700 }}>₹{fmt(inv.total)}</span>
            <span style={{ flex: 0.8 }}>
              {inv.status === 'issued' ? <Tag label="Issued" cls="tag-green" /> : <Tag label="Void" cls="tag-dim" />}
            </span>
          </div>
        ))}
        {list.length === 0 && !loading && <div className="trow muted">No invoices match these filters.</div>}
      </div>
      <div className="tiny hint">click a row for the full invoice, download and resend options.</div>
    </div>
  );
}
