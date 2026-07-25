import { useEffect, useState } from 'react';
import {
  liveBanners, liveBlogCategories, liveBlogs, livePages, liveTestimonials, liveFaqs, livePolicies, LiveApiError,
} from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Content (live)';
type Kind = 'banners' | 'blogCategories' | 'blogs' | 'pages' | 'testimonials' | 'faqs' | 'policies';
const KINDS: { key: Kind; label: string }[] = [
  { key: 'banners', label: 'Banners' },
  { key: 'blogCategories', label: 'Blog categories' },
  { key: 'blogs', label: 'Blogs' },
  { key: 'pages', label: 'Pages' },
  { key: 'testimonials', label: 'Testimonials' },
  { key: 'faqs', label: 'FAQs' },
  { key: 'policies', label: 'Policies' },
];

/** Real CMS content lists — covers the core real action (see it, add it,
 * remove it, toggle the one boolean each type has) for all seven content
 * types the mock spread across seven separate pages. Rich editing (WYSIWYG
 * body content, image uploads, SEO fields, the Menu builder) stays on the
 * existing mock pages for now — same disclosed boundary as every other live
 * page, and lowest-priority/lowest-risk of everything wired this session. */
export default function ContentLive() {
  const session = useLiveSession();
  const { token } = session;
  const [kind, setKind] = useState<Kind>('banners');
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});

  const load = (k: Kind) => {
    setLoading(true);
    setErr('');
    setRows([]); // avoid a frame where `rows` still holds the previous kind's shape
    const api = { banners: liveBanners, blogCategories: liveBlogCategories, blogs: liveBlogs, pages: livePages, testimonials: liveTestimonials, faqs: liveFaqs, policies: livePolicies }[k];
    api
      .list()
      .then(setRows)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) { load(kind); setForm({}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, kind]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      if (kind === 'banners') await liveBanners.create({ title: form.title, heading: form.heading });
      else if (kind === 'blogCategories') await liveBlogCategories.create(form.name);
      else if (kind === 'blogs') await liveBlogs.create({ title: form.title, status: form.status || 'draft', category: form.category });
      else if (kind === 'pages') await livePages.create({ slug: form.slug, title: form.title });
      else if (kind === 'testimonials') await liveTestimonials.create({ author: form.author, location: form.location, rating: parseInt(form.rating, 10) || 5, quote: form.quote });
      else if (kind === 'faqs') await liveFaqs.create({ question: form.question, answer: form.answer, audience: form.audience || 'guests' });
      else if (kind === 'policies') await livePolicies.create({ title: form.title, slug: form.slug });
      setForm({});
      load(kind);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to create');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove this?')) return;
    try {
      const api = { banners: liveBanners, blogCategories: liveBlogCategories, blogs: liveBlogs, pages: livePages, testimonials: liveTestimonials, faqs: liveFaqs, policies: livePolicies }[kind];
      await api.remove(id);
      load(kind);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to remove');
    }
  };

  const toggleBannerActive = async (b: { id: string; active: boolean }) => {
    try {
      await liveBanners.update(b.id, { active: !b.active });
      load(kind);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update');
    }
  };

  const toggleFeatured = async (t: { id: string; featured: boolean }) => {
    try {
      await liveTestimonials.update(t.id, { featured: !t.featured });
      load(kind);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update');
    }
  };

  const f = (key: string) => form[key] ?? '';
  const setF = (key: string) => (v: string) => setForm((p) => ({ ...p, [key]: v }));

  return (
    <div className="stack fade" style={{ maxWidth: 900 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="tabs">
        {KINDS.map((k) => (
          <button key={k.key} className={kind === k.key ? 'on' : ''} onClick={() => { setRows([]); setKind(k.key); }}>{k.label}</button>
        ))}
      </div>

      <form className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={create}>
        {kind === 'banners' && (
          <>
            <div className="field" style={{ flex: 1, minWidth: 140 }}><label>Title</label><input className="input" value={f('title')} onChange={(e) => setF('title')(e.target.value)} /></div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}><label>Heading</label><input className="input" value={f('heading')} onChange={(e) => setF('heading')(e.target.value)} /></div>
          </>
        )}
        {kind === 'blogCategories' && (
          <div className="field" style={{ flex: 1, minWidth: 140 }}><label>Name</label><input className="input" value={f('name')} onChange={(e) => setF('name')(e.target.value)} /></div>
        )}
        {kind === 'blogs' && (
          <>
            <div className="field" style={{ flex: 1, minWidth: 140 }}><label>Title</label><input className="input" value={f('title')} onChange={(e) => setF('title')(e.target.value)} /></div>
            <div className="field" style={{ width: 130 }}>
              <label>Status</label>
              <select className="input" value={f('status') || 'draft'} onChange={(e) => setF('status')(e.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="field" style={{ width: 140 }}><label>Category</label><input className="input" value={f('category')} onChange={(e) => setF('category')(e.target.value)} /></div>
          </>
        )}
        {kind === 'pages' && (
          <>
            <div className="field" style={{ width: 160 }}><label>Slug</label><input className="input" value={f('slug')} onChange={(e) => setF('slug')(e.target.value)} placeholder="about-us" /></div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}><label>Title</label><input className="input" value={f('title')} onChange={(e) => setF('title')(e.target.value)} /></div>
          </>
        )}
        {kind === 'testimonials' && (
          <>
            <div className="field" style={{ width: 140 }}><label>Author</label><input className="input" value={f('author')} onChange={(e) => setF('author')(e.target.value)} /></div>
            <div className="field" style={{ width: 120 }}><label>Location</label><input className="input" value={f('location')} onChange={(e) => setF('location')(e.target.value)} /></div>
            <div className="field" style={{ width: 80 }}><label>Rating</label><input className="input" inputMode="numeric" value={f('rating') || '5'} onChange={(e) => setF('rating')(e.target.value)} /></div>
            <div className="field" style={{ flex: 1, minWidth: 160 }}><label>Quote</label><input className="input" value={f('quote')} onChange={(e) => setF('quote')(e.target.value)} /></div>
          </>
        )}
        {kind === 'faqs' && (
          <>
            <div className="field" style={{ flex: 1, minWidth: 160 }}><label>Question</label><input className="input" value={f('question')} onChange={(e) => setF('question')(e.target.value)} /></div>
            <div className="field" style={{ flex: 1, minWidth: 160 }}><label>Answer</label><input className="input" value={f('answer')} onChange={(e) => setF('answer')(e.target.value)} /></div>
            <div className="field" style={{ width: 130 }}>
              <label>Audience</label>
              <select className="input" value={f('audience') || 'guests'} onChange={(e) => setF('audience')(e.target.value)}>
                <option value="guests">Guests</option>
                <option value="organizers">Organizers</option>
              </select>
            </div>
          </>
        )}
        {kind === 'policies' && (
          <>
            <div className="field" style={{ flex: 1, minWidth: 140 }}><label>Title</label><input className="input" value={f('title')} onChange={(e) => setF('title')(e.target.value)} /></div>
            <div className="field" style={{ width: 160 }}><label>Slug</label><input className="input" value={f('slug')} onChange={(e) => setF('slug')(e.target.value)} placeholder="privacy" /></div>
          </>
        )}
        <button type="submit" className="btn btn-pri">+ Add</button>
      </form>

      <div className="tblwrap">
        {rows.length === 0 && !loading && <div className="trow muted">Nothing here yet.</div>}
        {kind === 'banners' && (rows as { id: string; title: string; heading: string | null; active: boolean }[]).map((b) => (
          <div key={b.id} className="trow">
            <span style={{ flex: 2, fontWeight: 700 }}>{b.title}</span>
            <span style={{ flex: 1.6 }} className="tiny muted">{b.heading}</span>
            <span style={{ flex: 0.8 }}><button className="btn btn-ghost btn-sm" onClick={() => toggleBannerActive(b)}>{b.active ? 'Active ✓' : 'Inactive'}</button></span>
            <span style={{ flex: 0.5, display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-danger btn-sm" onClick={() => remove(b.id)}>✕</button></span>
          </div>
        ))}
        {kind === 'blogCategories' && (rows as { id: string; name: string }[]).map((c) => (
          <div key={c.id} className="trow">
            <span style={{ flex: 1, fontWeight: 700 }}>{c.name}</span>
            <span style={{ flex: 0.3, display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-danger btn-sm" onClick={() => remove(c.id)}>✕</button></span>
          </div>
        ))}
        {kind === 'blogs' && (rows as { id: string; title: string; status: string; category: string | null }[]).map((b) => (
          <div key={b.id} className="trow">
            <span style={{ flex: 2, fontWeight: 700 }}>{b.title}</span>
            <span style={{ flex: 1 }} className="tiny muted">{b.category || '—'}</span>
            <span style={{ flex: 0.8 }}><span className={`tag ${b.status === 'published' ? 'tag-green' : ''}`}>{b.status}</span></span>
            <span style={{ flex: 0.5, display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-danger btn-sm" onClick={() => remove(b.id)}>✕</button></span>
          </div>
        ))}
        {kind === 'pages' && (rows as { slug: string; title: string }[]).map((p) => (
          <div key={p.slug} className="trow">
            <span style={{ flex: 1, fontWeight: 700 }}>{p.title}</span>
            <span style={{ flex: 1 }} className="tiny muted">/{p.slug}</span>
            <span style={{ flex: 0.3, display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-danger btn-sm" onClick={() => remove(p.slug)}>✕</button></span>
          </div>
        ))}
        {kind === 'testimonials' && (rows as { id: string; author: string; location: string; rating: number; quote: string; featured: boolean }[]).map((t) => (
          <div key={t.id} className="trow">
            <span style={{ flex: 1.4 }}>
              <div style={{ fontWeight: 700 }}>{t.author} · {t.location}</div>
              <div className="tiny muted">{'★'.repeat(t.rating)} — {t.quote}</div>
            </span>
            <span style={{ flex: 0.8 }}><button className="btn btn-ghost btn-sm" onClick={() => toggleFeatured(t)}>{t.featured ? 'Featured ✓' : 'Not featured'}</button></span>
            <span style={{ flex: 0.4, display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-danger btn-sm" onClick={() => remove(t.id)}>✕</button></span>
          </div>
        ))}
        {kind === 'faqs' && (rows as { id: string; question: string; answer: string; audience: string }[]).map((q) => (
          <div key={q.id} className="trow">
            <span style={{ flex: 2 }}>
              <div style={{ fontWeight: 700 }}>{q.question}</div>
              <div className="tiny muted">{q.answer}</div>
            </span>
            <span style={{ flex: 0.6 }} className="muted">{q.audience}</span>
            <span style={{ flex: 0.3, display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-danger btn-sm" onClick={() => remove(q.id)}>✕</button></span>
          </div>
        ))}
        {kind === 'policies' && (rows as { id: string; title: string; slug: string }[]).map((p) => (
          <div key={p.id} className="trow">
            <span style={{ flex: 1, fontWeight: 700 }}>{p.title}</span>
            <span style={{ flex: 1 }} className="tiny muted">/legal/{p.slug}</span>
            <span style={{ flex: 0.3, display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>✕</button></span>
          </div>
        ))}
      </div>
    </div>
  );
}
