import { useState } from 'react';

/** Copies a shareable URL to the clipboard with inline feedback. */
export default function ShareButton({ path, label = '⇪ Share' }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => {
        navigator.clipboard?.writeText(window.location.origin + path).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? 'Link copied ✓' : label}
    </button>
  );
}
