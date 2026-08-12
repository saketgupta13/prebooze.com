import { useEffect, useRef, useState } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

/** A searchable dropdown — type to filter, click to select. For filter bars
 * where the option list (visitor cities/states) can run into the dozens and
 * a plain <select> becomes a long, unsearchable scroll. `allLabel`, when
 * given, is an always-visible first option that clears the filter (value
 * ''), same "All X" convention the plain <select> filters already use. */
export default function SearchableSelect({
  value, onChange, options, placeholder, allLabel, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  allLabel?: string;
  disabled?: boolean;
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

  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';
  const displayValue = open ? q : selectedLabel;
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="ss" ref={ref}>
      <input
        className="input"
        value={displayValue}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => { setOpen(true); setQ(''); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        autoComplete="off"
      />
      {open && !disabled && (
        <div className="ss-list">
          {allLabel && (
            <button type="button" className="ss-opt" onMouseDown={(e) => { e.preventDefault(); onChange(''); setOpen(false); }}>
              {allLabel}
            </button>
          )}
          {filtered.length ? (
            filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                className="ss-opt"
                onMouseDown={(e) => { e.preventDefault(); onChange(o.value); setOpen(false); }}
              >
                {o.label}
              </button>
            ))
          ) : (
            <div className="ss-empty">No matches</div>
          )}
        </div>
      )}
    </div>
  );
}
