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
      addCategory({ icon, name: catName.trim(), count: 0, hasImage, imageDataUrl, seo });
    } else {
      updateCategory(existing!.name, { icon, name: catName.trim(), hasImage, imageDataUrl, seo });
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

      <SeoFields seo={seo} onChange={setSeo} slug={slug} fallbackTitle={`${catName || 'Category'} events`} />

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>{isCreate ? 'Create category' : 'Save category'}</button>
        <Link to="/categories" className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
