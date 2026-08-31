import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SeoFields, { emptySeo } from '../components/SeoFields';
import { liveCategories, liveMedia, LiveApiError, type LiveCategory } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';
import type { Seo } from '../types';
import CategoryIcon from '../components/CategoryIcon';
import { X, ArrowLeft, CheckCircle2 } from 'lucide-react';

const TITLE = 'Edit category';

/** Chip-based sub-category editor — same add/remove-tag pattern as the
 * venue amenities editor. */
function SubsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [custom, setCustom] = useState('');
  const add = () => {
    const v = custom.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setCustom('');
  };
  return (
    <div className="field">
      <label>Sub-categories</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {value.map((s) => (
          <span key={s} className="chip on" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {s}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== s))} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={12} /></button>
          </span>
        ))}
        {value.length === 0 && <span className="tiny muted">No sub-categories yet.</span>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="add a sub-category…"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={add}>+ Add</button>
      </div>
    </div>
  );
}

/** Add / edit an event category — icon, sub-categories, cover image and SEO
 * for its landing page. Real EventCategory row; the name is the primary
 * key so it can only be set at creation, not renamed here (no real rename
 * endpoint). */
export default function CategoryEdit() {
  const { name } = useParams();
  const isCreate = !name;
  const navigate = useNavigate();
  const session = useLiveSession();
  const { token } = session;

  const [existing, setExisting] = useState<LiveCategory | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const imgInputRef = useRef<HTMLInputElement>(null);

  const [catName, setCatName] = useState('');
  const [icon, setIcon] = useState('🏷');
  const [imageUrl, setImageUrl] = useState('');
  const [subs, setSubs] = useState<string[]>([]);
  const [seo, setSeo] = useState<Seo>(emptySeo());

  const load = () => {
    if (isCreate) return;
    setLoading(true);
    setErr('');
    liveCategories
      .list()
      .then((cats) => {
        const c = cats.find((x) => x.name === decodeURIComponent(name!));
        setExisting(c ?? null);
        if (c) {
          setCatName(c.name);
          setIcon(c.icon);
          setImageUrl(c.imageUrl ?? '');
          setSubs(c.subs ?? []);
          setSeo((c.seo as Seo | null) ?? emptySeo());
        }
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, name]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  if (!isCreate && !loading && !existing) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Category not found</h1>
        <Link to="/categories" className="btn btn-ghost" style={{ width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={13} /> Categories</Link>
      </div>
    );
  }
  if (!isCreate && !existing) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const onImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr('');
    try {
      const { url } = await liveMedia.upload(file);
      setImageUrl(url);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const slug = '/category/' + (catName || 'name').toLowerCase().replace(/\s+/g, '-');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) { setErr('Category name is required'); return; }
    try {
      if (isCreate) {
        await liveCategories.add(catName.trim(), icon);
        await liveCategories.update(catName.trim(), { imageUrl: imageUrl || undefined, seo, subs });
      } else {
        await liveCategories.update(existing!.name, { icon, imageUrl: imageUrl || undefined, seo, subs });
      }
      navigate('/categories');
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to save');
    }
  };

  return (
    <form className="stack fade" style={{ maxWidth: 600, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/categories" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={13} /> Categories</Link>
        <h1 className="page-title">{isCreate ? 'Add category' : `Edit category — ${existing!.name}`}</h1>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="field">
          <label>Category name</label>
          <input className="input" value={catName} onChange={(e) => setCatName(e.target.value)} autoFocus={isCreate} disabled={!isCreate} />
          {!isCreate && <span className="tiny hint">name can't be changed after creation</span>}
        </div>
        <div className="field">
          <label>Icon — shown on the home filter chip</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CategoryIcon name={catName || 'New category'} size={20} />
            <span className="tiny hint">Auto-assigned from the category name — no need to pick one.</span>
          </div>
        </div>
        <input ref={imgInputRef} type="file" accept="image/*" onChange={onImageFile} style={{ display: 'none' }} />
        {imageUrl ? (
          <button type="button" className="ph" style={{ height: 72, width: '100%', cursor: 'pointer', backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} onClick={() => imgInputRef.current?.click()}>
            <span className="tiny" style={{ margin: 'auto', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> cover image uploaded — click to replace</span>
          </button>
        ) : (
          <button type="button" className="ph" style={{ height: 72, width: '100%', cursor: 'pointer' }} disabled={uploading} onClick={() => imgInputRef.current?.click()}>
            {uploading ? 'Uploading…' : '+ upload cover image 16:5 — shown on the category landing page'}
          </button>
        )}
        <div className="tiny hint">category = browse filter chip + facet + SEO landing page at {slug}</div>
      </div>

      <div className="card">
        <SubsEditor value={subs} onChange={setSubs} />
        <div className="tiny hint">sub-categories show as filter chips under this category on the guest browse page + are pickable when organizers create an event</div>
      </div>

      <SeoFields seo={seo} onChange={setSeo} slug={slug} fallbackTitle={`${catName || 'Category'} events`} />

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>{isCreate ? 'Create category' : 'Save category'}</button>
        <Link to="/categories" className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
