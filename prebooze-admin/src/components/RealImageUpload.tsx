import { useRef, useState } from 'react';
import { liveMedia, LiveApiError } from '../lib/liveApi';

/** Real file upload (POST /admin/media/upload, multipart) — distinct from
 * the mock ImagePicker, which only ever reads a file into a base64 data URL
 * and never leaves the browser. This one returns a real, persisted URL. */
export default function RealImageUpload({
  value,
  onChange,
  height = 160,
  width = 130,
  label,
}: {
  value?: string | null;
  onChange: (url: string) => void;
  height?: number;
  width?: number;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      const { url } = await liveMedia.upload(file);
      onChange(url);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Upload failed');
    } finally {
      setBusy(false);
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
