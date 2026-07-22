import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import SeoFields, { emptySeo } from '../components/SeoFields';
import { ImagePicker } from '../components/ui';
import { stripHtml } from '../store/data';
import WysiwygEditor from '../components/WysiwygEditor';

/** Create / edit a blog post — cover banner, title, category, content and SEO. */
export function BlogEditor() {
  const { id } = useParams(); // undefined = create
  const isCreate = !id;
  const navigate = useNavigate();
  const { blogs, blogCategories, addBlog, updateBlog, toast } = useAdmin();
  const existing = isCreate ? undefined : blogs.find((b) => b.id === id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState(existing?.category ?? blogCategories[0]?.name ?? 'City guide');
  const [bannerDataUrl, setBannerDataUrl] = useState(existing?.bannerDataUrl ?? '');
  const hasBanner = !!bannerDataUrl;
  const [content, setContent] = useState(existing?.content ?? '');
  const [status, setStatus] = useState(existing?.status ?? 'draft');
  const [seo, setSeo] = useState(existing?.seo ?? emptySeo());

  if (!isCreate && !existing) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Post not found</h1>
        <Link to="/blogs" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Blog posts</Link>
      </div>
    );
  }

  const slug = '/blog/' + (title || 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast('Post title is required');
      return;
    }
    if (!hasBanner) {
      toast('Every post needs a cover banner — upload one first');
      return;
    }
    if (!content.trim()) {
      toast('Write some content before saving');
      return;
    }
    const patch = {
      title: title.trim(),
      category,
      hasBanner,
      bannerDataUrl,
      content,
      status,
      seo,
      meta: `by You · ${status === 'published' ? 'just published' : status} · ${category}`,
    };
    if (isCreate) addBlog({ id: 'bl' + Date.now(), ...patch });
    else updateBlog(existing!.id, patch);
    navigate('/blogs');
  };

  return (
    <form className="stack fade" style={{ maxWidth: 680, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/blogs" style={{ fontSize: 13 }}>← Blog posts</Link>
        <h1 className="page-title">{isCreate ? 'New blog post' : `Edit — ${existing!.title}`}</h1>
        <div style={{ flex: 1 }} />
        <Link to="/blogs/categories" className="btn btn-ghost btn-sm">Manage categories</Link>
      </div>

      {/* Cover banner (required) */}
      <ImagePicker
        value={bannerDataUrl}
        onChange={setBannerDataUrl}
        aspectRatio="16 / 6"
        label="⬆ upload cover banner · 16:6 · required for every post"
      >
        <span className="tiny" style={{ margin: 'auto', color: '#fff' }}>✓ cover banner uploaded (16:6) — click to replace</span>
      </ImagePicker>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="field">
          <label>Post title</label>
          <input className="input" style={{ fontSize: 16, fontWeight: 700 }} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={isCreate} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Blog category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {blogCategories.map((c) => (
                <option key={c.id}>{c.name}</option>
              ))}
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
  const { blogCategories, blogs, addBlogCategory, toast } = useAdmin();
  const [name, setName] = useState('');
  const [bannerDataUrl, setBannerDataUrl] = useState('');
  const hasBanner = !!bannerDataUrl;
  const [seo, setSeo] = useState(emptySeo());

  const slug = '/blog/category/' + (name || 'name').toLowerCase().replace(/\s+/g, '-');

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Category name is required');
      return;
    }
    if (blogCategories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
      toast('That blog category already exists');
      return;
    }
    addBlogCategory({ id: 'bc' + Date.now(), name: name.trim(), hasBanner, bannerDataUrl, seo });
    setName('');
    setBannerDataUrl('');
    setSeo(emptySeo());
  };

  return (
    <div className="stack fade" style={{ maxWidth: 640, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/blogs" style={{ fontSize: 13 }}>← Blog posts</Link>
        <h1 className="page-title">Blog categories</h1>
      </div>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 380 }}>
          <span style={{ flex: 1.6 }}>Category</span>
          <span style={{ flex: 1 }}>Posts</span>
          <span style={{ flex: 1 }}>Banner</span>
          <span style={{ flex: 1 }}>SEO</span>
        </div>
        {blogCategories.map((c) => (
          <div key={c.id} className="trow" style={{ minWidth: 380 }}>
            <span style={{ flex: 1.6, fontWeight: 700 }}>{c.name}</span>
            <span style={{ flex: 1 }}>{blogs.filter((b) => b.category === c.name).length}</span>
            <span style={{ flex: 1 }} className={c.hasBanner ? 'green' : 'hint'}>{c.hasBanner ? '✓ set' : '—'}</span>
            <span style={{ flex: 1 }} className={c.seo?.title ? 'green' : 'hint'}>{c.seo?.title ? '✓ set' : '—'}</span>
          </div>
        ))}
      </div>

      <form className="card" style={{ border: '1px solid var(--green)', display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={create}>
        <div className="display" style={{ fontWeight: 700 }}>New blog category</div>
        <div className="field">
          <label>Category name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nightlife tips" />
        </div>
        <ImagePicker value={bannerDataUrl} onChange={setBannerDataUrl} aspectRatio="16 / 5" height={60} label="+ upload category banner 16:5 — tops the category page">
          <span className="tiny" style={{ margin: 'auto', color: '#fff' }}>✓ category banner uploaded (16:5)</span>
        </ImagePicker>
        <SeoFields seo={seo} onChange={setSeo} slug={slug} fallbackTitle={`${name || 'Category'} — Prebooze Blog`} />
        <button type="submit" className="btn btn-pri" style={{ alignSelf: 'flex-start' }}>Create category</button>
      </form>
    </div>
  );
}
