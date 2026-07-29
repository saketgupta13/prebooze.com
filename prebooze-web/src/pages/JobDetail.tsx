import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { CAREER_JOBS } from '../data/mock';
import { careers as careersApi } from '../api';
import { isBackendEnabled } from '../api/client';
import type { CareerJob } from '../types';
import { PageLoader } from '../components/Loader';

/** Full job description with an apply form. */
export default function JobDetail() {
  const { jobId } = useParams();
  const { user, jobApps, applyJob, toast } = useApp();

  const [liveJobs, setLiveJobs] = useState<CareerJob[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    careersApi.jobs().then(setLiveJobs).catch(() => setLiveJobs([]));
  }, []);
  const jobs = isBackendEnabled() ? (liveJobs ?? []) : CAREER_JOBS;
  const job = jobs.find((j) => j.id === jobId);

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [note, setNote] = useState('');
  const [cv, setCv] = useState<File | null>(null);
  const [open, setOpen] = useState(false);

  if (isBackendEnabled() && liveJobs === null) return <PageLoader />;

  if (!job || job.status !== 'open') {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>This role isn't open</h1>
          <Link to="/careers" className="btn btn-pri" style={{ marginTop: 18 }}>See open roles →</Link>
        </div>
      </main>
    );
  }

  const applied = jobApps.some((a) => a.jobId === job.id && (a.phone === user?.phone || (email && a.email === email)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) {
      toast('Name, email and phone are required');
      return;
    }
    if (!cv) {
      toast('Please attach your CV / resume');
      return;
    }
    applyJob({ jobId: job.id, name: name.trim(), email: email.trim(), phone: phone.trim(), note: note.trim() }, cv);
    setOpen(false);
  };

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="breadcrumb">
          <Link to="/careers">Careers</Link> / {job.title}
        </div>

        <div className="card card-shadow" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 24 }}>{job.title}</h1>
              <div className="muted small" style={{ marginTop: 4 }}>
                {job.team} · {job.loc} · {job.type} · <span className="tag" style={{ fontSize: 10.5 }}>Job ID: {job.id}</span>
              </div>
            </div>
            {applied ? (
              <span className="badge badge-ok">Applied ✓</span>
            ) : (
              <button className="btn btn-pri" onClick={() => setOpen(true)}>Apply now →</button>
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10 }}>Job description</h3>
          <p style={{ fontSize: 14.5, marginBottom: 12 }}>{job.about}</p>
          <div className="small bold" style={{ marginBottom: 6 }}>What you'll do</div>
          <ul style={{ paddingLeft: 20, display: 'grid', gap: 5, fontSize: 14, marginBottom: 12 }} className="muted">
            {job.responsibilities.map((r) => <li key={r}>{r}</li>)}
          </ul>
          <div className="small bold" style={{ marginBottom: 6 }}>What we're looking for</div>
          <ul style={{ paddingLeft: 20, display: 'grid', gap: 5, fontSize: 14 }} className="muted">
            {job.requirements.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>

        {open && !applied && (
          <form className="card card-shadow" onSubmit={submit}>
            <h3 style={{ marginBottom: 12 }}>Apply — {job.title}</h3>
            <div className="form-row">
              <div className="field">
                <span>Full name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="field">
                <span>Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.com" />
              </div>
              <div className="field">
                <span>Phone</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" />
              </div>
            </div>
            <div className="field">
              <span>Why you? (+ portfolio / LinkedIn link)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Two lines and a link is perfect…" />
            </div>
            <div className="field">
              <span>CV / resume (PDF or DOC, max 5 MB)</span>
              <label className={`upload-box ${cv ? 'done' : ''}`} style={{ cursor: 'pointer', display: 'block' }}>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 5 * 1024 * 1024) { toast('CV must be under 5 MB'); e.target.value = ''; return; }
                    setCv(f ?? null);
                  }}
                />
                {cv ? `✓ ${cv.name} attached · click to replace` : '⬆ upload your CV / resume'}
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-pri">Submit application →</button>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        )}
        {applied && <div className="tiny muted-2">The team will reach out on {email || 'your email'} · usually within a week.</div>}
      </div>
    </main>
  );
}
