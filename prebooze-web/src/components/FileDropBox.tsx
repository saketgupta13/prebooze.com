import { useRef } from 'react';
import type { ReactNode } from 'react';

/** A real file picker with a real preview — reads the picked image into a
 * data URL via FileReader. Replaces the old fake "click to toggle a
 * boolean" upload-box pattern used across the organizer console. */
export function FileDropBox({ value, onChange, label, doneLabel, style, accept = 'image/*' }: {
  value?: string;
  onChange: (dataUrl: string) => void;
  label: string;
  doneLabel?: ReactNode;
  style?: React.CSSProperties;
  // Widened for document uploads (e.g. a firm's registration certificate,
  // often issued as a PDF) — defaults to images-only for every existing
  // caller (logo, selfie, gallery-style docs).
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isPdf = value?.startsWith('data:application/pdf');
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };
  return (
    <button
      type="button"
      className={`upload-box ${value ? 'done' : ''}`}
      onClick={() => inputRef.current?.click()}
      style={{
        ...(value && !isPdf
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
      {value ? (isPdf ? '📄 PDF selected — click to replace' : (doneLabel ?? '✓ Image uploaded — click to replace')) : label}
    </button>
  );
}

/** Multiple real photos, each its own data URL — the event gallery slot,
 * which didn't exist as even a placeholder before. */
export function GalleryDropBox({ value, onChange, max = 6 }: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, max - value.length));
    if (!files.length) return;
    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          }),
      ),
    ).then((urls) => onChange([...value, ...urls]));
    e.target.value = '';
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
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
        <button type="button" className="upload-box" style={{ width: 64, height: 64, padding: 0, fontSize: 10 }} onClick={() => inputRef.current?.click()}>
          + add
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} />
    </div>
  );
}
