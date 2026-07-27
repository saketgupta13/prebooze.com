import { useEffect, useState } from 'react';
import { orgRoles, orgTeam, type OrgModulePerms, type OrgPermKey, type OrgStaffMember } from '../../api';
import { ApiError } from '../../api/client';

const PERM_MODULES = ['Events & wizard', 'Attendees & check-in', 'Guest list', 'Coupons', 'Payouts & withdrawals', 'Reviews', 'Settings & team'];
const PERM_KEYS: OrgPermKey[] = ['view', 'edit'];

/** Real organizer team & roles — new OrgRole/OrgStaff models + endpoints
 * (organizer's own scoped counterpart to admin's Staff/StaffRole system).
 * Default roles (Owner/Manager/Door staff/Promoter) are seeded server-side
 * the first time this loads for a given organizer. */
export default function OrgTeamRoles() {
  const [team, setTeam] = useState<OrgStaffMember[]>([]);
  const [roles, setRoles] = useState<Record<string, OrgModulePerms>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Door staff');
  const [inviteScan, setInviteScan] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [selectedRole, setSelectedRole] = useState('Manager');
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [saved, setSaved] = useState(false);

  const roleNames = Object.keys(roles);
  const matrix = roles[selectedRole] ?? {};
  const isOwnerRole = selectedRole === 'Owner';

  const load = () => {
    setLoading(true);
    Promise.all([orgTeam.listStaff(), orgRoles.list()])
      .then(([t, r]) => {
        setTeam(t);
        setRoles(r);
        if (!r[selectedRole]) setSelectedRole(Object.keys(r)[0] ?? 'Owner');
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !invitePhone.trim()) return;
    setErr('');
    setInviting(true);
    try {
      await orgTeam.addStaff({
        name: inviteName.trim(),
        phone: invitePhone.trim(),
        email: inviteEmail.trim() || undefined,
        roleName: inviteRole,
        scan: inviteScan,
      });
      setInviteName('');
      setInvitePhone('');
      setInviteEmail('');
      setShowInvite(false);
      setInviteSent(true);
      setTimeout(() => setInviteSent(false), 4000);
      load();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to invite');
    } finally {
      setInviting(false);
    }
  };

  const updateRole = async (staffId: string, roleName: string) => {
    try {
      await orgTeam.updateStaffRole(staffId, roleName);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to update role');
    }
  };

  const removeMember = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name} from the team?`)) return;
    try {
      await orgTeam.removeStaff(id);
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to remove');
    }
  };

  const addRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = newRole.trim();
    if (!n) return;
    if (roles[n]) { setErr(`Role "${n}" already exists`); return; }
    setErr('');
    try {
      await orgRoles.add(n);
      setSelectedRole(n);
      setNewRole('');
      setShowAddRole(false);
      load();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to create role');
    }
  };

  const setPerm = async (module: string, key: OrgPermKey, value: boolean) => {
    // optimistic update so checkboxes feel instant
    setRoles((prev) => ({ ...prev, [selectedRole]: { ...prev[selectedRole], [module]: { ...prev[selectedRole]?.[module], [key]: value } } }));
    try {
      await orgRoles.setPerm(selectedRole, module, key, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save permission');
      load();
    }
  };

  const removeRole = async () => {
    if (!window.confirm(`Remove the "${selectedRole}" role?`)) return;
    try {
      await orgRoles.remove(selectedRole);
      setSelectedRole('Manager');
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to remove role');
    }
  };

  if (loading) return <div className="muted">Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 24 }}>Team &amp; roles</h1>
        <button className="btn btn-pri" onClick={() => setShowInvite((v) => !v)}>+ Invite member</button>
      </div>
      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
      {inviteSent && <div className="small" style={{ marginBottom: 10, color: 'var(--accent)' }}>✓ Invite sent — they can log in with that phone number now.</div>}

      {showInvite && (
        <form className="card" style={{ borderColor: 'var(--accent)', marginBottom: 16 }} onSubmit={invite}>
          <div className="form-row">
            <div className="field">
              <span>Name</span>
              <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} autoFocus />
            </div>
            <div className="field" style={{ flex: '0 0 160px' }}>
              <span>Role</span>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                {roleNames.filter((r) => r !== 'Owner').map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="field">
              <span>Phone number</span>
              <input value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div className="field">
              <span>Email (optional)</span>
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="for an extra email invite" />
            </div>
            <button className="btn btn-pri" style={{ flex: '0 0 auto' }} disabled={inviting}>{inviting ? 'Sending…' : 'Invite ✓'}</button>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={inviteScan} onChange={() => setInviteScan((v) => !v)} />
            allow door-scan access
          </label>
          <div className="tiny muted-2" style={{ marginTop: 6 }}>
            They'll get a WhatsApp + email invite and log in with this phone number — the console they see is scoped to the role you pick.
          </div>
        </form>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        {team.length === 0 && <div className="muted small">No team members yet — invite one above.</div>}
        {team.map((m) => (
          <div key={m.id} className="evrow">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bold small">{m.name}</div>
              <div className="tiny muted">
                {m.phone ?? 'no phone on file'} · {m.scan ? '📷 door-scan access' : 'no scan access'}
              </div>
            </div>
            {m.roleName === 'Owner' ? (
              <span className="badge badge-accent">Owner</span>
            ) : (
              <select
                value={m.roleName}
                onChange={(e) => updateRole(m.id, e.target.value)}
                style={{ width: 'fit-content', padding: '6px 10px', fontSize: 13 }}
              >
                {roleNames.filter((r) => r !== 'Owner').map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            )}
            {m.roleName !== 'Owner' && (
              <button
                className="btn btn-danger btn-sm"
                style={{ border: '1.5px solid var(--danger)', color: 'var(--danger)' }}
                onClick={() => removeMember(m.id, m.name)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="tiny muted-2" style={{ marginBottom: 20 }}>changing a role applies its permission matrix to that member immediately</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 18 }}>Role editor</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowAddRole((v) => !v)}>+ New role</button>
      </div>

      {showAddRole && (
        <form className="card" style={{ borderColor: 'var(--accent)', marginBottom: 12 }} onSubmit={addRole}>
          <div className="form-row">
            <input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Role name (e.g. Bar lead)" autoFocus />
            <button className="btn btn-pri" style={{ flex: '0 0 auto' }}>Create role</button>
          </div>
        </form>
      )}

      <div className="chip-row" style={{ marginBottom: 12 }}>
        {roleNames.map((r) => (
          <button key={r} className={`chip ${selectedRole === r ? 'on' : ''}`} onClick={() => setSelectedRole(r)}>
            {r}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="bold small" style={{ marginBottom: 10 }}>
          Role: {selectedRole} — permissions {isOwnerRole && <span className="tiny muted">(Owner always has full access)</span>}
          {saved && <span className="tiny accent" style={{ marginLeft: 10 }}>✓ saved</span>}
        </div>
        <div className="kv" style={{ borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
          <span className="k" style={{ flex: 2 }}>Module</span>
          {PERM_KEYS.map((k) => (
            <span key={k} style={{ flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>{k}</span>
          ))}
        </div>
        {PERM_MODULES.map((m) => (
          <div key={m} className="kv">
            <span className="k" style={{ flex: 2 }}>{m}</span>
            {PERM_KEYS.map((k) => (
              <span key={k} style={{ flex: 1, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  disabled={isOwnerRole}
                  checked={matrix[m]?.[k] ?? false}
                  onChange={(e) => setPerm(m, k, e.target.checked)}
                  style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
                />
              </span>
            ))}
          </div>
        ))}
        {!isOwnerRole && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              className="btn btn-danger btn-sm"
              style={{ border: '1.5px solid var(--danger)', color: 'var(--danger)' }}
              onClick={removeRole}
            >
              ✕ Remove role
            </button>
          </div>
        )}
      </div>
      <div className="tiny muted-2" style={{ marginTop: 10 }}>
        roles: Owner · Manager · Door staff · Promoter — plus your custom roles · scan access is set per member on invite
      </div>
    </div>
  );
}
