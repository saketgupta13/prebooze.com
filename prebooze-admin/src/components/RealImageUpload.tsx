import { useRef, useState } from 'react';
import { liveMedia, LiveApiError } from '../lib/liveApi';

/** Real file upload (POST /admin/media/upload, multipart) — distinct from
 * the mock ImagePicker, which only ever reads a file into a base64 data URL
 * and never leaves the browser. This one returns a real, persisted URL.
 *
 * `onBusyChange` — real 2026-08-29 bug found (House of Aura's organizer
 * logo): this component's upload-in-progress state was entirely private,
 * so a page's own Save button had no way to know an upload was still in
 * flight and could fire (and navigate away) before it finished — the
 * upload would still succeed a moment later, but `onChange(url)` landed on
 * an unmounted/already-saved page and the URL was silently lost. Optional
 * so existing call sites don't need to change unless they have a nearby
 * save action worth gating on this. */
export default function RealImageUpload({
  value,
  onChange,
  height = 160,
  width = 130,
  label,
  onBusyChange,
}: {
  value?: string | null;
  onChange: (url: string) => void;
  height?: number;
  width?: number;
  label: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr('');
    onBusyChange?.(true);
    try {
      const { url } = await liveMedia.upload(file);
      onChange(url);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Upload failed');
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          border: value ? '1px solid var(--green)' : '1.5px dashed rgba(139,195,74,.4)',
          borderRadius: 12,
          height,
          width,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: value ? `linear-gradient(rgba(10,12,7,.35), rgba(10,12,7,.55)), url(${value})` : 'repeating-linear-gradient(45deg,#181b10 0 10px,#14160d 10px 20px)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          padding: 12,
          textAlign: 'center',
        }}
      >
        <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
        <span className="tiny hint">{busy ? 'Uploading…' : value ? '✓ uploaded — click to replace' : label}</span>
      </button>
      {err && <div className="tiny" style={{ color: 'var(--red)', marginTop: 4 }}>{err}</div>}
    </div>
  );
}

/** Multiple real photos (venue gallery slider) — same upload plumbing as
 * RealImageUpload, each file uploaded for real and the array storing
 * persisted URLs, not base64. See RealImageUpload's onBusyChange doc
 * comment for why this exists. */
export function RealGalleryUpload({ value, onChange, max = 8, onBusyChange }: {
  value: string[];
  onChange: (urls: string[]) => void;
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
      const uploaded = await Promise.all(files.map((f) => liveMedia.upload(f)));
      onChange([...value, ...uploaded.map((u) => u.url)]);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Some uploads failed');
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
          <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--green)' }}>
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
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            style={{
              width: 72, height: 72, borderRadius: 8, cursor: 'pointer', fontSize: 10,
              border: '1.5px dashed rgba(139,195,74,.4)', background: 'repeating-linear-gradient(45deg,#181b10 0 10px,#14160d 10px 20px)', color: 'inherit',
            }}
          >
            {busy ? '…' : '+ add'}
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} />
      </div>
      {err && <div className="tiny" style={{ color: 'var(--red)', marginTop: 4 }}>{err}</div>}
    </div>
  );
}
