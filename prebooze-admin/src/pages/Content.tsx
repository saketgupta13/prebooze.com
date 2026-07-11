import { useState } from 'react';
import type { ReactNode } from 'react';
import { useAdmin } from '../store/AdminContext';
import { Tag } from '../components/ui';

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
  const { banners, addBanner, toast } = useAdmin();
  return (
    <ContentPage
      title="Banners"
      addLabel="+ Add banner"
      placeholder="Banner title / campaign"
      onAdd={(title) => addBanner({ title, statusLabel: 'Scheduled' })}
      footnote="banner editor: image 16:5, link target (event / page / URL), schedule start–end, city targeting"
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => toast('Opening guest home preview…')}>Preview home →</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        {banners.map((b, i) => (
          <div key={b.title + i} className="tblwrap" style={{ overflow: 'hidden' }}>
            <div className="ph" style={{ height: 70, border: 'none', borderRadius: 0 }}>banner 16:5</div>
            <div style={{ padding: '8px 10px', fontSize: 11.5, display: 'flex', justifyContent: 'space-between' }}>
              <span>{b.title}</span>
              <span className="green">{b.statusLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </ContentPage>
  );
}

export function Categories() {
  const { categories, addCategory } = useAdmin();
  return (
    <ContentPage
      title="Categories"
      addLabel="+ Add category"
      placeholder="Category name"
      onAdd={(name) => addCategory({ icon: '🏷', name, count: 0 })}
      footnote="category = browse filter chip + facet + slug for SEO landing page · drag sets chip order on home"
    >
      <div className="stack" style={{ gap: 6 }}>
        {categories.map((c, i) => (
          <div key={c.name + i} className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', fontSize: 12.5 }}>
            <span className="muted">⠿</span>
            <span style={{ flex: 1 }}>
              {c.icon} <b>{c.name}</b> · {c.count} events
            </span>
            {c.count === 0 ? <Tag label="Hidden" cls="tag-dim" /> : <Tag label="Visible" cls="tag-green" />}
          </div>
        ))}
      </div>
    </ContentPage>
  );
}

export function Blogs() {
  const { blogs, addBlog } = useAdmin();
  const tagFor = (status: string) =>
    status === 'published' ? (
      <Tag label="Published" cls="tag-green" />
    ) : status === 'draft' ? (
      <Tag label="Draft" cls="tag-red" />
    ) : (
      <Tag label="Scheduled" cls="" />
    );
  return (
    <ContentPage
      title="Blog posts"
      addLabel="+ New post"
      placeholder="Post title"
      onAdd={(title) => addBlog({ title, meta: 'by You · just now', status: 'draft' })}
      footnote="post editor: cover, rich text, embed event cards, slug, meta title/description, OG image, publish or schedule"
    >
      <div className="stack" style={{ gap: 6 }}>
        {blogs.map((b, i) => (
          <div key={b.title + i} className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', fontSize: 12 }}>
            <div className="ph" style={{ width: 44, height: 28, borderRadius: 5, flex: 'none', fontSize: 7 }}>cover</div>
            <span style={{ flex: 1 }}>
              <b>{b.title}</b>
              <br />
              <span className="muted">{b.meta}</span>
            </span>
            {tagFor(b.status)}
          </div>
        ))}
      </div>
    </ContentPage>
  );
}

export function Pages() {
  const { pages, addPage } = useAdmin();
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
          <div key={p.slug + i} className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', fontSize: 12.5 }}>
            <span style={{ flex: 1 }}><b>{p.title}</b></span>
            <span className="muted">{p.slug}</span>
          </div>
        ))}
      </div>
    </ContentPage>
  );
}

export function Staff() {
  const { staff, addStaff } = useAdmin();
  return (
    <ContentPage
      title="Staff & roles"
      addLabel="+ Invite staff"
      placeholder="email@prebooze.com"
      onAdd={(email) => addStaff({ name: email, role: 'Support', lastActive: 'invited' })}
      footnote="roles: Owner · Manager · Finance · Content · Support · Scanner only — custom roles supported"
    >
      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 400 }}>
          <span style={{ flex: 1.6 }}>Member</span>
          <span style={{ flex: 1.2 }}>Role</span>
          <span style={{ flex: 1 }}>Last active</span>
        </div>
        {staff.map((s, i) => (
          <div key={s.name + i} className="trow" style={{ minWidth: 400 }}>
            <span style={{ flex: 1.6, fontWeight: 700 }}>{s.name}</span>
            <span style={{ flex: 1.2 }}>
              <Tag label={s.role} cls={s.role === 'Owner' ? 'tag-green' : ''} />
            </span>
            <span style={{ flex: 1 }} className="muted">{s.lastActive}</span>
          </div>
        ))}
      </div>
      <div className="card" style={{ fontSize: 11, padding: 12 }}>
        <div className="display" style={{ fontWeight: 700, marginBottom: 6, fontSize: 12.5 }}>Role: Finance — permissions</div>
        <div className="thead" style={{ padding: '6px 0' }}>
          <span style={{ flex: 2 }}>Module</span>
          <span style={{ flex: 1, textAlign: 'center' }}>View</span>
          <span style={{ flex: 1, textAlign: 'center' }}>Edit</span>
          <span style={{ flex: 1, textAlign: 'center' }}>Approve</span>
        </div>
        {[
          ['Payments & payouts', '✓', '✓', '✓'],
          ['Refunds', '✓', '✓', '✓'],
          ['Event commission (per event)', '✓', '✓', '✗'],
          ['Events / content / users', '✓', '✗', '✗'],
        ].map(([m, v, e, a]) => (
          <div key={m} className="trow" style={{ padding: '7px 0' }}>
            <span style={{ flex: 2 }}>{m}</span>
            <span style={{ flex: 1, textAlign: 'center' }} className={v === '✓' ? 'green' : 'hint'}>{v}</span>
            <span style={{ flex: 1, textAlign: 'center' }} className={e === '✓' ? 'green' : 'hint'}>{e}</span>
            <span style={{ flex: 1, textAlign: 'center' }} className={a === '✓' ? 'green' : 'hint'}>{a}</span>
          </div>
        ))}
      </div>
    </ContentPage>
  );
}
