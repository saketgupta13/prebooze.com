import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { CAREER_JOBS } from '../data/mock';
import { careers as careersApi } from '../api';
import { isBackendEnabled } from '../api/client';
import type { CareerJob } from '../types';
import { useSeo } from '../lib/useSeo';

/** Careers — open roles + apply (jobs are admin-managed). */
export default function Careers() {
  useSeo(null, 'Careers');
  const { user, jobApps, applyJob, toast } = useApp();
  const [applying, setApplying] = useState<string | null>(null);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [note, setNote] = useState('');
  const [cv, setCv] = useState<File | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [liveJobs, setLiveJobs] = useState<CareerJob[] | null>(null);
  const jobsLoading = isBackendEnabled() && liveJobs === null;
  useEffect(() => {
    if (!isBackendEnabled()) return;
    careersApi.jobs().then(setLiveJobs).catch(() => setLiveJobs([]));
  }, []);
  const jobs = isBackendEnabled() ? (liveJobs ?? []) : CAREER_JOBS;

  useEffect(() => {
    if (applying) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [applying]);

  const submit = (e: React.FormEvent, jobId: string) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) {
      toast('Name, email and phone are required');
      return;
    }
    if (!cv) {
      toast('Please attach your CV / resume');
      return;
    }
    applyJob({ jobId, name: name.trim(), email: email.trim(), phone: phone.trim(), note: note.trim() }, cv);
    setApplying(null);
    setNote('');
    setCv(null);
  };

  const appliedIds = new Set(jobApps.filter((a) => a.phone === user?.phone || a.email === email).map((a) => a.jobId));

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="breadcrumb">
          <Link to="/">Home</Link> / Careers
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Work with us 🚀</h1>
        <p className="muted" style={{ marginBottom: 22 }}>
          {jobsLoading ? 'Loading open roles…' : <>We're building India's nightlife layer — {jobs.filter((j) => j.status === 'open').length} roles open right now.</>}
        </p>

        {!jobsLoading && jobs.filter((j) => j.status === 'open').map((j) => (
          <div key={j.id} className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <Link to={`/careers/${j.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h3 style={{ fontSize: 16 }}>{j.title} <span className="link tiny">view JD →</span></h3>
                </Link>
                <div className="chip-row" style={{ marginTop: 6 }}>
                  <span className="tag">{j.team}</span>
                  <span className="tag">📍 {j.loc}</span>
                  <span className="tag">{j.type}</span>
                </div>
              </div>
              {appliedIds.has(j.id) ? (
                <span className="badge badge-ok">Applied ✓</span>
              ) : applying === j.id ? (
                <button className="btn btn-ghost btn-sm" onClick={() => setApplying(null)}>Cancel</button>
              ) : (
                <button className="btn btn-pri btn-sm" onClick={() => setApplying(j.id)}>Apply →</button>
              )}
            </div>
            {applying === j.id && (
              <form ref={formRef} style={{ marginTop: 14, borderTop: '1px dashed var(--border-dash)', paddingTop: 14 }} onSubmit={(e) => submit(e, j.id)}>
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
                <button className="btn btn-pri">Submit application →</button>
              </form>
            )}
          </div>
        ))}
        <div className="tiny muted-2" style={{ marginTop: 6 }}>
          roles are posted by the Prebooze team from the admin panel · applications go straight to the hiring team
        </div>
      </div>
    </main>
  );
}
