import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';

export default function Settings() {
  const { user, updateUser } = useApp();

  const rows: { title: string; desc: React.ReactNode; action: React.ReactNode }[] = [
    {
      title: 'Brand profile',
      desc: (
        <>
          {user?.orgBrand ?? 'Your brand'} · logo, bio, links — public page
        </>
      ),
      action: (
        <Link to="/organizer/onboarding" className="btn btn-ghost btn-sm">
          Edit
        </Link>
      ),
    },
    {
      title: 'KYC & bank',
      desc: (
        <>
          Aadhaar <span className="verified">✓</span> · PAN <span className="verified">✓</span> ·
          HDFC •••• 8821 <span className="verified">✓</span>
        </>
      ),
      action: <button className="btn btn-ghost btn-sm">Manage</button>,
    },
    {
      title: 'Team members',
      desc: '3 members · door-scan access for 2',
      action: <button className="btn btn-ghost btn-sm">Invite +</button>,
    },
    {
      title: 'Notifications',
      desc: (
        <>
          WhatsApp on <span className="verified">✓</span> · email digests weekly
        </>
      ),
      action: <button className="btn btn-ghost btn-sm">Edit</button>,
    },
    {
      title: 'Refund policy defaults',
      desc: 'free cancellation up to 48h before event',
      action: <button className="btn btn-ghost btn-sm">Edit</button>,
    },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Settings</h1>
      <div className="card">
        {rows.map((r) => (
          <div key={r.title} className="evrow">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bold small">{r.title}</div>
              <div className="tiny muted">{r.desc}</div>
            </div>
            {r.action}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 18, borderColor: 'rgba(255,92,73,.3)' }}>
        <div className="evrow" style={{ padding: 0 }}>
          <div style={{ flex: 1 }}>
            <div className="bold small danger-text">Deactivate organizer account</div>
            <div className="tiny muted">Your events are unpublished and payouts settle first.</div>
          </div>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm('Deactivate organizer account? You can re-onboard anytime.'))
                updateUser({ isOrganizer: false });
            }}
          >
            Deactivate
          </button>
        </div>
      </div>
    </div>
  );
}
