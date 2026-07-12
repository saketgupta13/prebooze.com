import { useState } from 'react';
import { useAdmin } from '../store/AdminContext';
import SeoFields, { emptySeo } from '../components/SeoFields';

/** Policy / legal document editor — one place for Terms, Privacy, Refund, etc. */
export default function Policies() {
  const { policies, updatePolicy, toast } = useAdmin();
  const [selectedId, setSelectedId] = useState(policies[0]?.id ?? 'terms');
  const policy = policies.find((p) => p.id === selectedId) ?? policies[0];

  const [sections, setSections] = useState(policy.sections);
  const [seo, setSeo] = useState(policy.seo ?? emptySeo());
  const [dirtyId, setDirtyId] = useState(policy.id);

  // reset local state when switching document
  if (dirtyId !== policy.id) {
    setSections(policy.sections);
    setSeo(policy.seo ?? emptySeo());
    setDirtyId(policy.id);
  }

  const setSection = (i: number, patch: Partial<{ heading: string; body: string }>) =>
    setSections((prev) => prev.map((s, x) => (x === i ? { ...s, ...patch } : s)));

  const save = () => {
    if (sections.some((s) => !s.heading.trim())) {
      toast('Every section needs a heading');
      return;
    }
    updatePolicy(policy.id, { sections, seo });
  };

  return (
    <div className="stack fade" style={{ maxWidth: 820 }}>
      <div className="page-hd">
        <h1 className="page-title">Policies</h1>
        <span className="chip">last updated {policy.updated}</span>
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
        <div className="tiny hint" style={{ marginTop: -8 }}>public at prebooze.com{policy.slug}</div>
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
            <textarea
              className="input"
              style={{ minHeight: 72, resize: 'vertical' }}
              value={sec.body}
              onChange={(e) => setSection(i, { body: e.target.value })}
            />
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

      <SeoFields seo={seo} onChange={setSeo} slug={policy.slug} fallbackTitle={policy.title} />

      <div className="dashed-box tiny red" style={{ color: 'var(--red)' }}>
        ⚠ Placeholder legal copy — real language must be drafted and reviewed by counsel before launch.
      </div>

      <button className="btn btn-pri" style={{ width: 'fit-content', padding: 10 }} onClick={save}>Save {policy.title} ✓</button>
    </div>
  );
}
