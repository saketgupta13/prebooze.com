import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

/** A searchable dropdown — type to filter, click to select. */
export default function SearchableSelect({
  value, onChange, options, placeholder, disabled, icon, allowFreeText,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  /** Show a leading search icon inside the input (opt-in, existing callers unaffected). */
  icon?: boolean;
  // Real gap closed 2026-09-28: co-organizer/lineup/venue pickers used to
  // force picking a registered entity — nothing typed but not listed could
  // ever be submitted. When on, a typed query with no exact match in
  // `options` shows an extra "+ Add '<query>'" row that calls onChange with
  // the raw typed text — the caller is responsible for treating that as a
  // free-text/unregistered entry (a real match still always wins over free
  // text when one exists, since real-profile linking is strictly better).
  allowFreeText?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));
  const exactMatch = options.some((o) => o.toLowerCase() === q.trim().toLowerCase());
  const showFreeTextOption = allowFreeText && q.trim().length > 1 && !exactMatch;

  return (
    <div className="ss" ref={ref} style={icon ? { position: 'relative' } : undefined}>
      {icon && <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }} />}
      <input
        value={open ? q : value}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => { setOpen(true); setQ(''); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        autoComplete="off"
        style={icon ? { paddingLeft: 30 } : undefined}
      />
      {open && !disabled && (
        <div className="ss-list">
          {filtered.map((o) => (
            <button
              type="button"
              key={o}
              className="ss-opt"
              onMouseDown={(e) => { e.preventDefault(); onChange(o); setOpen(false); }}
            >
              {o}
            </button>
          ))}
          {showFreeTextOption && (
            <button
              type="button"
              className="ss-opt"
              style={{ color: 'var(--accent)', fontWeight: 700 }}
              onMouseDown={(e) => { e.preventDefault(); onChange(q.trim()); setOpen(false); }}
            >
              + Add "{q.trim()}" (not on Prebooze yet)
            </button>
          )}
          {!filtered.length && !showFreeTextOption && <div className="ss-empty">No matches</div>}
        </div>
      )}
    </div>
  );
}
