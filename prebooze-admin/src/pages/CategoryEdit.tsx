import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SeoFields, { emptySeo } from '../components/SeoFields';
import { liveCategories, liveMedia, LiveApiError, type LiveCategory } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';
import type { Seo } from '../types';

const TITLE = 'Edit category';
const ICONS = ['🎵', '😂', '🎪', '🏠', '🎤', '🎧', '🍷', '⚽', '🎭', '🏷'];

/** Add / edit an event category — icon, cover image and SEO for its landing
 * page. Real EventCategory row; the name is the primary key so it can only
 * be set at creation, not renamed here (no real rename endpoint). The
 * mock's "sub-categories" list has no backing field on the real model,
 * dropped rather than faked. */
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
        <Link to="/categories" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Categories</Link>
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
        await liveCategories.update(catName.trim(), { imageUrl: imageUrl || undefined, seo });
      } else {
        await liveCategories.update(existing!.name, { icon, imageUrl: imageUrl || undefined, seo });
      }
      navigate('/categories');
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to save');
    }
  };

  return (
    <form className="stack fade" style={{ maxWidth: 600, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/categories" style={{ fontSize: 13 }}>← Categories</Link>
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
        <input ref={imgInputRef} type="file" accept="image/*" onChange={onImageFile} style={{ display: 'none' }} />
        {imageUrl ? (
          <button type="button" className="ph" style={{ height: 72, width: '100%', cursor: 'pointer', backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} onClick={() => imgInputRef.current?.click()}>
            <span className="tiny" style={{ margin: 'auto', color: '#fff' }}>✓ cover image uploaded — click to replace</span>
          </button>
        ) : (
          <button type="button" className="ph" style={{ height: 72, width: '100%', cursor: 'pointer' }} disabled={uploading} onClick={() => imgInputRef.current?.click()}>
            {uploading ? 'Uploading…' : '+ upload cover image 16:5 — shown on the category landing page'}
          </button>
        )}
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
