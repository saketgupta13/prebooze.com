import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { Tag } from '../components/ui';

export default function Profile() {
  const { session, updateSession, settings, updateSettings, logout, toast } = useAdmin();
  const navigate = useNavigate();
  const [name, setName] = useState(session?.name ?? 'Admin');
  const [email, setEmail] = useState(session?.email ?? '');
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');

  if (!session) return null;

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast('Name and email are required');
      return;
    }
    updateSession({ name: name.trim(), email: email.trim() });
  };

  const changePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!curPw || !newPw) {
      toast('Fill in both password fields');
      return;
    }
    if (newPw.length < 8) {
      toast('New password must be at least 8 characters');
      return;
    }
    setCurPw('');
    setNewPw('');
    toast('Password changed ✓');
  };

  return (
    <div className="stack fade" style={{ maxWidth: 560, gap: 14 }}>
      <h1 className="page-title">My profile</h1>

      <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div className="avatar" style={{ width: 56, height: 56, fontSize: 24 }}>👤</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="display" style={{ fontSize: 16 }}>{session.name ?? 'Admin'}</div>
          <div className="small muted">{session.email}</div>
        </div>
        <Tag label={session.role === 'staff' ? 'STAFF' : 'ADMIN'} cls={session.role === 'staff' ? '' : 'tag-green'} />
      </div>

      <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={saveProfile}>
        <div className="display" style={{ fontWeight: 700 }}>Account details</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Display name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Email</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="kv-list tiny muted">
          Role: {session.role === 'staff' ? 'Staff — scoped by permission matrix' : 'Admin — full control-center access'} ·
          member since Jan '25 · last sign-in: just now
        </div>
        <button type="submit" className="btn btn-pri btn-sm" style={{ alignSelf: 'flex-start' }}>Save profile</button>
      </form>

      <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={changePassword}>
        <div className="display" style={{ fontWeight: 700 }}>Security</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Current password</label>
            <input className="input" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>New password (min 8 chars)</label>
            <input className="input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="••••••••" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button type="submit" className="btn btn-ghost btn-sm">Change password</button>
          <label className="tiny muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={settings.require2fa}
              onChange={() => updateSettings({ require2fa: !settings.require2fa })}
              style={{ accentColor: 'var(--green)' }}
            />
            Require 2FA on my sign-in
          </label>
        </div>
      </form>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="display" style={{ fontWeight: 700 }}>Recent activity</div>
        {[
          ['✓ Approved “Stand-up Sunday”', 'today'],
          ['💸 Ran payout batch — 2 transfers', 'today'],
          ['🏷 Created promo GIRLSNIGHT', 'yesterday'],
          ['🛡 Updated Finance role permissions', '2d ago'],
        ].map(([t, when]) => (
          <div key={t} className="tiny" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(139,195,74,.08)', paddingBottom: 6 }}>
            <span>{t}</span>
            <span className="muted">{when}</span>
          </div>
        ))}
      </div>

      <button
        className="btn btn-danger"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => {
          logout();
          navigate('/login');
        }}
      >
        Log out of admin panel
      </button>
    </div>
  );
}
