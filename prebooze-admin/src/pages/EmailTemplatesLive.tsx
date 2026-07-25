import { useEffect, useState } from 'react';
import { liveEmailTemplates, LiveApiError, type LiveEmailTemplate } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Email templates (live)';

/** Real, DB-backed email templates — an edit here changes what real
 * transactional emails actually send (EmailService.sendTemplate looks up
 * this exact override), not a preview-only mock. */
export default function EmailTemplatesLive() {
  const session = useLiveSession();
  const { token } = session;
  const [templates, setTemplates] = useState<LiveEmailTemplate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [testTo, setTestTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveEmailTemplates
      .list()
      .then(setTemplates)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const open = (t: LiveEmailTemplate) => {
    setSelected(t.id);
    setSubject(t.subject);
    setBodyHtml(t.bodyHtml);
    setMsg('');
  };

  const save = async () => {
    if (!selected) return;
    setErr('');
    try {
      const updated = await liveEmailTemplates.update(selected, { subject, bodyHtml });
      setTemplates((prev) => prev.map((t) => (t.id === selected ? { ...t, ...updated } : t)));
      setMsg('Saved ✓');
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save');
    }
  };

  const reset = async () => {
    if (!selected) return;
    try {
      await liveEmailTemplates.reset(selected);
      load();
      const t = templates.find((x) => x.id === selected);
      if (t) { setSubject(t.defaultSubject); setBodyHtml(t.defaultBody); }
      setMsg('Reset to default ✓');
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to reset');
    }
  };

  const sendTest = async () => {
    if (!selected || !testTo.trim()) return;
    setErr('');
    try {
      await liveEmailTemplates.sendNow(selected, testTo.trim());
      setMsg(`Test sent to ${testTo.trim()} ✓`);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to send test');
    }
  };

  const current = templates.find((t) => t.id === selected);

  return (
    <div className="stack fade" style={{ maxWidth: 1000 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div className="tblwrap" style={{ flex: 1, minWidth: 260 }}>
          {templates.map((t) => (
            <div key={t.id} className="trow" style={{ cursor: 'pointer', background: selected === t.id ? 'rgba(139,195,74,.08)' : undefined }} onClick={() => open(t)}>
              <span style={{ flex: 1.6, fontWeight: 700 }}>{t.name}</span>
              <span style={{ flex: 0.8 }} className="tiny muted">{t.category}</span>
              {t.customized && <span className="tag tag-green" style={{ flex: 0.5 }}>edited</span>}
            </div>
          ))}
        </div>

        {current && (
          <div className="card" style={{ flex: 1.6, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="display" style={{ fontWeight: 700 }}>{current.name}</div>
            <div className="tiny muted">{current.trigger}</div>
            <div className="field">
              <label>Subject</label>
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="field">
              <label>Body (HTML)</label>
              <textarea className="input" rows={10} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 12 }} />
            </div>
            {msg && <div className="tiny" style={{ color: 'var(--green)' }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-pri" onClick={save}>Save</button>
              {current.customized && <button className="btn btn-ghost" onClick={reset}>Reset to default</button>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', borderTop: '1px solid rgba(139,195,74,.15)', paddingTop: 10 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Send a real test to</label>
                <input className="input" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
              </div>
              <button className="btn btn-ghost" onClick={sendTest}>Send test</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
