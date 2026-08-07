import { useEffect, useState } from 'react';
import { Tag } from '../components/ui';
import { liveStaff, liveRoles, PERM_MODULES, LiveApiError, type LiveStaff, type LiveRole, type PermKey } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Staff & roles';
const PERM_KEYS: PermKey[] = ['view', 'edit', 'approve'];
const LEAD_ROLE_OPTIONS = [
  { key: 'organizer', label: 'Organizer', emoji: '🎤' },
  { key: 'venue', label: 'Venue', emoji: '🏛' },
  { key: 'promoter', label: 'Promoter', emoji: '📣' },
  { key: 'lineup', label: 'Line-up', emoji: '🎧' },
];

const fmtLastActive = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'invited';

export default function StaffRoles() {
  const session = useLiveSession();
  const { token } = session;

  const [staff, setStaff] = useState<LiveStaff[]>([]);
  const [roles, setRoles] = useState<Record<string, LiveRole>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [lastTempPassword, setLastTempPassword] = useState<{ email: string; password: string } | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState('Support');
  const [selectedRole, setSelectedRole] = useState('Finance');
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [newRoleDefaultOpen, setNewRoleDefaultOpen] = useState(false);

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveStaff.list(), liveRoles.list()])
      .then(([s, r]) => {
        setStaff(s);
        setRoles(r);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const roleNames = Object.keys(roles);
  const matrix = roles[selectedRole]?.permissions ?? {};
  const isOwnerRole = selectedRole === 'Owner';

  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      const created = await liveStaff.create({
        email: inviteEmail.trim(),
        roleName: inviteRole,
        phone: invitePhone.trim() || undefined,
      });
      setLastTempPassword({ email: created.email, password: created.tempPassword });
      setInviteEmail('');
      setInvitePhone('');
      setShowInvite(false);
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to invite staff');
    }
  };

  const updateStaffRole = async (id: string, roleName: string) => {
    try {
      await liveStaff.updateRole(id, roleName);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update role');
    }
  };

  const toggleLeadScope = async (s: LiveStaff, role: string) => {
    const next = s.leadRoleScope.includes(role) ? s.leadRoleScope.filter((r) => r !== role) : [...s.leadRoleScope, role];
    try {
      await liveStaff.setLeadRoleScope(s.id, next);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update lead scope');
    }
  };

  const removeStaff = async (s: LiveStaff) => {
    if (!window.confirm(`Remove ${s.name}? Their access is revoked immediately.`)) return;
    try {
      await liveStaff.remove(s.id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to remove');
    }
  };

  const addRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newRole.trim();
    if (!name) return;
    if (roles[name]) {
      setErr(`Role "${name}" already exists`);
      return;
    }
    try {
      await liveRoles.add(name, newRoleDefaultOpen);
      setSelectedRole(name);
      setNewRole('');
      setNewRoleDefaultOpen(false);
      setShowAddRole(false);
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to add role');
    }
  };

  const setRolePerm = async (roleName: string, module: string, key: PermKey, value: boolean) => {
    try {
      await liveRoles.setPerm(roleName, module, key, value);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update permission');
    }
  };

  const setDefaultOpen = async (roleName: string, value: boolean) => {
    try {
      await liveRoles.setDefaultOpen(roleName, value);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update');
    }
  };

  const removeRole = async (name: string) => {
    if (!window.confirm(`Remove the "${name}" role?`)) return;
    try {
      await liveRoles.remove(name);
      setSelectedRole('Finance');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to remove role');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 900 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}
      {lastTempPassword && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          Invited <b>{lastTempPassword.email}</b> — temp password: <code>{lastTempPassword.password}</code> (also emailed)
        </div>
      )}

      <div className="page-hd">
        <h1 className="page-title">Staff &amp; roles</h1>
        <button className="btn btn-pri" onClick={() => setShowInvite((v) => !v)}>+ Invite staff</button>
      </div>

      {showInvite && (
        <form
          className="card"
          style={{ border: '1px solid var(--green)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 12 }}
          onSubmit={addStaff}
        >
          <input
            className="input"
            style={{ flex: 1, minWidth: 180 }}
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@prebooze.com"
            autoFocus
          />
          <input
            className="input"
            style={{ flex: 1, minWidth: 150 }}
            value={invitePhone}
            onChange={(e) => setInvitePhone(e.target.value)}
            placeholder="WhatsApp number (for alerts)"
          />
          <select className="input" style={{ width: 150 }} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
            {roleNames.filter((r) => r !== 'Owner').map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-pri btn-sm">Invite</button>
        </form>
      )}

      {/* Member list with role assigner */}
      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 640 }}>
          <span style={{ flex: 1.6 }}>Member</span>
          <span style={{ flex: 1.1 }}>Role</span>
          <span style={{ flex: 1.6 }}>Lead scope</span>
          <span style={{ flex: 0.8 }}>City</span>
          <span style={{ flex: 1 }}>Last active</span>
          <span style={{ width: 60 }} />
        </div>
        {staff.map((s) => {
          const isOwner = s.roleName === 'Owner';
          return (
            <div key={s.id} className="trow" style={{ minWidth: 640 }}>
              <span style={{ flex: 1.6 }}>
                <div style={{ fontWeight: 700 }}>{s.name}</div>
                <div className="tiny muted">{s.email}</div>
              </span>
              <span style={{ flex: 1.1 }}>
                {isOwner ? (
                  <Tag label="Owner" cls="tag-green" />
                ) : (
                  <select
                    className="input"
                    style={{ padding: '4px 8px', fontSize: 12, width: 'fit-content' }}
                    value={s.roleName}
                    onChange={(e) => updateStaffRole(s.id, e.target.value)}
                  >
                    {roleNames.filter((r) => r !== 'Owner').map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                )}
              </span>
              <span style={{ flex: 1.6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {isOwner ? (
                  <span className="tiny muted">sees everything</span>
                ) : (
                  LEAD_ROLE_OPTIONS.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      className={`chip ${s.leadRoleScope.includes(r.key) ? 'on' : ''}`}
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => toggleLeadScope(s, r.key)}
                      title={`Toggle ${r.label} leads for ${s.name}`}
                    >
                      {r.emoji} {r.label}
                    </button>
                  ))
                )}
              </span>
              <span style={{ flex: 0.8 }} className="muted">{s.city ?? '—'}</span>
              <span style={{ flex: 1 }} className="muted">{fmtLastActive(s.lastActiveAt)}</span>
              <span style={{ width: 60, display: 'flex', justifyContent: 'flex-end' }}>
                {!isOwner && (
                  <button className="btn btn-danger btn-sm" style={{ padding: '3px 8px' }} onClick={() => removeStaff(s)}>
                    ✕
                  </button>
                )}
              </span>
            </div>
          );
        })}
        {staff.length === 0 && !loading && <div className="trow muted">No staff yet.</div>}
      </div>
      <div className="tiny hint">changing a role applies its permission matrix to that member immediately · lead scope with nothing selected means unrestricted (sees every lead)</div>

      {/* Role editor */}
      <div className="page-hd" style={{ marginTop: 8 }}>
        <div className="display" style={{ fontSize: 16, fontWeight: 700 }}>Role editor</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowAddRole((v) => !v)}>+ New role</button>
      </div>

      {showAddRole && (
        <form
          className="card"
          style={{ border: '1px solid var(--green)', display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}
          onSubmit={addRole}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="input"
              style={{ flex: 1, minWidth: 160 }}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Role name (e.g. Marketing)"
              autoFocus
            />
            <button type="submit" className="btn btn-pri btn-sm">Create role</button>
          </div>
          <label className="tiny muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={newRoleDefaultOpen}
              onChange={(e) => setNewRoleDefaultOpen(e.target.checked)}
              style={{ accentColor: 'var(--green)', width: 14, height: 14 }}
            />
            Automatically grant this role access to new admin features as they ship
          </label>
        </form>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {roleNames.map((r) => (
          <button key={r} className={`chip ${selectedRole === r ? 'on' : ''}`} onClick={() => setSelectedRole(r)}>
            {r}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div className="display" style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>
          Role: {selectedRole} — permissions {isOwnerRole && <span className="tiny muted">(Owner always has full access)</span>}
        </div>
        {!isOwnerRole && (
          <label className="tiny muted" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={roles[selectedRole]?.defaultOpen ?? false}
              onChange={(e) => setDefaultOpen(selectedRole, e.target.checked)}
              style={{ accentColor: 'var(--green)', width: 14, height: 14 }}
            />
            Automatically grant new admin features to this role as they ship — otherwise a new module stays off until checked below
          </label>
        )}
        <div className="thead" style={{ padding: '6px 0' }}>
          <span style={{ flex: 2 }}>Module</span>
          {PERM_KEYS.map((k) => (
            <span key={k} style={{ flex: 1, textAlign: 'center' }}>{k}</span>
          ))}
        </div>
        {PERM_MODULES.map((m) => (
          <div key={m} className="trow" style={{ padding: '7px 0', fontSize: 12 }}>
            <span style={{ flex: 2 }}>{m}</span>
            {PERM_KEYS.map((k) => (
              <span key={k} style={{ flex: 1, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  disabled={isOwnerRole}
                  checked={matrix[m]?.[k] ?? false}
                  onChange={(e) => setRolePerm(selectedRole, m, k, e.target.checked)}
                  style={{ accentColor: 'var(--green)', width: 14, height: 14 }}
                />
              </span>
            ))}
          </div>
        ))}
        {!isOwnerRole && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => removeRole(selectedRole)}
            >
              ✕ Remove role
            </button>
          </div>
        )}
      </div>
      <div className="tiny hint">roles: Owner · Manager · Finance · Content · Support · Scanner only — plus your custom roles</div>
    </div>
  );
}
