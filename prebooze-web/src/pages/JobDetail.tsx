import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { CAREER_JOBS } from '../data/mock';

/** Full job description with an apply form. */
export default function JobDetail() {
  const { jobId } = useParams();
  const { user, jobApps, applyJob, toast } = useApp();
  const job = CAREER_JOBS.find((j) => j.id === jobId);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);

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
    applyJob({ jobId: job.id, name: name.trim(), email: email.trim(), phone: phone.trim(), note: note.trim() });
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
          <p style={{ marginTop: 14, fontSize: 14.5 }}>{job.about}</p>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10 }}>What you'll do</h3>
          <ul style={{ paddingLeft: 20, display: 'grid', gap: 6, fontSize: 14 }} className="muted">
            {job.responsibilities.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 10 }}>What we're looking for</h3>
          <ul style={{ paddingLeft: 20, display: 'grid', gap: 6, fontSize: 14 }} className="muted">
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
