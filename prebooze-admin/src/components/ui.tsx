import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { BookingStatus, CustomerStatus, EventStatus, OrganizerStatus } from '../types';
import { liveLocations, type LiveCountry } from '../lib/liveApi';

/** Pill toggle switch — used in place of a plain checkbox everywhere in the
 * admin panel's settings-style forms. */
export function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={on}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: '1px solid ' + (on ? 'var(--green)' : 'rgba(139,195,74,.35)'),
        background: on ? 'var(--green)' : 'transparent',
        position: 'relative',
        flex: 'none',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 20 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: on ? 'var(--on-green)' : 'var(--muted)',
          transition: 'left .15s',
        }}
      />
    </button>
  );
}

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
export function ImagePicker({ value, onChange, aspectRatio = '16 / 5', height, width, radius = 12, label, children }: {
  value?: string;
  onChange: (dataUrl: string) => void;
  aspectRatio?: string;
  height?: number;
  width?: number;
  radius?: number | string;
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
        borderRadius: radius,
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

/** Multiple real photos (up to `max`), each read into its own data URL via
 * FileReader — same "real file, real preview" reasoning as ImagePicker,
 * just for a repeatable slot instead of one. */
export function GalleryPicker({ value, onChange, max = 6, label }: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  label: string;
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
        <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--green)' }}>
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
          className="ph"
          style={{ width: 64, height: 64, borderRadius: 8, cursor: 'pointer', fontSize: 10, textAlign: 'center' }}
        >
          {label}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} />
    </div>
  );
}

/** A real video file read into a data URL, with a real inline <video>
 * preview — same reasoning as ImagePicker, for the one video-shaped upload
 * slot (event teaser reels) this app has. */
export function VideoPicker({ value, onChange, label }: {
  value?: string;
  onChange: (dataUrl: string) => void;
  label: string;
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
    <div>
      <input ref={inputRef} type="file" accept="video/*" onChange={onFile} style={{ display: 'none' }} />
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <video src={value} muted style={{ width: 90, height: 90 * 16 / 9, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--green)' }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()}>Replace reel</button>
        </div>
      ) : (
        <button type="button" className="ph" style={{ height: 70, width: '100%', cursor: 'pointer' }} onClick={() => inputRef.current?.click()}>
          {label}
        </button>
      )}
    </div>
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

/** Searchable multi-select over a registered directory (line-ups, promoters,
 * etc.) — replaces free-text entry so an organizer can only attach entities
 * that actually exist in that module. `disabled` items (e.g. an unverified
 * line-up or a not-yet-approved promoter) still show up so admin can see
 * they exist, but can't be picked — same "show it, gate the pick" pattern
 * EventEditor already uses for the Organizer <select>. */
export function MultiSelectSearch({ items, selectedIds, onChange, placeholder, emptyHint, chipIcon }: {
  items: { id: string; label: string; sub?: string; disabled?: boolean; disabledLabel?: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  emptyHint: string;
  chipIcon?: string;
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const selected = items.filter((i) => selectedIds.includes(i.id));
  const q = query.trim().toLowerCase();
  const results = items
    .filter((i) => !selectedIds.includes(i.id))
    .filter((i) => !q || i.label.toLowerCase().includes(q))
    .slice(0, 8);

  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  if (items.length === 0) return <div className="tiny muted">{emptyHint}</div>;

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {selected.map((s) => (
            <button key={s.id} type="button" className="chip on" onClick={() => toggle(s.id)}>
              {chipIcon ?? ''} {s.label} ✕
            </button>
          ))}
        </div>
      )}
      <div className="search-box" style={{ position: 'relative' }}>
        <span style={{ opacity: 0.6 }}>🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
        />
        {focused && (
          <div
            className="card"
            style={{ position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 40, padding: 6, maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            {results.length === 0 && (
              <div className="tiny muted" style={{ padding: '6px 8px' }}>{q ? `No matches for "${query}"` : 'All added'}</div>
            )}
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={r.disabled}
                onMouseDown={() => { if (!r.disabled) { toggle(r.id); setQuery(''); } }}
                style={{
                  display: 'flex', justifyContent: 'space-between', gap: 8, textAlign: 'left',
                  background: 'none', border: 'none', padding: '6px 8px', borderRadius: 6,
                  cursor: r.disabled ? 'not-allowed' : 'pointer',
                  color: r.disabled ? 'var(--muted)' : 'var(--text)',
                  opacity: r.disabled ? 0.6 : 1,
                }}
                onMouseEnter={(e) => { if (!r.disabled) e.currentTarget.style.background = 'rgba(139,195,74,.1)'; }}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ fontSize: 12.5 }}>{r.label}{r.disabled && r.disabledLabel ? ` ${r.disabledLabel}` : ''}</span>
                {r.sub && <span className="tiny muted">{r.sub}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Searchable single-select, same look/behavior as MultiSelectSearch but
 * for exactly-one-pick fields (event's venue/organizer) — replaces a plain
 * <select> once the directory is large enough that scrolling it is worse
 * than typing to filter, same reasoning as the guest-facing SearchableSelect. */
export function SingleSelectSearch({ items, selectedId, onChange, placeholder }: {
  items: { id: string; label: string; sub?: string }[];
  selectedId: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const selected = items.find((i) => i.id === selectedId);
  const q = query.trim().toLowerCase();
  const results = items.filter((i) => !q || i.label.toLowerCase().includes(q)).slice(0, 8);

  return (
    <div className="search-box" style={{ position: 'relative' }}>
      <span style={{ opacity: 0.6 }}>🔍</span>
      <input
        value={focused ? query : (selected?.label ?? '')}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { setFocused(true); setQuery(''); }}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
      />
      {focused && (
        <div
          className="card"
          style={{ position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 40, padding: 6, maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {results.length === 0 && <div className="tiny muted" style={{ padding: '6px 8px' }}>No matches for "{query}"</div>}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={() => { onChange(r.id); setQuery(''); }}
              style={{
                display: 'flex', justifyContent: 'space-between', gap: 8, textAlign: 'left',
                background: 'none', border: 'none', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', color: 'var(--text)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,195,74,.1)'; }}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontSize: 12.5 }}>{r.label}</span>
              {r.sub && <span className="tiny muted">{r.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Real city filter — sourced from the admin-managed Locations tree's
 * enabled cities, not whatever happens to appear in a given page's own
 * data (the old per-page pattern) or the tiny hardcoded ADMIN_CITIES list. */
export function CityFilterDropdown({ value, onChange, cities, style }: {
  value: string;
  onChange: (v: string) => void;
  cities: string[];
  style?: React.CSSProperties;
}) {
  return (
    <select className="input" style={{ width: 160, ...style }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="All">All cities</option>
      {cities.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );
}

/** Real Country → State → City cascading pickers for create/edit forms —
 * sourced from the same real, admin-managed Locations tree (GET
 * /admin/locations) the Locations page itself edits, enabled entries only.
 * Distinct from CityFilterDropdown above (a read-only *filter* fed whatever
 * cities already exist in a page's own data) — this is for *writing* a
 * city onto a record, where picking one admin hasn't enabled would make
 * that record invisible to every guest-side city filter. State is kept as
 * free text passthrough on the value (not sourced from the tree) since only
 * City has that directory-matching consequence. */
export function LiveLocationPicker({ value, onChange }: {
  value: { country: string; state: string; city: string };
  onChange: (v: { country: string; state: string; city: string }) => void;
}) {
  const [tree, setTree] = useState<LiveCountry[] | null>(null);
  useEffect(() => {
    liveLocations.tree().then(setTree).catch(() => setTree([]));
  }, []);
  const countries = (tree ?? []).filter((c) => c.enabled);
  const country = countries.find((c) => c.name === value.country);
  const states = (country?.states ?? []).filter((s) => s.enabled);
  const state = states.find((s) => s.name === value.state);
  const cities = (state?.cities ?? []).filter((c) => c.enabled);

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 140, flex: 1 }}>
        <label className="tiny muted" style={{ display: 'block', marginBottom: 3 }}>Country</label>
        <select
          className="input"
          value={value.country}
          onChange={(e) => onChange({ country: e.target.value, state: '', city: '' })}
        >
          <option value="">Select country</option>
          {countries.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <div style={{ minWidth: 140, flex: 1 }}>
        <label className="tiny muted" style={{ display: 'block', marginBottom: 3 }}>State</label>
        <select
          className="input"
          value={value.state}
          disabled={!value.country}
          onChange={(e) => onChange({ ...value, state: e.target.value, city: '' })}
        >
          <option value="">{value.country ? 'Select state' : 'Pick a country first'}</option>
          {states.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
      </div>
      <div style={{ minWidth: 140, flex: 1 }}>
        <label className="tiny muted" style={{ display: 'block', marginBottom: 3 }}>City</label>
        <select
          className="input"
          value={value.city}
          disabled={!value.state}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
        >
          <option value="">{value.state ? 'Select city' : 'Pick a state first'}</option>
          {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
    </div>
  );
}

/** A real, lightweight SVG line chart — no charting dependency. Each series
 * is normalized to a shared 0..max Y scale and drawn as a polyline. */
export function LineChart({ series, height = 140, labels }: {
  series: { label: string; color: string; points: number[] }[];
  height?: number;
  labels?: string[];
}) {
  const width = 100; // viewBox units — scales responsively via the svg's own width:100%
  const allValues = series.flatMap((s) => s.points);
  const max = Math.max(1, ...allValues);
  const n = Math.max(1, series[0]?.points.length ?? 1);
  const toXY = (points: number[]) =>
    points.map((v, i) => `${(i / Math.max(1, n - 1)) * width},${height - (v / max) * (height - 16) - 8}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <line x1="0" y1={height - 8} x2={width} y2={height - 8} stroke="rgba(139,195,74,.15)" strokeWidth="0.3" />
        {series.map((s) => (
          <polyline key={s.label} points={toXY(s.points)} fill="none" stroke={s.color} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
        {series.map((s) => (
          <span key={s.label} className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
            <span className="muted">{s.label}</span>
          </span>
        ))}
      </div>
      {labels && labels.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span className="tiny muted">{labels[0]}</span>
          <span className="tiny muted">{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}

/** A real SVG donut chart via stroke-dasharray segments — no dependency. */
export function DonutChart({ data, size = 100 }: {
  data: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = 15.9155; // circumference-100 trick: 2*pi*r ≈ 100
  let offset = 0;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 36 36" width={size} height={size}>
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(139,195,74,.1)" strokeWidth="4" />
        {total > 0 &&
          data.map((d) => {
            const pct = (d.value / total) * 100;
            const el = (
              <circle
                key={d.label}
                cx="18"
                cy="18"
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth="4"
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 18 18)"
              />
            );
            offset += pct;
            return el;
          })}
      </svg>
      <div className="stack" style={{ gap: 3 }}>
        {data.filter((d) => d.value > 0).map((d) => (
          <span key={d.label} className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
            <span className="muted">{d.label}</span>
            <span>{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
          </span>
        ))}
        {total === 0 && <span className="tiny muted">No data in range</span>}
      </div>
    </div>
  );
}
