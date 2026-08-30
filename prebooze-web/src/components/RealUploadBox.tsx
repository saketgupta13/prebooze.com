import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, X } from 'lucide-react';

/** Real file upload — same look as FileDropBox/GalleryDropBox, but hits a
 * real upload endpoint (organizer.upload / venuePartner.upload) and stores
 * the returned, persisted URL instead of a browser-only data URL. Pass the
 * role-specific `upload` function so this one component works for both
 * organizer event media and venue gallery photos.
 *
 * `onBusyChange` — real 2026-08-29 bug found (House of Aura's organizer
 * logo): this component's upload-in-progress state was entirely private,
 * so a page's own Save button had no way to know an upload was still in
 * flight and could fire (and navigate away) before it finished — the
 * upload would still succeed a moment later, but `onChange(url)` landed on
 * an unmounted/already-saved page and the URL was silently lost. Optional
 * so existing call sites don't need to change unless they have a nearby
 * save action worth gating on this. */
export function RealUploadBox({ value, onChange, upload, label, doneLabel, accept = 'image/*', style, onBusyChange }: {
  value?: string | null;
  onChange: (url: string) => void;
  upload: (file: File) => Promise<{ url: string }>;
  label: ReactNode;
  doneLabel?: ReactNode;
  accept?: string;
  style?: React.CSSProperties;
  onBusyChange?: (busy: boolean) => void;
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
    onBusyChange?.(true);
    try {
      const { url } = await upload(file);
      onChange(url);
    } catch {
      setErr('Upload failed — try again');
    } finally {
      setBusy(false);
      onBusyChange?.(false);
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
        {busy ? 'Uploading…' : value ? (doneLabel ?? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={13} /> uploaded — click to replace</span>) : label}
      </button>
      {err && <div className="tiny danger-text" style={{ marginTop: 4 }}>{err}</div>}
    </div>
  );
}

/** Real video upload (teaser reel) — same upload plumbing as RealUploadBox
 * but with a <video> preview instead of a background-image thumbnail. See
 * RealUploadBox's onBusyChange doc comment for why this exists. */
export function RealVideoUploadBox({ value, onChange, upload, label, onBusyChange }: {
  value?: string | null;
  onChange: (url: string) => void;
  upload: (file: File) => Promise<{ url: string }>;
  label: ReactNode;
  onBusyChange?: (busy: boolean) => void;
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
    onBusyChange?.(true);
    try {
      const { url } = await upload(file);
      onChange(url);
    } catch {
      setErr('Upload failed — try again');
    } finally {
      setBusy(false);
      onBusyChange?.(false);
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
 * uploaded for real and the array stores persisted URLs. See
 * RealUploadBox's onBusyChange doc comment for why this exists. */
export function RealGalleryUploadBox({ value, onChange, upload, max = 6, onBusyChange }: {
  value: string[];
  onChange: (urls: string[]) => void;
  upload: (file: File) => Promise<{ url: string }>;
  max?: number;
  onBusyChange?: (busy: boolean) => void;
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
    onBusyChange?.(true);
    try {
      const uploaded = await Promise.all(files.map((f) => upload(f)));
      onChange([...value, ...uploaded.map((u) => u.url)]);
    } catch {
      setErr('Some uploads failed — try again');
    } finally {
      setBusy(false);
      onBusyChange?.(false);
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
              style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            >
              <X size={11} />
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
