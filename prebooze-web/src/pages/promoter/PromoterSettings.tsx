import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { CITIES } from '../../data/mock';
import ChangePhoneNumber from '../../components/ChangePhoneNumber';

export default function PromoterSettings() {
  const { user, updateUser, toast } = useApp();
  const [brand, setBrand] = useState(user?.promoterBrand ?? '');
  const [username, setUsername] = useState(user?.promoterUsername ?? '');
  const [city, setCity] = useState(user?.city ?? 'Austin');

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Profile &amp; settings</h1>
      <div style={{ maxWidth: 520, marginBottom: 16 }}>
        <ChangePhoneNumber />
      </div>
      <div className="card" style={{ maxWidth: 520, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Promoter profile</h3>
        <div className="form-row">
          <div className="field">
            <span>Brand name</span>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div className="field">
            <span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <span>City</span>
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-pri"
          onClick={() => {
            updateUser({ promoterBrand: brand.trim(), promoterUsername: username.trim(), city });
            toast('Profile saved ✓');
          }}
        >
          Save changes
        </button>
      </div>

      <div className="card" style={{ maxWidth: 520, borderColor: 'rgba(255,92,73,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="bold small danger-text">Stop promoting</div>
            <div className="tiny muted">deactivate your promoter account — your public profile is hidden</div>
          </div>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm('Deactivate your promoter account? You can re-onboard anytime.'))
                updateUser({ isPromoter: false });
            }}
          >
            Deactivate
          </button>
        </div>
      </div>

      <div className="tiny muted-2" style={{ marginTop: 14 }}>
        Public profile: <Link to={`/promoter/${user?.promoterUsername ?? 'nova-nights'}`} className="link">/promoter/{user?.promoterUsername ?? 'nova-nights'}</Link>
      </div>
    </div>
  );
}
