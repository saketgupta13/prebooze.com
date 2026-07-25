import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import SeoFields, { emptySeo } from '../components/SeoFields';
import { ImagePicker } from '../components/ui';

const ICONS = ['🎵', '😂', '🎪', '🏠', '🎤', '🎧', '🍷', '⚽', '🎭', '🏷'];

/** Add / edit an event category — icon, cover image and SEO for its landing page. */
export default function CategoryEdit() {
  const { name } = useParams(); // undefined = create mode
  const isCreate = !name;
  const navigate = useNavigate();
  const { categories, addCategory, updateCategory, toast } = useAdmin();
  const existing = isCreate ? undefined : categories.find((c) => c.name === decodeURIComponent(name!));

  const [catName, setCatName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '🏷');
  const [imageDataUrl, setImageDataUrl] = useState(existing?.imageDataUrl ?? '');
  const hasImage = !!imageDataUrl;
  const [seo, setSeo] = useState(existing?.seo ?? emptySeo());
  const [subCategories, setSubCategories] = useState<string[]>(existing?.subCategories ?? []);
  const [newSub, setNewSub] = useState('');

  const addSub = () => {
    const s = newSub.trim();
    if (!s) return;
    if (subCategories.some((x) => x.toLowerCase() === s.toLowerCase())) {
      toast(`"${s}" already exists`);
      return;
    }
    setSubCategories((prev) => [...prev, s]);
    setNewSub('');
  };
  const removeSub = (s: string) => setSubCategories((prev) => prev.filter((x) => x !== s));
  const moveSub = (i: number, dir: -1 | 1) => {
    setSubCategories((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return next;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  if (!isCreate && !existing) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Category not found</h1>
        <Link to="/categories" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Categories</Link>
      </div>
    );
  }

  const slug = '/category/' + (catName || 'name').toLowerCase().replace(/\s+/g, '-');

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      toast('Category name is required');
      return;
    }
    if (isCreate && categories.some((c) => c.name.toLowerCase() === catName.trim().toLowerCase())) {
      toast('That category already exists');
      return;
    }
    if (isCreate) {
      addCategory({ icon, name: catName.trim(), count: 0, subCategories, hasImage, imageDataUrl, seo });
    } else {
      updateCategory(existing!.name, { icon, name: catName.trim(), subCategories, hasImage, imageDataUrl, seo });
    }
    navigate('/categories');
  };

  return (
    <form className="stack fade" style={{ maxWidth: 600, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/categories" style={{ fontSize: 13 }}>← Categories</Link>
        <h1 className="page-title">{isCreate ? 'Add category' : `Edit category — ${existing!.name}`}</h1>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="field">
          <label>Category name</label>
          <input className="input" value={catName} onChange={(e) => setCatName(e.target.value)} autoFocus={isCreate} />
        </div>
        <div className="field">
          <label>Icon — shown on the home filter chip</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                className={`chip ${icon === i ? 'on' : ''}`}
                style={{ fontSize: 16, padding: '4px 10px' }}
                onClick={() => setIcon(i)}
              >
                {i}
              </button>
            ))}
            <input
              className="input"
              style={{ width: 70, textAlign: 'center' }}
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={4}
              title="or type any emoji"
            />
          </div>
        </div>
        <ImagePicker
          value={imageDataUrl}
          onChange={setImageDataUrl}
          height={72}
          label="+ upload cover image 16:5 — shown on the category landing page"
        >
          <span className="tiny" style={{ margin: 'auto', color: '#fff' }}>✓ cover image 16:5 uploaded — click to replace</span>
        </ImagePicker>
        <div className="tiny hint">category = browse filter chip + facet + SEO landing page at {slug}</div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="field">
          <label>Sub-categories</label>
          {subCategories.length === 0 ? (
            <div className="tiny muted">No sub-categories yet — add one below.</div>
          ) : (
            <div className="stack" style={{ gap: 4 }}>
              {subCategories.map((s, i) => (
                <div key={s} className="trow" style={{ padding: '6px 10px', gap: 6 }}>
                  <span className="muted tiny" style={{ width: 18 }}>{i + 1}</span>
                  <span style={{ flex: 1 }}>{s}</span>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 7px' }} disabled={i === 0} onClick={() => moveSub(i, -1)} title="Move up">↑</button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 7px' }} disabled={i === subCategories.length - 1} onClick={() => moveSub(i, 1)} title="Move down">↓</button>
                  <button type="button" className="btn btn-danger btn-sm" style={{ padding: '2px 7px' }} onClick={() => removeSub(s)}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }}
              placeholder="e.g. Techno, Stand-up, Sundowner…"
            />
            <button type="button" className="btn btn-pri btn-sm" onClick={addSub}>+ Add</button>
          </div>
          <div className="tiny hint" style={{ marginTop: 4 }}>drives the sub-category picker in event creation step 1 — order here is the order shown there</div>
        </div>
      </div>

      <SeoFields seo={seo} onChange={setSeo} slug={slug} fallbackTitle={`${catName || 'Category'} events`} />

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>{isCreate ? 'Create category' : 'Save category'}</button>
        <Link to="/categories" className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
