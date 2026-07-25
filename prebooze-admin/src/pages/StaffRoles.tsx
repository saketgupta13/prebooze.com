import { useState } from 'react';
import { useAdmin } from '../store/AdminContext';
import { enabledCityNames, PERM_MODULES } from '../store/data';
import { Tag } from '../components/ui';
import type { PermSet } from '../types';

const PERM_KEYS: (keyof PermSet)[] = ['view', 'edit', 'approve'];

export default function StaffRoles() {
  const { staff, roles, addStaff, updateStaffRole, removeStaff, setRolePerm, addRole, removeRole, toast, locations } = useAdmin();
  const roleNames = Object.keys(roles);
  const cities = enabledCityNames(locations);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState('Support');
  const [inviteCity, setInviteCity] = useState(cities[0] ?? 'Austin');
  const [selectedRole, setSelectedRole] = useState('Finance');
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRole, setNewRole] = useState('');

  const matrix = roles[selectedRole] ?? {};
  const isOwnerRole = selectedRole === 'Owner';

  return (
    <div className="stack fade" style={{ maxWidth: 900 }}>
      <div className="page-hd">
        <h1 className="page-title">Staff &amp; roles</h1>
        <button className="btn btn-pri" onClick={() => setShowInvite((v) => !v)}>+ Invite staff</button>
      </div>

      {showInvite && (
        <form
          className="card"
          style={{ border: '1px solid var(--green)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!inviteEmail.trim()) return;
            addStaff({ name: inviteEmail.trim(), role: inviteRole, lastActive: 'invited', city: inviteCity, phone: invitePhone.trim() || undefined });
            setInviteEmail('');
            setInvitePhone('');
            setShowInvite(false);
          }}
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
          <select className="input" style={{ width: 120 }} value={inviteCity} onChange={(e) => setInviteCity(e.target.value)}>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-pri btn-sm">Invite</button>
        </form>
      )}

      {/* Member list with role assigner */}
      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 480 }}>
          <span style={{ flex: 1.6 }}>Member</span>
          <span style={{ flex: 1.3 }}>Role</span>
          <span style={{ flex: 0.8 }}>City</span>
          <span style={{ flex: 1 }}>Last active</span>
          <span style={{ width: 60 }} />
        </div>
        {staff.map((s) => {
          const isOwner = s.role === 'Owner';
          return (
            <div key={s.name} className="trow" style={{ minWidth: 480 }}>
              <span style={{ flex: 1.6, fontWeight: 700 }}>{s.name}</span>
              <span style={{ flex: 1.3 }}>
                {isOwner ? (
                  <Tag label="Owner" cls="tag-green" />
                ) : (
                  <select
                    className="input"
                    style={{ padding: '4px 8px', fontSize: 12, width: 'fit-content' }}
                    value={s.role}
                    onChange={(e) => updateStaffRole(s.name, e.target.value)}
                  >
                    {roleNames.filter((r) => r !== 'Owner').map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                )}
              </span>
              <span style={{ flex: 0.8 }} className="muted">{s.city ?? '—'}</span>
              <span style={{ flex: 1 }} className="muted">{s.lastActive}</span>
              <span style={{ width: 60, display: 'flex', justifyContent: 'flex-end' }}>
                {!isOwner && (
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ padding: '3px 8px' }}
                    onClick={() => {
                      if (window.confirm(`Remove ${s.name}? Their access is revoked immediately.`)) removeStaff(s.name);
                    }}
                  >
                    ✕
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="tiny hint">changing a role applies its permission matrix to that member immediately</div>

      {/* Role editor */}
      <div className="page-hd" style={{ marginTop: 8 }}>
        <div className="display" style={{ fontSize: 16, fontWeight: 700 }}>Role editor</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowAddRole((v) => !v)}>+ New role</button>
      </div>

      {showAddRole && (
        <form
          className="card"
          style={{ border: '1px solid var(--green)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            const name = newRole.trim();
            if (!name) return;
            if (roles[name]) {
              toast(`Role "${name}" already exists`);
              return;
            }
            addRole(name);
            setSelectedRole(name);
            setNewRole('');
            setShowAddRole(false);
          }}
        >
          <input
            className="input"
            style={{ flex: 1, minWidth: 160 }}
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            placeholder="Role name (e.g. Marketing)"
            autoFocus
          />
          <button type="submit" className="btn btn-pri btn-sm">Create role</button>
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
            <button className="btn btn-pri btn-sm" onClick={() => toast(`Permissions saved for ${selectedRole} ✓`)}>
              Save role
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                if (window.confirm(`Remove the "${selectedRole}" role?`)) {
                  removeRole(selectedRole);
                  setSelectedRole('Finance');
                }
              }}
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
