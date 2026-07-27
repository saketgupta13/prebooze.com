import { useRef, useState } from 'react';
import type { ReactNode } from 'react';

/** Real file upload — same look as FileDropBox/GalleryDropBox, but hits a
 * real upload endpoint (organizer.upload / venuePartner.upload) and stores
 * the returned, persisted URL instead of a browser-only data URL. Pass the
 * role-specific `upload` function so this one component works for both
 * organizer event media and venue gallery photos. */
export function RealUploadBox({ value, onChange, upload, label, doneLabel, accept = 'image/*', style }: {
  value?: string | null;
  onChange: (url: string) => void;
  upload: (file: File) => Promise<{ url: string }>;
  label: string;
  doneLabel?: ReactNode;
  accept?: string;
  style?: React.CSSProperties;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const { url } = await upload(file);
      onChange(url);
    } catch {
      setErr('Upload failed — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        className={`upload-box ${value ? 'done' : ''}`}
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          ...(value && accept.startsWith('image')
            ? {
                backgroundImage: `linear-gradient(rgba(10,12,7,.35), rgba(10,12,7,.55)), url(${value})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : {}),
          ...style,
        }}
      >
        <input ref={inputRef} type="file" accept={accept} onChange={onFile} style={{ display: 'none' }} />
        {busy ? 'Uploading…' : value ? (doneLabel ?? '✓ uploaded — click to replace') : label}
      </button>
      {err && <div className="tiny danger-text" style={{ marginTop: 4 }}>{err}</div>}
    </div>
  );
}

/** Real video upload (teaser reel) — same upload plumbing as RealUploadBox
 * but with a <video> preview instead of a background-image thumbnail. */
export function RealVideoUploadBox({ value, onChange, upload, label }: {
  value?: string | null;
  onChange: (url: string) => void;
  upload: (file: File) => Promise<{ url: string }>;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const { url } = await upload(file);
      onChange(url);
    } catch {
      setErr('Upload failed — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {value && <video src={value} controls muted style={{ width: 110, height: 180, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--success)' }} />}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          <input ref={inputRef} type="file" accept="video/*" onChange={onFile} style={{ display: 'none' }} />
          {busy ? 'Uploading…' : value ? 'Replace video' : label}
        </button>
      </div>
      {err && <div className="tiny danger-text" style={{ marginTop: 4 }}>{err}</div>}
    </div>
  );
}

/** Multiple real photos — same shape as GalleryDropBox but each file is
 * uploaded for real and the array stores persisted URLs. */
export function RealGalleryUploadBox({ value, onChange, upload, max = 6 }: {
  value: string[];
  onChange: (urls: string[]) => void;
  upload: (file: File) => Promise<{ url: string }>;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, max - value.length));
    e.target.value = '';
    if (!files.length) return;
    setErr('');
    setBusy(true);
    try {
      const uploaded = await Promise.all(files.map((f) => upload(f)));
      onChange([...value, ...uploaded.map((u) => u.url)]);
    } catch {
      setErr('Some uploads failed — try again');
    } finally {
      setBusy(false);
    }
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {value.map((url, i) => (
          <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--success)' }}>
            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              type="button"
              onClick={() => remove(i)}
              style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 10, cursor: 'pointer', lineHeight: '18px', padding: 0 }}
            >
              ✕
            </button>
          </div>
        ))}
        {value.length < max && (
          <button type="button" className="upload-box" style={{ width: 64, height: 64, padding: 0, fontSize: 10 }} onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? '…' : '+ add'}
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} />
      </div>
      {err && <div className="tiny danger-text" style={{ marginTop: 4 }}>{err}</div>}
    </div>
  );
}
