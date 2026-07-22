import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { BookingStatus, CustomerStatus, EventStatus, OrganizerStatus } from '../types';

export const EVENT_STATUS: Record<EventStatus, { label: string; cls: string }> = {
  live: { label: '● Live', cls: 'tag-green' },
  pending: { label: 'Pending', cls: 'tag-red' },
  draft: { label: 'Draft', cls: '' },
};

export const BOOKING_STATUS: Record<BookingStatus, { label: string; cls: string }> = {
  refund_requested: { label: 'Refund req.', cls: 'tag-red' },
  paid: { label: 'Paid', cls: 'tag-green' },
  checked_in: { label: 'Checked in', cls: '' },
  refunded: { label: 'Refunded', cls: 'tag-dim' },
};

export const CUSTOMER_STATUS: Record<CustomerStatus, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'tag-green' },
  unverified: { label: 'Unverified', cls: '' },
  blocked: { label: 'Blocked', cls: 'tag-red' },
};

export const ORGANIZER_STATUS: Record<OrganizerStatus, { label: string; cls: string }> = {
  approved: { label: 'Approved', cls: 'tag-green' },
  pending: { label: 'Pending review', cls: 'tag-red' },
  rejected: { label: 'Rejected', cls: 'tag-dim' },
};

/** Dummy "photo" — layered gradients that read as imagery until real uploads exist. */
export function GradientPhoto({ seed, label, style }: { seed: number; label?: string; style?: React.CSSProperties }) {
  const h1 = (seed * 47) % 360;
  const h2 = (h1 + 70) % 360;
  return (
    <div
      style={{
        borderRadius: 10,
        border: '1px solid rgba(139,195,74,.2)',
        background: `radial-gradient(ellipse at 25% 20%, hsla(${h1},65%,45%,.55), transparent 55%),
          radial-gradient(ellipse at 80% 75%, hsla(${h2},60%,35%,.45), transparent 60%),
          linear-gradient(160deg, #1c1f13, #101208)`,
        display: 'flex',
        alignItems: 'flex-end',
        padding: 8,
        color: 'rgba(241,243,234,.65)',
        fontSize: 10,
        ...style,
      }}
    >
      {label}
    </div>
  );
}

export function Tag({ label, cls }: { label: string; cls: string }) {
  return <span className={`tag ${cls}`}>{label}</span>;
}

export function Kpi({ label, value, delta, deltaColor, alert }: {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaColor?: string;
  alert?: boolean;
}) {
  return (
    <div className={`kpi ${alert ? 'alert' : ''}`}>
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      {delta && <div className="d" style={{ color: deltaColor }}>{delta}</div>}
    </div>
  );
}

export function Drawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="drawer">{children}</div>
    </>
  );
}

/** A real file picker with a real preview — reads the picked file into a
 * data URL via FileReader (no backend session exists client-side yet to
 * authorize a real upload call, see BACKEND.md's media-upload slice), which
 * replaces the old fake toggle-a-boolean "upload" buttons across Banners,
 * Events and Categories. `children` renders on top of the picked image
 * (e.g. BannerEdit's live heading/description/CTA preview); omit it for a
 * plain "✓ uploaded" badge. */
export function ImagePicker({ value, onChange, aspectRatio = '16 / 5', height, width, label, children }: {
  value?: string;
  onChange: (dataUrl: string) => void;
  aspectRatio?: string;
  height?: number;
  width?: number;
  label: string;
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
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
      onClick={() => inputRef.current?.click()}
      style={{
        border: value ? '1px solid var(--green)' : '1.5px dashed rgba(139,195,74,.4)',
        borderRadius: 12,
        aspectRatio: height ? undefined : aspectRatio,
        height,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 6,
        padding: value ? '18px 24px' : '18px 24px',
        textAlign: 'left',
        backgroundImage: value ? `linear-gradient(rgba(10,12,7,.35), rgba(10,12,7,.55)), url(${value})` : 'repeating-linear-gradient(45deg,#181b10 0 10px,#14160d 10px 20px)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        overflow: 'hidden',
        width: width ?? '100%',
      }}
    >
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
      {value ? (children ?? <span className="tiny hint">✓ image uploaded — click to replace</span>) : (
        <span className="hint" style={{ margin: 'auto', fontSize: 12 }}>{label}</span>
      )}
    </button>
  );
}

export function SearchBox({ value, onChange, placeholder, style }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className="search-box" style={style}>
      <span style={{ opacity: 0.6 }}>🔍</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
