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
