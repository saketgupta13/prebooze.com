import { useState } from 'react';
import { useAdmin } from '../store/AdminContext';

/** Careers — post/edit/close jobs, create teams, review applicants. */
export default function CareersAdmin() {
  const { jobs, addJob, updateJob, toggleJob, removeJob, applicants, teams, addTeam } = useAdmin();
  const [title, setTitle] = useState('');
  const [team, setTeam] = useState(teams[0] ?? 'Engineering');
  const [loc, setLoc] = useState('');
  const [type, setType] = useState('Full-time');
  const [about, setAbout] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openJob, setOpenJob] = useState<string | null>(null);
  const [newTeam, setNewTeam] = useState('');
  const [teamOpen, setTeamOpen] = useState(false);

  const startEdit = (id: string) => {
    const j = jobs.find((x) => x.id === id);
    if (!j) return;
    setEditingId(id);
    setTitle(j.title); setTeam(j.team); setLoc(j.loc); setType(j.type); setAbout(j.about ?? '');
  };
  const reset = () => { setEditingId(null); setTitle(''); setLoc(''); setAbout(''); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !loc.trim()) return;
    if (editingId) updateJob(editingId, { title: title.trim(), team, loc: loc.trim(), type, about: about.trim() || undefined });
    else addJob({ title: title.trim(), team, loc: loc.trim(), type, about: about.trim() || undefined });
    reset();
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1000, gap: 14 }}>
      <div className="page-hd">
        <h1 className="page-title">Careers</h1>
        <span className="small muted">{jobs.filter((j) => j.status === 'open').length} open · {applicants.length} applicants · {teams.length} teams</span>
      </div>

      <form className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={submit}>
        {editingId && (
          <div style={{ flexBasis: '100%' }} className="small">
            ✎ Editing <b>{editingId}</b> <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={reset}>cancel</button>
          </div>
        )}
        <div className="field" style={{ flex: 1.6, minWidth: 160 }}>
          <label>Job title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Backend Engineer" />
        </div>
        <div className="field" style={{ width: 170 }}>
          <label>Team</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <select className="input" value={team} onChange={(e) => setTeam(e.target.value)}>
              {teams.map((t) => <option key={t}>{t}</option>)}
            </select>
            <button type="button" className="btn btn-ghost btn-sm" title="Create a new team" onClick={() => setTeamOpen((v) => !v)}>+</button>
          </div>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 130 }}>
          <label>Location</label>
          <input className="input" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Mumbai · Hybrid" />
        </div>
        <div className="field" style={{ width: 130 }}>
          <label>Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {['Full-time', 'Part-time', 'Internship', 'Contract'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field" style={{ flexBasis: '100%' }}>
          <label>Job description</label>
          <textarea className="input" style={{ minHeight: 56, resize: 'vertical' }} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="What the role owns, who it reports to, what great looks like…" />
        </div>
        <button className="btn btn-pri" style={{ height: 38 }}>{editingId ? 'Save changes ✓' : '+ Post job'}</button>
      </form>

      {teamOpen && (
        <form
          className="card"
          style={{ display: 'flex', gap: 8, alignItems: 'center' }}
          onSubmit={(e) => { e.preventDefault(); addTeam(newTeam); setNewTeam(''); setTeamOpen(false); }}
        >
          <b className="small">New team</b>
          <input className="input" style={{ maxWidth: 220, padding: '6px 10px' }} value={newTeam} onChange={(e) => setNewTeam(e.target.value)} placeholder="e.g. Finance" autoFocus />
          <button className="btn btn-pri btn-sm">Create team ✓</button>
        </form>
      )}

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 700 }}>
          <span style={{ width: 64 }}>ID</span>
          <span style={{ flex: 1.6 }}>Role</span>
          <span style={{ flex: 1 }}>Team</span>
          <span style={{ flex: 1 }}>Location</span>
          <span style={{ flex: 0.9 }}>Applicants</span>
          <span style={{ flex: 1.6 }} />
        </div>
        {jobs.map((j) => {
          const apps = applicants.filter((a) => a.jobId === j.id);
          return (
            <div key={j.id}>
              <div className="trow" style={{ minWidth: 700, opacity: j.status === 'open' ? 1 : 0.55 }}>
                <span style={{ width: 64 }} className="tiny muted">{j.id}</span>
                <span style={{ flex: 1.6, fontWeight: 700 }}>{j.title} <span className="tiny muted">· {j.type}</span></span>
                <span style={{ flex: 1 }} className="muted">{j.team}</span>
                <span style={{ flex: 1 }} className="muted">{j.loc}</span>
                <span style={{ flex: 0.9 }}>
                  <button className="chip" style={{ fontSize: 10.5, padding: '3px 10px' }} onClick={() => setOpenJob(openJob === j.id ? null : j.id)}>
                    {apps.length} {openJob === j.id ? '▴' : '▾'}
                  </button>
                </span>
                <span style={{ flex: 1.6, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(j.id)}>✎ Edit</button>
                  <button className="chip" style={{ fontSize: 10.5, padding: '3px 10px', borderColor: j.status === 'open' ? 'var(--green)' : 'var(--red)', color: j.status === 'open' ? undefined : 'var(--red)' }} onClick={() => toggleJob(j.id)}>
                    {j.status === 'open' ? 'Open' : 'Closed'}
                  </button>
                  <button className="btn btn-danger btn-sm" style={{ padding: '2px 7px' }} onClick={() => removeJob(j.id)}>✕</button>
                </span>
              </div>
              {openJob === j.id && (
                <div style={{ padding: '4px 16px 12px', borderBottom: '1px solid rgba(139,195,74,.12)' }}>
                  {j.about && <div className="tiny muted" style={{ marginBottom: 6 }}>JD: {j.about}</div>}
                  {apps.length === 0 ? (
                    <div className="muted small">No applicants yet.</div>
                  ) : (
                    apps.map((a) => (
                      <div key={a.id} className="trow" style={{ minWidth: 0 }}>
                        <span style={{ flex: 1.2, fontWeight: 700 }}>{a.name}</span>
                        <span style={{ flex: 1.4 }} className="muted">{a.email} · {a.phone}</span>
                        <span style={{ flex: 1.6 }} className="muted tiny">{a.note}</span>
                        <span style={{ flex: 0.6 }} className="muted tiny">{a.appliedAt}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="tiny hint">open roles appear on the guest careers page (with their job id) · applications land here per job</div>
    </div>
  );
}
