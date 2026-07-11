import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';

/** Add / edit a home banner — image upload, heading, description and CTA button link. */
export default function BannerEdit() {
  const { id } = useParams(); // undefined = create mode
  const isCreate = !id;
  const navigate = useNavigate();
  const { banners, events, pages, addBanner, updateBanner, removeBanner, toast } = useAdmin();
  const existing = isCreate ? undefined : banners.find((b) => b.id === id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [heading, setHeading] = useState(existing?.heading ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [ctaLabel, setCtaLabel] = useState(existing?.ctaLabel ?? 'Book now →');
  const [ctaLink, setCtaLink] = useState(existing?.ctaLink ?? '/browse');
  const [hasImage, setHasImage] = useState(existing?.hasImage ?? false);
  const [status, setStatus] = useState(existing?.statusLabel ?? 'Scheduled');

  if (!isCreate && !existing) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Banner not found</h1>
        <Link to="/banners" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Banners</Link>
      </div>
    );
  }

  const linkOptions = [
    '/browse',
    '/host',
    '/blog',
    ...events.filter((e) => e.status === 'live').map((e) => `/events/${e.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
    ...pages.map((p) => p.slug),
  ];

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !heading.trim()) {
      toast('Campaign title and banner heading are required');
      return;
    }
    if (!hasImage) {
      toast('Upload the banner image (16:5) first');
      return;
    }
    const patch = {
      title: title.trim(),
      heading: heading.trim(),
      description: description.trim(),
      ctaLabel: ctaLabel.trim() || 'Book now →',
      ctaLink,
      hasImage,
      statusLabel: status,
    };
    if (isCreate) addBanner({ id: 'b' + Date.now(), ...patch });
    else updateBanner(existing!.id, patch);
    navigate('/banners');
  };

  return (
    <form className="stack fade" style={{ maxWidth: 640, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/banners" style={{ fontSize: 13 }}>← Banners</Link>
        <h1 className="page-title">{isCreate ? 'Add banner' : `Edit banner — ${existing!.title}`}</h1>
        <div style={{ flex: 1 }} />
        {!isCreate && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm('Remove this banner from rotation?')) {
                removeBanner(existing!.id);
                navigate('/banners');
              }
            }}
          >
            Remove
          </button>
        )}
      </div>

      {/* Upload + live preview */}
      <button
        type="button"
        onClick={() => setHasImage((v) => !v)}
        style={{
          border: hasImage ? '1px solid var(--green)' : '1.5px dashed rgba(139,195,74,.4)',
          borderRadius: 12,
          background: hasImage
            ? 'linear-gradient(120deg, rgba(139,195,74,.25), rgba(139,195,74,.06))'
            : 'repeating-linear-gradient(45deg,#181b10 0 10px,#14160d 10px 20px)',
          aspectRatio: '16 / 5',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 6,
          padding: '18px 24px',
          textAlign: 'left',
        }}
      >
        {hasImage ? (
          <>
            <span className="display" style={{ fontSize: 22, color: 'var(--text)' }}>{heading || 'Banner heading…'}</span>
            <span className="small muted">{description || 'Banner description…'}</span>
            <span className="btn btn-pri btn-sm" style={{ marginTop: 4 }}>{ctaLabel || 'Book now →'}</span>
            <span className="tiny hint" style={{ marginTop: 4 }}>✓ image 16:5 uploaded — click to replace · live preview</span>
          </>
        ) : (
          <span className="hint" style={{ margin: 'auto', fontSize: 12 }}>⬆ click to upload banner image · 16:5 · min 1600px wide</span>
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
