import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { Tag } from '../components/ui';
import { clearLiveToken, liveMe, liveNotifications, liveSettings, LiveApiError, type LiveNotification } from '../lib/liveApi';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function Profile() {
  const { session, updateSession, logout, toast } = useAdmin();
  const navigate = useNavigate();
  const [name, setName] = useState(session?.name ?? 'Admin');
  const [email, setEmail] = useState(session?.email ?? '');
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwErr, setPwErr] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [require2fa, setRequire2fa] = useState(false);
  const [savingTwoFa, setSavingTwoFa] = useState(false);
  const [activity, setActivity] = useState<LiveNotification[]>([]);

  useEffect(() => {
    liveSettings.get().then((s) => setRequire2fa(s.require2fa)).catch(() => {});
    liveNotifications.list().then((rows) => setActivity(rows.slice(0, 6))).catch(() => {});
  }, []);

  if (!session) return null;

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast('Name and email are required');
      return;
    }
    updateSession({ name: name.trim(), email: email.trim() });
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErr('');
    if (!curPw || !newPw) {
      setPwErr('Fill in both password fields');
      return;
    }
    if (newPw.length < 8) {
      setPwErr('New password must be at least 8 characters');
      return;
    }
    setSavingPw(true);
    try {
      await liveMe.changePassword(curPw, newPw);
      setCurPw('');
      setNewPw('');
      toast('Password changed ✓');
    } catch (e2) {
      setPwErr(e2 instanceof LiveApiError ? e2.message : 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  };

  const toggleRequire2fa = async () => {
    const next = !require2fa;
    setSavingTwoFa(true);
    try {
      await liveSettings.update({ require2fa: next });
      setRequire2fa(next);
      toast(next ? '2FA required for team sign-in ✓' : '2FA no longer required for team sign-in');
    } catch (e) {
      toast(e instanceof LiveApiError ? e.message : 'Failed to update 2FA setting');
    } finally {
      setSavingTwoFa(false);
    }
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
          Role: {session.role === 'staff' ? 'Staff — scoped by permission matrix' : 'Admin — full control-center access'}
        </div>
        <button type="submit" className="btn btn-pri btn-sm" style={{ alignSelf: 'flex-start' }}>Save profile</button>
      </form>

      <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={changePassword}>
        <div className="display" style={{ fontWeight: 700 }}>Security</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Current password</label>
            <input className="input" type={showPw ? 'text' : 'password'} value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>New password (min 8 chars)</label>
            <input className="input" type={showPw ? 'text' : 'password'} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="••••••••" />
          </div>
        </div>
        <label className="tiny muted" style={{ display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content', cursor: 'pointer' }}>
          <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} style={{ accentColor: 'var(--green)' }} />
          Show passwords
        </label>
        {pwErr && <div className="tiny" style={{ color: 'var(--red)' }}>{pwErr}</div>}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-ghost btn-sm" disabled={savingPw}>
            {savingPw ? 'Changing…' : 'Change password'}
          </button>
          <label className="tiny muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={require2fa}
              disabled={savingTwoFa}
              onChange={toggleRequire2fa}
              style={{ accentColor: 'var(--green)' }}
            />
            Require 2FA for team sign-in
          </label>
        </div>
        <div className="tiny hint">
          This applies to every staff sign-in, not just yours — same setting as Settings → Security.
        </div>
      </form>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="display" style={{ fontWeight: 700 }}>Recent activity</div>
        {activity.length === 0 && <div className="tiny muted">Nothing yet.</div>}
        {activity.map((a) => (
          <div key={a.id} className="tiny" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderBottom: '1px solid rgba(139,195,74,.08)', paddingBottom: 6 }}>
            <span>{a.icon} {a.text}</span>
            <span className="muted" style={{ flex: 'none' }}>{timeAgo(a.createdAt)}</span>
          </div>
        ))}
        <div className="tiny hint">team-wide activity, not just yours — same feed as the notifications bell.</div>
      </div>

      <button
        className="btn btn-danger"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => {
          clearLiveToken();
          logout();
          navigate('/login');
        }}
      >
        Log out of admin panel
      </button>
    </div>
  );
}
