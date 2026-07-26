import { useEffect, useState } from 'react';
import SeoFields, { emptySeo } from '../components/SeoFields';
import WysiwygEditor from '../components/WysiwygEditor';
import { livePolicies, LiveApiError, type LivePolicy } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import type { Seo } from '../types';

const TITLE = 'Policies';

/** Policy / legal document editor — real Policy rows (Terms, Privacy,
 * Refund, etc.), one place for their sections and SEO. */
export default function Policies() {
  const session = useLiveSession();
  const { token } = session;

  const [policies, setPolicies] = useState<LivePolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sections, setSections] = useState<{ heading: string; body: string }[]>([]);
  const [seo, setSeo] = useState<Seo>(emptySeo());
  const [dirtyId, setDirtyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    livePolicies
      .list()
      .then((pols) => {
        setPolicies(pols);
        if (!selectedId && pols[0]) setSelectedId(pols[0].id);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const policy = policies.find((p) => p.id === selectedId) ?? policies[0];

  if (policy && dirtyId !== policy.id) {
    setSections(policy.sections);
    setSeo((policy.seo as Seo | null) ?? emptySeo());
    setDirtyId(policy.id);
  }

  if (!policy) {
    return (
      <div className="stack fade" style={{ maxWidth: 820 }}>
        <LiveHeaderBar title={TITLE} session={session} />
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        {loading && <div className="tiny muted">Loading…</div>}
        {!loading && <div className="card muted small">No policies yet.</div>}
      </div>
    );
  }

  const setSection = (i: number, patch: Partial<{ heading: string; body: string }>) =>
    setSections((prev) => prev.map((s, x) => (x === i ? { ...s, ...patch } : s)));

  const save = async () => {
    if (sections.some((s) => !s.heading.trim())) { setErr('Every section needs a heading'); return; }
    try {
      await livePolicies.update(policy.id, { sections, seo });
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 820 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Policies</h1>
        <span className="chip">last updated {new Date(policy.updatedAt).toLocaleDateString('en-IN')}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {policies.map((p) => (
          <button key={p.id} className={`chip ${selectedId === p.id ? 'on' : ''}`} onClick={() => setSelectedId(p.id)}>
            {p.title}
          </button>
        ))}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="display" style={{ fontWeight: 700 }}>{policy.title}</div>
        <div className="tiny hint" style={{ marginTop: -8 }}>public at prebooze.com/{policy.slug.replace(/^\//, '')}</div>
        {sections.map((sec, i) => (
          <div key={i} className="card" style={{ background: 'var(--surface-2)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1, fontWeight: 700 }}
                value={sec.heading}
                onChange={(e) => setSection(i, { heading: e.target.value })}
                placeholder={`Section ${i + 1} heading`}
              />
              <button
                className="btn btn-danger btn-sm"
                style={{ padding: '2px 8px' }}
                disabled={sections.length === 1}
                onClick={() => setSections((prev) => prev.filter((_, x) => x !== i))}
              >
                ✕
              </button>
            </div>
            <WysiwygEditor value={sec.body} onChange={(html) => setSection(i, { body: html })} minHeight={72} />
          </div>
        ))}
        <button
          className="btn btn-ghost btn-sm"
          style={{ width: 'fit-content' }}
          onClick={() => setSections((prev) => [...prev, { heading: '', body: '' }])}
        >
          + Add section
        </button>
      </div>

      <SeoFields seo={seo} onChange={setSeo} slug={'/' + policy.slug.replace(/^\//, '')} fallbackTitle={policy.title} />

      <div className="dashed-box tiny red" style={{ color: 'var(--red)' }}>
        ⚠ Placeholder legal copy — real language must be drafted and reviewed by counsel before launch.
      </div>

      <button className="btn btn-pri" style={{ width: 'fit-content', padding: 10 }} onClick={save}>Save {policy.title} ✓</button>
    </div>
  );
}
