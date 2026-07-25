import { useEffect, useState } from 'react';
import { liveStaff, liveRoles, LiveApiError, PERM_MODULES, type LiveStaff, type Perms, type PermKey } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Staff & roles (live)';

/** Real staff accounts + real role permission matrix — Owner-only on the
 * backend (OwnerOnlyGuard), matching the mock's original intent exactly.
 * Creating a staff member here sends a real invite email with a real temp
 * password (StaffService.createStaff -> EmailService), and assigning a
 * different role/toggling a permission takes effect on their very next
 * request (no re-login needed, permissions are read fresh per request). */
export default function StaffLive() {
  const session = useLiveSession();
  const { token } = session;

  const [staff, setStaff] = useState<LiveStaff[]>([]);
  const [roles, setRoles] = useState<Record<string, Perms>>({});
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [lastTempPassword, setLastTempPassword] = useState<{ email: string; password: string } | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newRoleName, setNewRoleName] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveStaff.list(), liveRoles.list()])
      .then(([s, r]) => {
        setStaff(s);
        setRoles(r);
        if (!newRole && Object.keys(r).length) setNewRole(Object.keys(r)[0]);
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

  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newRole) {
      setErr('Email and a role are required');
      return;
    }
    try {
      const created = await liveStaff.create({ email: newEmail.trim(), name: newName.trim() || undefined, roleName: newRole });
      setLastTempPassword({ email: created.email, password: created.tempPassword });
      setNewEmail('');
      setNewName('');
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to add staff');
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

  const removeStaff = async (id: string) => {
    if (!window.confirm('Remove this staff member?')) return;
    try {
      await liveStaff.remove(id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to remove');
    }
  };

  const addRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      await liveRoles.add(newRoleName.trim());
      setNewRoleName('');
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to add role');
    }
  };

  const togglePerm = async (roleName: string, module: string, key: PermKey, current: boolean) => {
    try {
      await liveRoles.setPerm(roleName, module, key, !current);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update permission');
    }
  };

  const removeRole = async (name: string) => {
    if (!window.confirm(`Delete role "${name}"?`)) return;
    try {
      await liveRoles.remove(name);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to delete role');
    }
  };

  const roleNames = Object.keys(roles);

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}
      {lastTempPassword && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          Invited <b>{lastTempPassword.email}</b> — temp password: <code>{lastTempPassword.password}</code> (also emailed)
        </div>
      )}

      <div className="tblwrap">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)', fontWeight: 700 }}>Staff</div>
        <form style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', padding: 16 }} onSubmit={addStaff}>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label>Email</label>
            <input className="input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="name@prebooze.com" />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Name (optional)</label>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="field" style={{ width: 150 }}>
            <label>Role</label>
            <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              {roleNames.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-pri">+ Invite</button>
        </form>
        {staff.map((s) => (
          <div key={s.id} className="trow">
            <span style={{ flex: 1.6 }}>
              <div style={{ fontWeight: 700 }}>{s.name}</div>
              <div className="tiny muted">{s.email}</div>
            </span>
            <span style={{ flex: 1 }}>
              <select className="input" style={{ padding: '4px 6px' }} value={s.roleName} onChange={(e) => updateStaffRole(s.id, e.target.value)}>
                {roleNames.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </span>
            <span style={{ flex: 0.8 }} className="tiny muted">{s.city || '—'}</span>
            <span style={{ flex: 0.6, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-danger btn-sm" onClick={() => removeStaff(s.id)}>Remove</button>
            </span>
          </div>
        ))}
      </div>

      <div className="tblwrap">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)', fontWeight: 700 }}>Roles &amp; permissions</div>
        <form style={{ display: 'flex', gap: 8, padding: 16 }} onSubmit={addRole}>
          <input className="input" style={{ flex: 1 }} value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="New role name" />
          <button type="submit" className="btn btn-pri">+ Add role</button>
        </form>
        {roleNames.map((name) => (
          <div key={name} style={{ borderTop: '1px solid rgba(139,195,74,.1)' }}>
            <div
              className="trow"
              style={{ cursor: 'pointer' }}
              onClick={() => setExpandedRole(expandedRole === name ? null : name)}
            >
              <span style={{ flex: 2, fontWeight: 700 }}>{name}</span>
              <span style={{ flex: 1 }} className="tiny muted">{staff.filter((s) => s.roleName === name).length} member(s)</span>
              <span style={{ flex: 0.6, display: 'flex', justifyContent: 'flex-end' }}>
                {name !== 'Owner' && (
                  <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); removeRole(name); }}>Delete</button>
                )}
              </span>
            </div>
            {expandedRole === name && (
              <div style={{ overflowX: 'auto', padding: '0 16px 16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: 6 }}>Module</th>
                      <th style={{ padding: 6 }}>View</th>
                      <th style={{ padding: 6 }}>Edit</th>
                      <th style={{ padding: 6 }}>Approve</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERM_MODULES.map((m) => {
                      const p = roles[name]?.[m] ?? { view: false, edit: false, approve: false };
                      return (
                        <tr key={m}>
                          <td style={{ padding: 6 }}>{m}</td>
                          {(['view', 'edit', 'approve'] as PermKey[]).map((key) => (
                            <td key={key} style={{ textAlign: 'center', padding: 6 }}>
                              <input
                                type="checkbox"
                                checked={p[key]}
                                onChange={() => togglePerm(name, m, key, p[key])}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
