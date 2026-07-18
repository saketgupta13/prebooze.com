import { useState } from 'react';
import { useAdmin } from '../store/AdminContext';

/** Careers — post/close jobs and review applicants (mirrors the guest /careers page). */
export default function CareersAdmin() {
  const { jobs, addJob, toggleJob, removeJob, applicants } = useAdmin();
  const [title, setTitle] = useState('');
  const [team, setTeam] = useState('Engineering');
  const [loc, setLoc] = useState('');
  const [type, setType] = useState('Full-time');
  const [openJob, setOpenJob] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !loc.trim()) return;
    addJob({ title: title.trim(), team, loc: loc.trim(), type });
    setTitle(''); setLoc('');
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1000, gap: 14 }}>
      <div className="page-hd">
        <h1 className="page-title">Careers</h1>
        <span className="small muted">{jobs.filter((j) => j.status === 'open').length} open · {applicants.length} applicants</span>
      </div>

      <form className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={submit}>
        <div className="field" style={{ flex: 1.6, minWidth: 160 }}>
          <label>Job title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Backend Engineer" />
        </div>
        <div className="field" style={{ width: 140 }}>
          <label>Team</label>
          <select className="input" value={team} onChange={(e) => setTeam(e.target.value)}>
            {['Engineering', 'Design', 'Growth', 'Operations', 'Support'].map((t) => <option key={t}>{t}</option>)}
          </select>
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
        <button className="btn btn-pri" style={{ height: 38 }}>+ Post job</button>
      </form>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 640 }}>
          <span style={{ flex: 1.6 }}>Role</span>
          <span style={{ flex: 1 }}>Team</span>
          <span style={{ flex: 1 }}>Location</span>
          <span style={{ flex: 0.9 }}>Applicants</span>
          <span style={{ flex: 1.4 }} />
        </div>
        {jobs.map((j) => {
          const apps = applicants.filter((a) => a.jobId === j.id);
          return (
            <div key={j.id}>
              <div className="trow" style={{ minWidth: 640, opacity: j.status === 'open' ? 1 : 0.55 }}>
                <span style={{ flex: 1.6, fontWeight: 700 }}>{j.title} <span className="tiny muted">· {j.type}</span></span>
                <span style={{ flex: 1 }} className="muted">{j.team}</span>
                <span style={{ flex: 1 }} className="muted">{j.loc}</span>
                <span style={{ flex: 0.9 }}>
                  <button className="chip" style={{ fontSize: 10.5, padding: '3px 10px' }} onClick={() => setOpenJob(openJob === j.id ? null : j.id)}>
                    {apps.length} {openJob === j.id ? '▴' : '▾'}
                  </button>
                </span>
                <span style={{ flex: 1.4, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="chip" style={{ fontSize: 10.5, padding: '3px 10px', borderColor: j.status === 'open' ? 'var(--green)' : 'var(--red)', color: j.status === 'open' ? undefined : 'var(--red)' }} onClick={() => toggleJob(j.id)}>
                    {j.status === 'open' ? 'Open' : 'Closed'}
                  </button>
                  <button className="btn btn-danger btn-sm" style={{ padding: '2px 7px' }} onClick={() => removeJob(j.id)}>✕</button>
                </span>
              </div>
              {openJob === j.id && (
                <div style={{ padding: '4px 16px 12px', borderBottom: '1px solid rgba(139,195,74,.12)' }}>
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
      <div className="tiny hint">open roles appear on the guest careers page · applications land here per job</div>
    </div>
  );
}
