import { useEffect, useState } from 'react';
import WysiwygEditor from '../components/WysiwygEditor';
import { liveCareers, LiveApiError, type LiveJob, type LiveApplicant, type LiveCareerTeam } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Careers';

/** Careers — post/edit/close jobs, create teams, review applicants. Real
 * CareersAdminService data; removeJob genuinely refuses to delete a job
 * with real applicants on file (close it instead), same guard the backend
 * enforces. */
export default function CareersAdmin() {
  const session = useLiveSession();
  const { token } = session;

  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [applicants, setApplicants] = useState<LiveApplicant[]>([]);
  const [teams, setTeams] = useState<LiveCareerTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [title, setTitle] = useState('');
  const [team, setTeam] = useState('');
  const [loc, setLoc] = useState('');
  const [type, setType] = useState('Full-time');
  const [about, setAbout] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openJob, setOpenJob] = useState<string | null>(null);
  const [newTeam, setNewTeam] = useState('');
  const [teamOpen, setTeamOpen] = useState(false);

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveCareers.listJobs(), liveCareers.listApplicants(), liveCareers.listTeams()])
      .then(([j, a, t]) => {
        setJobs(j);
        setApplicants(a);
        setTeams(t);
        if (!team && t[0]) setTeam(t[0].name);
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

  const startEdit = (id: string) => {
    const j = jobs.find((x) => x.id === id);
    if (!j) return;
    setEditingId(id);
    setTitle(j.title); setTeam(j.team); setLoc(j.loc); setType(j.type); setAbout(j.about ?? '');
  };
  const reset = () => { setEditingId(null); setTitle(''); setLoc(''); setAbout(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !loc.trim()) return;
    try {
      if (editingId) await liveCareers.updateJob(editingId, { title: title.trim(), team, loc: loc.trim(), type, about: about.trim() });
      else await liveCareers.createJob({ title: title.trim(), team, loc: loc.trim(), type, about: about.trim() });
      reset();
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to save job');
    }
  };

  const toggleJob = async (id: string) => {
    try { await liveCareers.toggleJob(id); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to update'); }
  };

  const removeJob = async (id: string) => {
    try { await liveCareers.removeJob(id); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to remove'); }
  };

  const addTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeam.trim()) return;
    try {
      await liveCareers.addTeam(newTeam.trim());
      setTeam(newTeam.trim());
      setNewTeam('');
      setTeamOpen(false);
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to add team');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1000, gap: 14 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

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
              {teams.map((t) => <option key={t.name}>{t.name}</option>)}
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
          <WysiwygEditor value={about} onChange={setAbout} minHeight={56} />
        </div>
        <button className="btn btn-pri" style={{ height: 38 }}>{editingId ? 'Save changes ✓' : '+ Post job'}</button>
      </form>

      {teamOpen && (
        <form className="card" style={{ display: 'flex', gap: 8, alignItems: 'center' }} onSubmit={addTeam}>
          <b className="small">New team</b>
          <input className="input" style={{ maxWidth: 220, padding: '6px 10px' }} value={newTeam} onChange={(e) => setNewTeam(e.target.value)} placeholder="e.g. Finance" autoFocus />
          <button className="btn btn-pri btn-sm">Create team ✓</button>
        </form>
      )}

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 700 }}>
          <span style={{ width: 90 }}>ID</span>
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
                <span
                  style={{ width: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  className="tiny muted"
                  title={j.id}
                >
                  {j.id}
                </span>
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
                  <button className="btn btn-danger btn-sm" style={{ padding: '2px 7px' }} onClick={() => removeJob(j.id)} title={apps.length > 0 ? 'Has applicants — close it instead' : 'Remove'}>✕</button>
                </span>
              </div>
              {openJob === j.id && (
                <div style={{ padding: '4px 16px 12px', borderBottom: '1px solid rgba(139,195,74,.12)' }}>
                  {j.about && (
                    <div className="tiny muted wysiwyg-body" style={{ marginBottom: 6 }} dangerouslySetInnerHTML={{ __html: j.about }} />
                  )}
                  {apps.length === 0 ? (
                    <div className="muted small">No applicants yet.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {apps.map((a) => (
                        <div key={a.id} className="card" style={{ padding: 10, display: 'grid', gap: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <span style={{ fontWeight: 700 }}>{a.name}</span>
                            <span className="tiny muted">Applied {new Date(a.appliedAt).toLocaleDateString('en-IN')}</span>
                          </div>
                          <div className="small muted">{a.email} · {a.phone}</div>
                          {a.note && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{a.note}</div>}
                          {a.cv ? (
                            <a href={a.cv} target="_blank" rel="noopener noreferrer" download className="btn btn-ghost btn-sm" style={{ width: 'fit-content', marginTop: 2 }}>
                              ⬇ Download CV
                            </a>
                          ) : (
                            <span className="tiny muted">No CV attached</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {jobs.length === 0 && !loading && <div className="trow muted">No job postings yet.</div>}
      </div>
      <div className="tiny hint">open roles appear on the guest careers page (with their job id) · applications land here per job</div>
    </div>
  );
}
