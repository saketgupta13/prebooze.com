import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { liveBanners, liveEvents, livePages, liveMedia, LiveApiError, type LiveBanner, type LiveEvent, type LiveSitePage } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';
import { ArrowLeft, CheckCircle2, Upload } from 'lucide-react';

const TITLE = 'Edit banner';

/** Add / edit a home banner — real Banner row, image upload via
 * MediaController instead of a localStorage blob. */
export default function BannerEdit() {
  const { id } = useParams();
  const isCreate = !id;
  const navigate = useNavigate();
  const session = useLiveSession();
  const { token } = session;

  const [existing, setExisting] = useState<LiveBanner | null>(null);
  const [approvedEvents, setApprovedEvents] = useState<LiveEvent[]>([]);
  const [pages, setPages] = useState<LiveSitePage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const imgInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [heading, setHeading] = useState('');
  const [description, setDescription] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Book now →');
  const [ctaLink, setCtaLink] = useState('/browse');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState('Scheduled');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveBanners.list(), liveEvents.list('approved'), livePages.list()])
      .then(([banners, evs, pgs]) => {
        setApprovedEvents(evs);
        setPages(pgs);
        if (!isCreate) {
          const b = banners.find((x) => x.id === id);
          setExisting(b ?? null);
          if (b) {
            setTitle(b.title);
            setHeading(b.heading ?? '');
            setDescription(b.description ?? '');
            setCtaLabel(b.ctaLabel ?? 'Book now →');
            setCtaLink(b.ctaLink ?? '/browse');
            setImageUrl(b.imageUrl ?? '');
            setStatus(b.statusLabel || 'Scheduled');
          }
        }
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  if (!isCreate && !loading && !existing) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Banner not found</h1>
        <Link to="/banners" className="btn btn-ghost" style={{ width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={13} /> Banners</Link>
      </div>
    );
  }
  if (!isCreate && !existing) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const linkOptions = [
    '/browse',
    '/host',
    '/blog',
    ...approvedEvents.map((e) => `/events/${e.slug}`),
    ...pages.map((p) => `/${p.slug.replace(/^\//, '')}`),
  ];

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

  const remove = async () => {
    if (!existing) return;
    if (!window.confirm('Remove this banner from rotation?')) return;
    try {
      await liveBanners.remove(existing.id);
      navigate('/banners');
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to remove');
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !heading.trim()) { setErr('Campaign title and banner heading are required'); return; }
    if (!imageUrl) { setErr('Upload the banner image (16:5) first'); return; }
    const patch = {
      title: title.trim(),
      heading: heading.trim(),
      description: description.trim(),
      ctaLabel: ctaLabel.trim() || 'Book now →',
      ctaLink,
      imageUrl,
      statusLabel: status,
    };
    try {
      if (isCreate) await liveBanners.create(patch);
      else await liveBanners.update(existing!.id, patch);
      navigate('/banners');
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to save');
    }
  };

  return (
    <form className="stack fade" style={{ maxWidth: 640, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/banners" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={13} /> Banners</Link>
        <h1 className="page-title">{isCreate ? 'Add banner' : `Edit banner — ${existing!.title}`}</h1>
        <div style={{ flex: 1 }} />
        {!isCreate && <button type="button" className="btn btn-danger btn-sm" onClick={remove}>Remove</button>}
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <input ref={imgInputRef} type="file" accept="image/*" onChange={onImageFile} style={{ display: 'none' }} />
      <button
        type="button"
        className="ph"
        style={{
          aspectRatio: '16 / 5', width: '100%', cursor: 'pointer', flexDirection: 'column', gap: 4, position: 'relative',
          backgroundImage: imageUrl ? `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)), url(${imageUrl})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}
        onClick={() => imgInputRef.current?.click()}
        disabled={uploading}
      >
        {imageUrl ? (
          <>
            <span className="display" style={{ fontSize: 22, color: '#fff' }}>{heading || 'Banner heading…'}</span>
            <span className="small" style={{ color: 'rgba(255,255,255,.85)' }}>{description || 'Banner description…'}</span>
            <span className="btn btn-pri btn-sm" style={{ marginTop: 4 }}>{ctaLabel || 'Book now →'}</span>
            <span className="tiny" style={{ marginTop: 4, color: 'rgba(255,255,255,.7)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={11} /> image 16:5 uploaded — click to replace · live preview
            </span>
          </>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {uploading ? 'Uploading…' : <><Upload size={13} /> click to upload banner image · 16:5 · min 1600px wide</>}
          </span>
        )}
      </button>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Campaign title (internal)</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. NYE teaser" autoFocus={isCreate} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>Live · #1</option>
              <option>Live · #2</option>
              <option>Live · #3</option>
              <option>Scheduled</option>
              <option>Paused</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Banner heading (shown to guests)</label>
          <input className="input" value={heading} onChange={(e) => setHeading(e.target.value)} maxLength={60} />
        </div>
        <div className="field">
          <label>Banner description</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>CTA button label</label>
            <input className="input" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={30} />
          </div>
          <div className="field" style={{ flex: 1.4 }}>
            <label>CTA button links to</label>
            <select className="input" value={ctaLink} onChange={(e) => setCtaLink(e.target.value)}>
              {[...new Set([ctaLink, ...linkOptions])].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="tiny hint">banner rotates in the guest home hero · schedule start–end and city targeting come with the backend</div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>{isCreate ? 'Add banner' : 'Save banner'}</button>
        <Link to="/banners" className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
