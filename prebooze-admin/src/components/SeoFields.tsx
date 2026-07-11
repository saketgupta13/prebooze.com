import type { Seo } from '../types';

export const emptySeo = (): Seo => ({ title: '', description: '', keywords: '' });

/** Reusable SEO editor with a Google-style result preview — used by pages, blogs, events, categories, organizers and venues. */
export default function SeoFields({
  seo,
  onChange,
  slug,
  fallbackTitle,
}: {
  seo: Seo;
  onChange: (next: Seo) => void;
  slug: string;
  fallbackTitle: string;
}) {
  const set = (k: keyof Seo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...seo, [k]: e.target.value });

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="display" style={{ fontWeight: 700 }}>SEO options</div>
      <div className="field">
        <label>SEO title</label>
        <input className="input" value={seo.title} onChange={set('title')} placeholder={`${fallbackTitle} | Prebooze`} maxLength={70} />
      </div>
      <div className="field">
        <label>Meta description (160 chars)</label>
        <textarea className="input" style={{ minHeight: 48, resize: 'vertical' }} value={seo.description} onChange={set('description')} maxLength={160} />
      </div>
      <div className="field">
        <label>Keywords (comma-separated)</label>
        <input className="input" value={seo.keywords} onChange={set('keywords')} placeholder="events in austin, tickets, nightlife" />
      </div>
      <div style={{ background: 'var(--input)', border: '1px solid rgba(139,195,74,.2)', borderRadius: 8, padding: '10px 12px' }}>
        <div className="tiny muted" style={{ marginBottom: 4 }}>Search preview:</div>
        <div style={{ color: '#8ab4f8', fontSize: 15, fontWeight: 600 }}>{seo.title || `${fallbackTitle} | Prebooze`}</div>
        <div style={{ color: 'var(--green)', fontSize: 11.5 }}>prebooze.com{slug}</div>
        <div className="tiny muted">{seo.description || 'Meta description preview…'}</div>
      </div>
    </div>
  );
}
