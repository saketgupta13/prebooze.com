import { useEffect, useRef, useState } from 'react';

/** A searchable dropdown — type to filter, click to select. */
export default function SearchableSelect({
  value, onChange, options, placeholder, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
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

  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="ss" ref={ref}>
      <input
        value={open ? q : value}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => { setOpen(true); setQ(''); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        autoComplete="off"
      />
      {open && !disabled && (
        <div className="ss-list">
          {filtered.length ? (
            filtered.map((o) => (
              <button
                type="button"
                key={o}
                className="ss-opt"
                onMouseDown={(e) => { e.preventDefault(); onChange(o); setOpen(false); }}
              >
                {o}
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
