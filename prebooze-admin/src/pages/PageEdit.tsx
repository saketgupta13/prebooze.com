import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import SeoFields, { emptySeo } from '../components/SeoFields';

export default function PageEdit() {
  const { pid } = useParams(); // slug without the leading slash
  const navigate = useNavigate();
  const { pages, updatePage, toast } = useAdmin();
  const page = pages.find((p) => p.slug.replace(/^\//, '') === pid);

  const [title, setTitle] = useState(page?.title ?? '');
  const [slug, setSlug] = useState(page?.slug ?? '');
  const [navGroup, setNavGroup] = useState(page?.navGroup ?? 'Company');
  const [content, setContent] = useState(
    page?.content ?? 'Heading block\n\nText block — write the page copy here…\n\n[CTA block: Browse events → /browse]'
  );
  const [seo, setSeo] = useState(page?.seo ?? emptySeo());

  if (!page) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Page not found</h1>
        <Link to="/pages" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Pages</Link>
      </div>
    );
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) {
      toast('Title and slug are required');
      return;
    }
    updatePage(page.slug, {
      title: title.trim(),
      slug: slug.startsWith('/') ? slug : '/' + slug,
      navGroup,
      content,
      seo,
    });
    navigate('/pages');
  };

  return (
    <form className="stack fade" style={{ maxWidth: 640, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/pages" style={{ fontSize: 13 }}>← Pages</Link>
        <h1 className="page-title">Edit page — {page.title}</h1>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1.4 }}>
            <label>Page title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>URL slug</label>
            <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} />
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
          <label>Content — block-based (heading / text / image / FAQ / CTA)</label>
          <textarea className="input" style={{ minHeight: 160, resize: 'vertical' }} value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
      </div>

      <SeoFields seo={seo} onChange={setSeo} slug={slug.startsWith('/') ? slug : '/' + slug} fallbackTitle={title || page.title} />

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>Save page</button>
        <Link to="/pages" className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
