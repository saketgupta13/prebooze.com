import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';

/** Edit an existing promoter's profile, plan and status. */
export default function PromoterEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { promoters, subTiers, updatePromoter, toast } = useAdmin();
  const p = promoters.find((x) => x.id === id);

  const [name, setName] = useState(p?.name ?? '');
  const [contact, setContact] = useState(p?.contact ?? '');
  const [city, setCity] = useState(p?.city ?? '');
  const [plan, setPlan] = useState(p?.plan ?? 'free');
  const [status, setStatus] = useState(p?.status ?? 'pending');
  const [kyc, setKyc] = useState(p?.kyc ?? 'pending');
  const [bio, setBio] = useState(p?.bio ?? '');

  if (!p) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Promoter not found</h1>
        <Link to="/promoters" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Promoters</Link>
      </div>
    );
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) {
      toast('Name and contact are required');
      return;
    }
    updatePromoter(p.id, {
      name: name.trim(),
      contact: contact.trim(),
      city: city.trim() || '—',
      plan,
      status,
      kyc,
      bio: bio.trim() || undefined,
    });
    navigate(`/promoters/${p.id}`);
  };

  return (
    <div className="stack fade" style={{ maxWidth: 560, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to={`/promoters/${p.id}`} style={{ fontSize: 13 }}>← {p.name}</Link>
        <h1 className="page-title">Edit promoter</h1>
      </div>

      <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={save}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Promoter / PR name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Contact email / phone</label>
            <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>City</label>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Subscription plan</label>
            <select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
              {subTiers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Account status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected / suspended</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>KYC state</label>
            <select className="input" value={kyc} onChange={(e) => setKyc(e.target.value)}>
              <option value="verified">Verified</option>
              <option value="submitted">Submitted</option>
              <option value="pending">Pending</option>
              <option value="flagged">Flagged</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Bio</label>
          <textarea className="input" style={{ minHeight: 56, resize: 'vertical' }} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to={`/promoters/${p.id}`} className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-pri" style={{ flex: 1, padding: 10 }}>Save changes</button>
        </div>
      </form>
    </div>
  );
}
