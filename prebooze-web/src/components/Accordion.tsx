import { useState } from 'react';
import type { ReactNode } from 'react';

export default function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="acc">
      <button className="acc-hd" onClick={() => setOpen((o) => !o)}>
        {title}
        <span className="muted-2">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="acc-bd">{children}</div>}
    </div>
  );
}
