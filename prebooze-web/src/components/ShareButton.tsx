import { useEffect, useRef, useState } from 'react';

/** Share menu — WhatsApp / Facebook / Instagram / copy link. */
export default function ShareButton({ path, label = '⇪ Share', text = 'Check this out on Prebooze 🎟️' }: { path: string; label?: string; text?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const url = typeof window !== 'undefined' ? window.location.origin + path : path;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const copy = () => {
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1400);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
        {copied ? 'Link copied ✓' : label}
      </button>
      {open && (
        <div className="menu share-menu" style={{ right: 0, minWidth: 220 }}>
          {copied ? (
            <div className="share-menu-copied">✓ Link copied</div>
          ) : (
            <>
              <button onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank'); setOpen(false); }}>
                💬 WhatsApp
              </button>
              <button onClick={() => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank'); setOpen(false); }}>
                📘 Facebook
              </button>
              <button onClick={copy} title="Instagram has no web share — link is copied for your story / DM">
                📸 Instagram — copy for story
              </button>
              <div className="sep" />
              <button onClick={copy}>🔗 Copy link</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
