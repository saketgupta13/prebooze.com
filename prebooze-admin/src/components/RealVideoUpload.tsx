import { useRef, useState } from 'react';
import { liveMedia, LiveApiError } from '../lib/liveApi';

/** Real video upload (POST /admin/media/upload, multipart, 80MB cap) — same
 * real-file-real-URL pattern as RealImageUpload, for the event teaser reel. */
export default function RealVideoUpload({
  value,
  onChange,
  onBusyChange,
  label,
}: {
  value?: string | null;
  onChange: (url: string) => void;
  onBusyChange?: (busy: boolean) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    onBusyChange?.(true);
    setErr('');
    try {
      const { url } = await liveMedia.upload(file);
      onChange(url);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Upload failed (max 80MB)');
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {value && (
          <video src={value} controls muted style={{ width: 120, height: 200, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--green)' }} />
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          <input ref={inputRef} type="file" accept="video/*" onChange={onFile} style={{ display: 'none' }} />
          {busy ? 'Uploading…' : value ? 'Replace video' : label}
        </button>
      </div>
      {err && <div className="tiny" style={{ color: 'var(--red)', marginTop: 4 }}>{err}</div>}
    </div>
  );
}
