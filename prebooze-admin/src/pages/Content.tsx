import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Tag } from '../components/ui';
import { GUEST_SITE_URL } from '../store/data';
import { liveBanners, liveBlogs, livePages, LiveApiError, type LiveBanner, type LiveBlog, type LiveSitePage } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';
import { ArrowRight, Pencil, X, CheckCircle2 } from 'lucide-react';

/** Shared page scaffold: title + "+ Add" button revealing an inline mini-form. */
function ContentPage({
  title,
  addLabel,
  placeholder,
  onAdd,
  children,
  footnote,
}: {
  title: string;
  addLabel: string;
  placeholder: string;
  onAdd: (value: string) => void;
  children: ReactNode;
  footnote: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [value, setValue] = useState('');

  return (
    <div className="stack fade" style={{ maxWidth: 800 }}>
      <div className="page-hd">
        <h1 className="page-title">{title}</h1>
        <button className="btn btn-pri" onClick={() => setShowForm((v) => !v)}>{addLabel}</button>
      </div>
      {showForm && (
        <form
          className="card"
          style={{ border: '1px solid var(--green)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!value.trim()) return;
            onAdd(value.trim());
            setValue('');
            setShowForm(false);
          }}
        >
          <input
            className="input"
            style={{ flex: 1, minWidth: 160 }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
          <button type="submit" className="btn btn-pri btn-sm">Add</button>
        </form>
      )}
      {children}
      <div className="tiny hint">{footnote}</div>
    </div>
  );
}

export function Banners() {
  const session = useLiveSession();
  const { token } = session;
  const navigate = useNavigate();
  const [banners, setBanners] = useState<LiveBanner[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveBanners.list().then(setBanners).catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load')).finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const gate = useLiveGate('Banners', session);
  if (gate) return gate;

  return (
    <div className="stack fade" style={{ maxWidth: 800 }}>
      <LiveHeaderBar title="Banners" session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}
      <div className="page-hd">
        <h1 className="page-title">Banners</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={GUEST_SITE_URL} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>Preview home <ArrowRight size={13} /></a>
          <Link to="/banners/new" className="btn btn-pri">+ Add banner</Link>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {banners.map((b) => (
          <button key={b.id} className="tblwrap" style={{ overflow: 'hidden', cursor: 'pointer', textAlign: 'left', padding: 0 }} onClick={() => navigate(`/banners/${b.id}/edit`)}>
            <div
              className="ph"
              style={{
                height: 76, border: 'none', borderRadius: 0, flexDirection: 'column', gap: 2,
                background: b.imageUrl ? `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)), url(${b.imageUrl})` : undefined,
                backgroundSize: 'cover', backgroundPosition: 'center',
              }}
            >
              <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 12.5, fontFamily: "'Space Grotesk',sans-serif" }}>{b.heading ?? 'banner 16:5'}</span>
              {b.ctaLabel && <span className="tiny green" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{b.ctaLabel} <ArrowRight size={10} /> {b.ctaLink}</span>}
            </div>
            <div style={{ padding: '8px 10px', fontSize: 11.5, display: 'flex', justifyContent: 'space-between', color: 'var(--text)' }}>
              <span>{b.title}</span>
              <span className="green" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{b.statusLabel} · <Pencil size={11} /></span>
            </div>
          </button>
        ))}
        {banners.length === 0 && !loading && <div className="card muted small">No banners yet.</div>}
      </div>
      <div className="tiny hint">click a banner to edit its image, heading, description and CTA link</div>
    </div>
  );
}

export function Blogs() {
  const session = useLiveSession();
  const { token } = session;
  const navigate = useNavigate();
  const [blogs, setBlogs] = useState<LiveBlog[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveBlogs.list().then(setBlogs).catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load')).finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const gate = useLiveGate('Blogs', session);
  if (gate) return gate;

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`Remove post "${title}"?`)) return;
    try { await liveBlogs.remove(id); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to remove'); }
  };

  const tagFor = (status: string) =>
    status === 'published' ? <Tag label="Published" cls="tag-green" /> : status === 'draft' ? <Tag label="Draft" cls="tag-red" /> : <Tag label="Scheduled" cls="" />;

  return (
    <div className="stack fade" style={{ maxWidth: 800 }}>
      <LiveHeaderBar title="Blogs" session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}
      <div className="page-hd">
        <h1 className="page-title">Blog posts</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/blogs/categories" className="btn btn-ghost btn-sm">Categories</Link>
          <Link to="/blogs/new" className="btn btn-pri">+ New post</Link>
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        {blogs.map((b) => (
          <button
            key={b.id}
            className="card"
            style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', fontSize: 12, cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}
            onClick={() => navigate(`/blogs/${b.id}/edit`)}
          >
            <div className="ph" style={{ width: 44, height: 28, borderRadius: 5, flex: 'none', fontSize: 7, background: b.bannerUrl ? `url(${b.bannerUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
              {!b.bannerUrl && 'cover'}
            </div>
            <span style={{ flex: 1 }}>
              <b>{b.title}</b>
              {b.category && <span className="tiny green"> · {b.category}</span>}
              <br />
              <span className="muted">{b.meta}</span>
            </span>
            {tagFor(b.status)}
            <span className="muted" style={{ display: 'flex' }}><Pencil size={13} /></span>
            <span className="btn btn-danger btn-sm" style={{ padding: '2px 7px', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => { e.stopPropagation(); remove(b.id, b.title); }}><X size={12} /></span>
          </button>
        ))}
        {blogs.length === 0 && !loading && <div className="card muted small">No posts yet.</div>}
      </div>
      <div className="tiny hint">click a post to edit — cover banner, category, content and SEO</div>
    </div>
  );
}

export function Pages() {
  const session = useLiveSession();
  const { token } = session;
  const [pages, setPages] = useState<LiveSitePage[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    livePages.list().then(setPages).catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load')).finally(() => setLoading(false));
  };
  useEffect(() => { if (token) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const gate = useLiveGate('Pages', session);
  if (gate) return gate;

  const addPage = async (title: string) => {
    try {
      await livePages.create({ title, slug: title.toLowerCase().replace(/\s+/g, '-') });
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to add page');
    }
  };
  const removePage = async (slug: string, title: string) => {
    if (!window.confirm(`Remove page "${title}"? Footer links to it will 404.`)) return;
    try { await livePages.remove(slug); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to remove'); }
  };

  return (
    <>
      <LiveHeaderBar title="Pages" session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)', maxWidth: 800 }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}
      <ContentPage
        title="Site pages"
        addLabel="+ New page"
        placeholder="Page title"
        onAdd={addPage}
        footnote="page editor: block-based (heading / text / image / FAQ / CTA) · new pages can be added to footer nav group ▾"
      >
        <div className="stack" style={{ gap: 6 }}>
          {pages.map((p) => (
            <Link
              key={p.slug}
              to={`/pages/${p.slug.replace(/^\//, '')}/edit`}
              className="card"
              style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', fontSize: 12.5, color: 'var(--text)' }}
            >
              <span style={{ flex: 1 }}>
                <b>{p.title}</b>
                {p.seo?.title && <span className="tiny green" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}> · SEO <CheckCircle2 size={10} /></span>}
              </span>
              <span className="muted">/{p.slug.replace(/^\//, '')}</span>
              <span className="muted" style={{ display: 'flex' }}><Pencil size={13} /></span>
              <span
                className="btn btn-danger btn-sm"
                style={{ padding: '2px 7px', display: 'inline-flex', alignItems: 'center' }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); removePage(p.slug, p.title); }}
              >
                <X size={12} />
              </span>
            </Link>
          ))}
          {pages.length === 0 && !loading && <div className="card muted small">No pages yet.</div>}
        </div>
      </ContentPage>
    </>
  );
}
