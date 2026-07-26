import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SeoFields, { emptySeo } from '../components/SeoFields';
import WysiwygEditor from '../components/WysiwygEditor';
import { stripHtml } from '../store/data';
import { liveBlogs, liveBlogCategories, liveMedia, LiveApiError, type LiveBlog, type LiveBlogCategory } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';
import type { Seo } from '../types';

const TITLE = 'Edit blog post';

/** Create / edit a blog post — cover banner, title, category, content and
 * SEO. Real Blog row; the cover banner is a genuine upload. */
export function BlogEditor() {
  const { id } = useParams();
  const isCreate = !id;
  const navigate = useNavigate();
  const session = useLiveSession();
  const { token } = session;

  const [existing, setExisting] = useState<LiveBlog | null>(null);
  const [categories, setCategories] = useState<LiveBlogCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'scheduled'>('draft');
  const [seo, setSeo] = useState<Seo>(emptySeo());

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveBlogs.list(), liveBlogCategories.list()])
      .then(([blogs, cats]) => {
        setCategories(cats);
        if (!isCreate) {
          const b = blogs.find((x) => x.id === id);
          setExisting(b ?? null);
          if (b) {
            setTitle(b.title);
            setCategory(b.category ?? cats[0]?.name ?? '');
            setBannerUrl(b.bannerUrl ?? '');
            setContent(b.content ?? '');
            setStatus(b.status as 'draft' | 'published' | 'scheduled');
            setSeo((b.seo as Seo | null) ?? emptySeo());
          }
        } else if (!category && cats[0]) {
          setCategory(cats[0].name);
        }
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  if (!isCreate && !loading && !existing) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Post not found</h1>
        <Link to="/blogs" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Blog posts</Link>
      </div>
    );
  }
  if (!isCreate && !existing) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const slug = '/blog/' + (title || 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const onBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr('');
    try {
      const { url } = await liveMedia.upload(file);
      setBannerUrl(url);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setErr('Post title is required'); return; }
    if (!bannerUrl) { setErr('Every post needs a cover banner — upload one first'); return; }
    if (!content.trim()) { setErr('Write some content before saving'); return; }
    const patch = {
      title: title.trim(),
      category,
      bannerUrl,
      content,
      status,
      seo,
      meta: `${status === 'published' ? 'just published' : status} · ${category}`,
    };
    try {
      if (isCreate) await liveBlogs.create(patch);
      else await liveBlogs.update(existing!.id, patch);
      navigate('/blogs');
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to save');
    }
  };

  return (
    <form className="stack fade" style={{ maxWidth: 680, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/blogs" style={{ fontSize: 13 }}>← Blog posts</Link>
        <h1 className="page-title">{isCreate ? 'New blog post' : `Edit — ${existing!.title}`}</h1>
        <div style={{ flex: 1 }} />
        <Link to="/blogs/categories" className="btn btn-ghost btn-sm">Manage categories</Link>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <input ref={bannerInputRef} type="file" accept="image/*" onChange={onBannerFile} style={{ display: 'none' }} />
      <button
        type="button"
        className="ph"
        style={{
          aspectRatio: '16 / 6', width: '100%', cursor: 'pointer',
          backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center',
        }}
        onClick={() => bannerInputRef.current?.click()}
        disabled={uploading}
      >
        {bannerUrl ? (
          <span className="tiny" style={{ margin: 'auto', color: '#fff' }}>✓ cover banner uploaded (16:6) — click to replace</span>
        ) : (
          <span>{uploading ? 'Uploading…' : '⬆ upload cover banner · 16:6 · required for every post'}</span>
        )}
      </button>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="field">
          <label>Post title</label>
          <input className="input" style={{ fontSize: 16, fontWeight: 700 }} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={isCreate} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Blog category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Content — rich text (embed event cards with [event: slug])</label>
          <WysiwygEditor value={content} onChange={setContent} minHeight={220} />
        </div>
        <div className="tiny hint">{stripHtml(content).trim().split(/\s+/).filter(Boolean).length} words · ~{Math.max(1, Math.round(stripHtml(content).trim().split(/\s+/).filter(Boolean).length / 200))} min read</div>
      </div>

      <SeoFields seo={seo} onChange={setSeo} slug={slug} fallbackTitle={title || 'Blog post'} />

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>
          {status === 'published' ? 'Save & publish ✓' : status === 'scheduled' ? 'Save & schedule' : 'Save draft'}
        </button>
        <Link to="/blogs" className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}

/** Blog categories manager — each with its own banner and SEO for the category page. */
export function BlogCategories() {
  const session = useLiveSession();
  const { token } = session;
  const [categories, setCategories] = useState<LiveBlogCategory[]>([]);
  const [blogs, setBlogs] = useState<LiveBlog[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [name, setName] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [seo, setSeo] = useState<Seo>(emptySeo());
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveBlogCategories.list(), liveBlogs.list()])
      .then(([cats, bl]) => { setCategories(cats); setBlogs(bl); })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const gate = useLiveGate('Blog categories', session);
  if (gate) return gate;

  const slug = '/blog/category/' + (name || 'name').toLowerCase().replace(/\s+/g, '-');

  const onBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr('');
    try {
      const { url } = await liveMedia.upload(file);
      setBannerUrl(url);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Category name is required'); return; }
    if (categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) { setErr('That blog category already exists'); return; }
    try {
      await liveBlogCategories.create({ name: name.trim(), bannerUrl: bannerUrl || undefined, seo });
      setName(''); setBannerUrl(''); setSeo(emptySeo());
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to create category');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 640, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/blogs" style={{ fontSize: 13 }}>← Blog posts</Link>
        <h1 className="page-title">Blog categories</h1>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 380 }}>
          <span style={{ flex: 1.6 }}>Category</span>
          <span style={{ flex: 1 }}>Posts</span>
          <span style={{ flex: 1 }}>Banner</span>
          <span style={{ flex: 1 }}>SEO</span>
        </div>
        {categories.map((c) => (
          <div key={c.id} className="trow" style={{ minWidth: 380 }}>
            <span style={{ flex: 1.6, fontWeight: 700 }}>{c.name}</span>
            <span style={{ flex: 1 }}>{blogs.filter((b) => b.category === c.name).length}</span>
            <span style={{ flex: 1 }} className={c.bannerUrl ? 'green' : 'hint'}>{c.bannerUrl ? '✓ set' : '—'}</span>
            <span style={{ flex: 1 }} className={c.seo?.title ? 'green' : 'hint'}>{c.seo?.title ? '✓ set' : '—'}</span>
          </div>
        ))}
        {categories.length === 0 && !loading && <div className="trow muted">No categories yet.</div>}
      </div>

      <form className="card" style={{ border: '1px solid var(--green)', display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={create}>
        <div className="display" style={{ fontWeight: 700 }}>New blog category</div>
        <div className="field">
          <label>Category name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nightlife tips" />
        </div>
        <input ref={bannerInputRef} type="file" accept="image/*" onChange={onBannerFile} style={{ display: 'none' }} />
        <button type="button" className="ph" style={{ height: 60, width: '100%', cursor: 'pointer', backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} disabled={uploading} onClick={() => bannerInputRef.current?.click()}>
          {bannerUrl ? <span className="tiny" style={{ margin: 'auto', color: '#fff' }}>✓ category banner uploaded (16:5)</span> : (uploading ? 'Uploading…' : '+ upload category banner 16:5 — tops the category page')}
        </button>
        <SeoFields seo={seo} onChange={setSeo} slug={slug} fallbackTitle={`${name || 'Category'} — Prebooze Blog`} />
        <button type="submit" className="btn btn-pri" style={{ alignSelf: 'flex-start' }}>Create category</button>
      </form>
    </div>
  );
}
