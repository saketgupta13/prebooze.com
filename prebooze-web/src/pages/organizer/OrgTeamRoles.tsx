import { useState } from 'react';
import { ORG_PERM_MODULES, useApp } from '../../store/AppContext';
import type { OrgPermSet } from '../../store/AppContext';

const PERM_KEYS: (keyof OrgPermSet)[] = ['view', 'edit'];

/** Team & roles — organizer version of the admin permission system:
 * assign roles per member and edit each role's module permissions. */
export default function OrgTeamRoles() {
  const { team, addTeamMember, removeTeamMember, updateTeamRole, orgRoles, setOrgRolePerm, addOrgRole, removeOrgRole, toast } = useApp();
  const roleNames = Object.keys(orgRoles);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('Door staff');
  const [inviteScan, setInviteScan] = useState(true);
  const [selectedRole, setSelectedRole] = useState('Manager');
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRole, setNewRole] = useState('');

  const matrix = orgRoles[selectedRole] ?? {};
  const isOwnerRole = selectedRole === 'Owner';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 24 }}>Team &amp; roles</h1>
        <button className="btn btn-pri" onClick={() => setShowInvite((v) => !v)}>+ Invite member</button>
      </div>

      {showInvite && (
        <form
          className="card"
          style={{ borderColor: 'var(--accent)', marginBottom: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!inviteName.trim()) return;
            addTeamMember({ name: inviteName.trim(), role: inviteRole, scan: inviteScan });
            toast(`Invite sent to ${inviteName.trim()} ✓`);
            setInviteName('');
            setShowInvite(false);
          }}
        >
          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="field">
              <span>Name or phone</span>
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
            <button className="btn btn-pri" style={{ flex: '0 0 auto' }}>Invite ✓</button>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={inviteScan} onChange={() => setInviteScan((v) => !v)} />
            allow door-scan access
          </label>
        </form>
      )}

      {/* Member list with role assigner */}
      <div className="card" style={{ marginBottom: 18 }}>
        {team.map((m) => (
          <div key={m.name} className="evrow">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bold small">{m.name}</div>
              <div className="tiny muted">{m.scan ? '📷 door-scan access' : 'no scan access'}</div>
            </div>
            {m.role === 'Owner' ? (
              <span className="badge badge-accent">Owner</span>
            ) : (
              <select
                value={m.role}
                onChange={(e) => updateTeamRole(m.name, e.target.value)}
                style={{ width: 'fit-content', padding: '6px 10px', fontSize: 13 }}
              >
                {roleNames.filter((r) => r !== 'Owner').map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            )}
            {m.role !== 'Owner' && (
              <button
                className="btn btn-danger btn-sm"
                style={{ border: '1.5px solid var(--danger)', color: 'var(--danger)' }}
                onClick={() => {
                  if (window.confirm(`Remove ${m.name} from the team?`)) {
                    removeTeamMember(m.name);
                    toast('Team member removed');
                  }
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="tiny muted-2" style={{ marginBottom: 20 }}>changing a role applies its permission matrix to that member immediately</div>

      {/* Role editor */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 18 }}>Role editor</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowAddRole((v) => !v)}>+ New role</button>
      </div>

      {showAddRole && (
        <form
          className="card"
          style={{ borderColor: 'var(--accent)', marginBottom: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            const n = newRole.trim();
            if (!n) return;
            if (orgRoles[n]) {
              toast(`Role "${n}" already exists`);
              return;
            }
            addOrgRole(n);
            setSelectedRole(n);
            setNewRole('');
            setShowAddRole(false);
          }}
        >
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
        </div>
        <div className="kv" style={{ borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
          <span className="k" style={{ flex: 2 }}>Module</span>
          {PERM_KEYS.map((k) => (
            <span key={k} style={{ flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>{k}</span>
          ))}
        </div>
        {ORG_PERM_MODULES.map((m) => (
          <div key={m} className="kv">
            <span className="k" style={{ flex: 2 }}>{m}</span>
            {PERM_KEYS.map((k) => (
              <span key={k} style={{ flex: 1, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  disabled={isOwnerRole}
                  checked={matrix[m]?.[k] ?? false}
                  onChange={(e) => setOrgRolePerm(selectedRole, m, k, e.target.checked)}
                  style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
                />
              </span>
            ))}
          </div>
        ))}
        {!isOwnerRole && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-pri btn-sm" onClick={() => toast(`Permissions saved for ${selectedRole} ✓`)}>
              Save role
            </button>
            <button
              className="btn btn-danger btn-sm"
              style={{ border: '1.5px solid var(--danger)', color: 'var(--danger)' }}
              onClick={() => {
                if (window.confirm(`Remove the "${selectedRole}" role?`)) {
                  if (removeOrgRole(selectedRole)) setSelectedRole('Manager');
                }
              }}
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
