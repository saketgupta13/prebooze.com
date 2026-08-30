import { useEffect, useRef, useState } from 'react';
import { Share2, MessageCircle, Link2 } from 'lucide-react';
import { copyToClipboard } from '../lib/clipboard';

// lucide-react ships no brand marks, so Facebook/Instagram reuse the same
// hand-drawn logo outlines as Footer.tsx's social row, for a consistent
// real-brand look instead of a generic icon standing in for them.
const InstagramMark = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4.5" /><circle cx="17.8" cy="6.2" r="1.2" fill="currentColor" stroke="none" /></svg>
);
const FacebookMark = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.7c0-.9.3-1.6 1.6-1.6h1.7V4.2c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.4V14h2.7v8h3.4z" /></svg>
);

/** Share menu — WhatsApp / Facebook / Instagram / copy link. */
export default function ShareButton({ path, label = 'Share', text = 'Check this out on Prebooze 🎟️' }: { path: string; label?: string; text?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const url = typeof window !== 'undefined' ? window.location.origin + path : path;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const copy = async () => {
    setErr('');
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => { setCopied(false); setOpen(false); }, 1400);
    } else {
      setErr('Could not copy — long-press or select the link below to copy it manually');
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setOpen((o) => !o)}>
        {copied ? 'Link copied ✓' : <><Share2 size={15} /> {label}</>}
      </button>
      {open && (
        <div className="menu share-menu" style={{ right: 0, minWidth: 220 }}>
          {copied ? (
            <div className="share-menu-copied">✓ Link copied</div>
          ) : (
            <>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank'); setOpen(false); }}>
                <MessageCircle size={15} /> WhatsApp
              </button>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank'); setOpen(false); }}>
                <FacebookMark /> Facebook
              </button>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={copy} title="Instagram has no web share — link is copied for your story / DM">
                <InstagramMark /> Instagram — copy for story
              </button>
              <div className="sep" />
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={copy}><Link2 size={15} /> Copy link</button>
              {err && <div className="tiny danger-text" style={{ padding: '6px 8px' }}>{err}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
