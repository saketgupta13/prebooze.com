import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SeoFields, { emptySeo } from '../components/SeoFields';
import WysiwygEditor from '../components/WysiwygEditor';
import { livePages, LiveApiError, type LiveSitePage } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';
import type { Seo } from '../types';

const TITLE = 'Edit page';
const DEFAULT_CONTENT = '<h2>Heading block</h2><p>Text block — write the page copy here…</p><p><a href="/browse">Browse events →</a></p>';

export default function PageEdit() {
  const { pid } = useParams();
  const navigate = useNavigate();
  const session = useLiveSession();
  const { token } = session;

  const [page, setPage] = useState<LiveSitePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [navGroup, setNavGroup] = useState('Company');
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [seo, setSeo] = useState<Seo>(emptySeo());

  const load = () => {
    setLoading(true);
    setErr('');
    livePages
      .list()
      .then((pages) => {
        const p = pages.find((x) => x.slug.replace(/^\//, '') === pid);
        setPage(p ?? null);
        if (p) {
          setTitle(p.title);
          setSlug(p.slug);
          setNavGroup(p.navGroup ?? 'Company');
          setContent(p.content ?? DEFAULT_CONTENT);
          setSeo((p.seo as Seo | null) ?? emptySeo());
        }
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, pid]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  if (!loading && !page) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Page not found</h1>
        <Link to="/pages" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Pages</Link>
      </div>
    );
  }
  if (!page) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) { setErr('Title and slug are required'); return; }
    try {
      await livePages.update(page.slug, {
        title: title.trim(),
        navGroup,
        content,
        seo,
      });
      navigate('/pages');
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to save');
    }
  };

  return (
    <form className="stack fade" style={{ maxWidth: 640, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/pages" style={{ fontSize: 13 }}>← Pages</Link>
        <h1 className="page-title">Edit page — {page.title}</h1>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1.4 }}>
            <label>Page title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>URL slug</label>
            <input className="input" value={slug} disabled title="slug can't be changed after creation" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Footer nav group</label>
            <select className="input" value={navGroup} onChange={(e) => setNavGroup(e.target.value)}>
              <option>Company</option>
              <option>Support</option>
              <option>Explore</option>
              <option value="none">— not in nav</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Content</label>
          <WysiwygEditor value={content} onChange={setContent} minHeight={160} />
        </div>
      </div>

      <SeoFields seo={seo} onChange={setSeo} slug={'/' + slug.replace(/^\//, '')} fallbackTitle={title || page.title} />

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>Save page</button>
        <Link to="/pages" className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
