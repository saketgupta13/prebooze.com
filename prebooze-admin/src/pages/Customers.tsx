import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { enabledCityNames, fmt } from '../store/data';
import { CityFilterDropdown, CUSTOMER_STATUS, SearchBox, Tag } from '../components/ui';

export default function Customers() {
  const { customers, locations } = useAdmin();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cityF, setCityF] = useState('All');
  const cities = enabledCityNames(locations);

  const list = useMemo(() => {
    let l = customers;
    if (cityF !== 'All') l = l.filter((c) => c.city === cityF);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((c) => c.name.toLowerCase().includes(q));
    }
    return l;
  }, [customers, cityF, query]);

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <div className="page-hd">
        <h1 className="page-title">Customers</h1>
        <Link to="/customers/new" className="btn btn-pri btn-sm">+ Add customer</Link>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBox value={query} onChange={setQuery} placeholder="name / phone / email…" style={{ maxWidth: 340, flex: 1, minWidth: 180 }} />
        <CityFilterDropdown value={cityF} onChange={setCityF} cities={cities} />
      </div>

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
            <span style={{ flex: 0.8 }} className="muted">{c.gender}</span>
            <span style={{ flex: 1 }} className="muted">{c.city}</span>
            <span style={{ flex: 1 }}>{c.bookings}</span>
            <span style={{ flex: 1 }}>₹{fmt(c.spend)}</span>
            <span style={{ flex: 1 }}><Tag {...CUSTOMER_STATUS[c.status]} /></span>
          </div>
        ))}
        {list.length === 0 && <div className="trow muted">No customers match.</div>}
      </div>
      <div className="tiny hint">Click a row for the full profile: verification, booking history, WhatsApp, block.</div>
    </div>
  );
}
