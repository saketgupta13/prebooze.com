import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      aria-pressed={on}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--border-3)'),
        background: on ? 'var(--accent)' : 'transparent',
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 19 : 2,
          width: 15,
          height: 15,
          borderRadius: '50%',
          background: on ? 'var(--on-accent)' : 'var(--muted)',
          transition: 'left .15s',
        }}
      />
    </button>
  );
}

export default function Settings() {
  const { user, updateUser, team, addTeamMember, removeTeamMember, orgPrefs, updateOrgPrefs } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const [bank, setBank] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankSaved, setBankSaved] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('Door staff');
  const [inviteScan, setInviteScan] = useState(true);

  const toggleOpen = (key: string) => setOpen((o) => (o === key ? null : key));

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Settings</h1>
      <div className="card">
        {/* Brand profile */}
        <div className="evrow">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Brand profile</div>
            <div className="tiny muted">{user?.orgBrand ?? 'Your brand'} · logo, bio, links — public page</div>
          </div>
          <Link to="/organizer/onboarding" className="btn btn-ghost btn-sm">Edit</Link>
        </div>

        {/* KYC & bank */}
        <div className="evrow" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">KYC &amp; bank</div>
            <div className="tiny muted">
              Aadhaar <span className="verified">✓</span> · PAN <span className="verified">✓</span> ·{' '}
              {bankSaved ? `bank •••• ${bank.slice(-4)} ` : 'HDFC •••• 8821 '}
              <span className="verified">✓</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => toggleOpen('bank')}>
            {open === 'bank' ? 'Close' : 'Manage'}
          </button>
          {open === 'bank' && (
            <div style={{ flexBasis: '100%', paddingTop: 12 }}>
              <div className="form-row">
                <div className="field">
                  <span>New account number</span>
                  <input value={bank} onChange={(e) => setBank(e.target.value)} inputMode="numeric" placeholder="•••• 8821" />
                </div>
                <div className="field">
                  <span>IFSC</span>
                  <input value={ifsc} onChange={(e) => setIfsc(e.target.value)} placeholder="HDFC0001234" />
                </div>
              </div>
              {bank && ifsc && <div className="small accent" style={{ marginBottom: 10 }}>✓ penny-drop verification passed</div>}
              <button
                className="btn btn-pri btn-sm"
                disabled={!bank.trim() || !ifsc.trim()}
                onClick={() => {
                  setBankSaved(true);
                  setOpen(null);
                }}
              >
                Save bank details ✓
              </button>
              <div className="tiny muted-2" style={{ marginTop: 6 }}>changing bank pauses payouts until penny-drop re-verifies (~2h)</div>
            </div>
          )}
        </div>

        {/* Team members */}
        <div className="evrow" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Team members</div>
            <div className="tiny muted">
              {team.length} members · door-scan access for {team.filter((m) => m.scan).length}
            </div>
          </div>
          <Link to="/organizer/team" className="btn btn-ghost btn-sm">Manage →</Link>
          <button className="btn btn-ghost btn-sm" onClick={() => toggleOpen('team')}>
            {open === 'team' ? 'Close' : 'Invite +'}
          </button>
          {open === 'team' && (
            <div style={{ flexBasis: '100%', paddingTop: 12 }}>
              {team.map((m) => (
                <div key={m.name} className="kv">
                  <span className="k">
                    {m.name} · {m.role}
                    {m.scan && <span className="accent"> · 📷 scan</span>}
                  </span>
                  {m.role !== 'Owner' && (
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ padding: '2px 8px' }}
                      onClick={() => {
                        if (window.confirm(`Remove ${m.name} from the team?`)) removeTeamMember(m.name);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <div className="form-row" style={{ marginTop: 10 }}>
                <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Name or phone" />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ flex: '0 0 140px' }}>
                  <option>Manager</option>
                  <option>Door staff</option>
                  <option>Promoter</option>
                </select>
              </div>
              <label className="checkbox-row" style={{ margin: '10px 0' }}>
                <input type="checkbox" checked={inviteScan} onChange={() => setInviteScan((v) => !v)} />
                allow door-scan access
              </label>
              <button
                className="btn btn-pri btn-sm"
                disabled={!inviteName.trim()}
                onClick={() => {
                  addTeamMember({ name: inviteName.trim(), role: inviteRole, scan: inviteScan });
                  setInviteName('');
                }}
              >
                Send invite ✓
              </button>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="evrow">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Notifications</div>
            <div className="tiny muted">
              WhatsApp {orgPrefs.whatsapp ? 'on ✓' : 'off'} · email digests {orgPrefs.emailDigest ? 'weekly' : 'off'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <label className="tiny muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              WhatsApp <Toggle on={orgPrefs.whatsapp} onChange={() => updateOrgPrefs({ whatsapp: !orgPrefs.whatsapp })} />
            </label>
            <label className="tiny muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Email <Toggle on={orgPrefs.emailDigest} onChange={() => updateOrgPrefs({ emailDigest: !orgPrefs.emailDigest })} />
            </label>
          </div>
        </div>

        {/* Refund policy */}
        <div className="evrow">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Refund policy defaults</div>
            <div className="tiny muted">free cancellation up to {orgPrefs.refundWindow} before event</div>
          </div>
          <select
            value={orgPrefs.refundWindow}
            onChange={(e) => updateOrgPrefs({ refundWindow: e.target.value })}
            style={{ width: 130 }}
          >
            <option value="24h">24 hours</option>
            <option value="48h">48 hours</option>
            <option value="72h">72 hours</option>
            <option value="no refunds">No refunds</option>
          </select>
        </div>
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
