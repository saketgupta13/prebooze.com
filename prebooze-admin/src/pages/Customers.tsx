import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { CUSTOMER_STATUS, Drawer, SearchBox, Tag } from '../components/ui';

export default function Customers() {
  const { customers, toggleBlockCustomer, toast } = useAdmin();
  const [segment, setSegment] = useState<'guests' | 'organizers'>('guests');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useMemo(() => {
    let l = customers.filter((c) => c.segment === segment);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((c) => c.name.toLowerCase().includes(q));
    }
    return l;
  }, [customers, segment, query]);

  const selected = customers.find((c) => c.id === selectedId);

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <div className="page-hd">
        <h1 className="page-title">Customers</h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className={`chip ${segment === 'guests' ? 'on' : ''}`} onClick={() => setSegment('guests')}>Guests</button>
          <button className={`chip ${segment === 'organizers' ? 'on' : ''}`} onClick={() => setSegment('organizers')}>Organizers</button>
          <Link to="/customers/new" className="btn btn-pri btn-sm">+ Add customer</Link>
        </div>
      </div>

      <SearchBox value={query} onChange={setQuery} placeholder="name / phone / email…" style={{ maxWidth: 340 }} />

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
          <div key={c.id} className="trow clickable" style={{ minWidth: 560 }} onClick={() => setSelectedId(c.id)}>
            <span style={{ flex: 1.8, fontWeight: 700 }}>{c.name} {c.verified && '✓'}</span>
            <span style={{ flex: 0.8 }} className="muted">{c.gender}</span>
            <span style={{ flex: 1 }} className="muted">{c.city}</span>
            <span style={{ flex: 1 }}>{c.bookings}</span>
            <span style={{ flex: 1 }}>₹{fmt(c.spend)}</span>
            <span style={{ flex: 1 }}><Tag {...CUSTOMER_STATUS[c.status]} /></span>
          </div>
        ))}
        {list.length === 0 && <div className="trow muted">No customers match.</div>}
      </div>
      <div className="tiny hint">Click a row for the profile drawer: verification, booking history, WhatsApp, block.</div>

      {selected && (
        <Drawer onClose={() => setSelectedId(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b className="display" style={{ fontSize: 15 }}>{selected.name} {selected.verified && '✓'}</b>
            <span onClick={() => setSelectedId(null)} style={{ cursor: 'pointer', color: 'var(--muted)' }}>✕</span>
          </div>
          <div className="small muted">
            {selected.city} · {selected.gender} · {CUSTOMER_STATUS[selected.status].label}
          </div>
          <hr />
          <div style={{ display: 'flex', gap: 6, textAlign: 'center' }}>
            <div style={{ flex: 1, border: '1px solid rgba(139,195,74,.25)', borderRadius: 8, padding: 8 }}>
              <b>{selected.bookings}</b>
              <br />
              <span className="tiny muted">bookings</span>
            </div>
            <div style={{ flex: 1, border: '1px solid rgba(139,195,74,.25)', borderRadius: 8, padding: 8 }}>
              <b>₹{fmt(selected.spend)}</b>
              <br />
              <span className="tiny muted">spend</span>
            </div>
          </div>
          <div className="small" style={{ fontWeight: 700 }}>Recent</div>
          <div className="small muted">
            🎟 Indie Night Live · 24 Jul
            <br />
            🎟 Summer Fest '26 · 1 Aug
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => toast('Opening WhatsApp chat…')}>💬 WhatsApp</button>
            <button className="btn btn-ghost btn-sm" onClick={() => toast('Filtered bookings by customer')}>View bookings</button>
          </div>
          <button className="btn btn-danger" onClick={() => toggleBlockCustomer(selected.id)}>
            {selected.status === 'blocked' ? 'Unblock customer' : 'Block customer'}
          </button>
        </Drawer>
      )}
    </div>
  );
}
