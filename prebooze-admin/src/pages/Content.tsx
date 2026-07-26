import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { Tag } from '../components/ui';
import { GUEST_SITE_URL } from '../store/data';

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
  const { banners } = useAdmin();
  const navigate = useNavigate();
  return (
    <div className="stack fade" style={{ maxWidth: 800 }}>
      <div className="page-hd">
        <h1 className="page-title">Banners</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={GUEST_SITE_URL} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Preview home →</a>
          <Link to="/banners/new" className="btn btn-pri">+ Add banner</Link>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {banners.map((b) => (
          <button key={b.id} className="tblwrap" style={{ overflow: 'hidden', cursor: 'pointer', textAlign: 'left', padding: 0 }} onClick={() => navigate(`/banners/${b.id}/edit`)}>
            <div
              className="ph"
              style={{ height: 76, border: 'none', borderRadius: 0, flexDirection: 'column', gap: 2, background: b.hasImage ? 'linear-gradient(120deg, rgba(139,195,74,.22), rgba(139,195,74,.05))' : undefined }}
            >
              <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 12.5, fontFamily: "'Space Grotesk',sans-serif" }}>{b.heading ?? 'banner 16:5'}</span>
              {b.ctaLabel && <span className="tiny green">{b.ctaLabel} → {b.ctaLink}</span>}
            </div>
            <div style={{ padding: '8px 10px', fontSize: 11.5, display: 'flex', justifyContent: 'space-between', color: 'var(--text)' }}>
              <span>{b.title}</span>
              <span className="green">{b.statusLabel} · ✎</span>
            </div>
          </button>
        ))}
      </div>
      <div className="tiny hint">click a banner to edit its image, heading, description and CTA link</div>
    </div>
  );
}

export function Blogs() {
  const { blogs, removeBlog } = useAdmin();
  const navigate = useNavigate();
  const tagFor = (status: string) =>
    status === 'published' ? (
      <Tag label="Published" cls="tag-green" />
    ) : status === 'draft' ? (
      <Tag label="Draft" cls="tag-red" />
    ) : (
      <Tag label="Scheduled" cls="" />
    );
  return (
    <div className="stack fade" style={{ maxWidth: 800 }}>
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
            <div className="ph" style={{ width: 44, height: 28, borderRadius: 5, flex: 'none', fontSize: 7, background: b.hasBanner ? 'linear-gradient(120deg, rgba(139,195,74,.25), rgba(139,195,74,.06))' : undefined }}>
              {b.hasBanner ? '✓' : 'cover'}
            </div>
            <span style={{ flex: 1 }}>
              <b>{b.title}</b>
              {b.category && <span className="tiny green"> · {b.category}</span>}
              <br />
              <span className="muted">{b.meta}</span>
            </span>
            {tagFor(b.status)}
            <span className="muted">✎</span>
            <span
              className="btn btn-danger btn-sm"
              style={{ padding: '2px 7px' }}
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Remove post "${b.title}"?`)) removeBlog(b.id);
              }}
            >
              ✕
            </span>
          </button>
        ))}
      </div>
      <div className="tiny hint">click a post to edit — cover banner, category, content and SEO</div>
    </div>
  );
}

export function Pages() {
  const { pages, addPage, removePage } = useAdmin();
  return (
    <ContentPage
      title="Site pages"
      addLabel="+ New page"
      placeholder="Page title"
      onAdd={(title) => addPage({ title, slug: '/' + title.toLowerCase().replace(/\s+/g, '-') })}
      footnote="page editor: block-based (heading / text / image / FAQ / CTA) · new pages can be added to footer nav group ▾"
    >
      <div className="stack" style={{ gap: 6 }}>
        {pages.map((p, i) => (
          <Link
            key={p.slug + i}
            to={`/pages/${p.slug.replace(/^\//, '')}/edit`}
            className="card"
            style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', fontSize: 12.5, color: 'var(--text)' }}
          >
            <span style={{ flex: 1 }}>
              <b>{p.title}</b>
              {p.seo?.title && <span className="tiny green"> · SEO ✓</span>}
            </span>
            <span className="muted">{p.slug}</span>
            <span className="muted">✎</span>
            <span
              className="btn btn-danger btn-sm"
              style={{ padding: '2px 7px' }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.confirm(`Remove page "${p.title}"? Footer links to it will 404.`)) removePage(p.slug);
              }}
            >
              ✕
            </span>
          </Link>
        ))}
      </div>
    </ContentPage>
  );
}
