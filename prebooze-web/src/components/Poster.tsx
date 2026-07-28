interface Props {
  hue: number;
  emoji?: string;
  label?: string;
  variant?: 'portrait' | 'landscape' | 'square' | 'reel';
  className?: string;
  imageUrl?: string | null;
}

/** Branded placeholder block — the wireframes specify gray placeholders;
 * we render dark gradient art blocks until real photography is sourced. Now
 * that a real poster upload exists (admin's event editor), `imageUrl`
 * renders the real photo instead — every caller gets it for free by just
 * passing `event.posterUrl`, no per-page changes needed. */
export default function Poster({ hue, emoji = '🎶', label, variant = 'portrait', className = '', imageUrl }: Props) {
  const cls = variant === 'portrait' ? '' : variant;
  return (
    <div
      className={`poster ${cls} ${className}`}
      style={imageUrl
        ? {
            // backgroundColor as its own property (not folded into the
            // `background` shorthand) keeps a solid fill painted instantly —
            // the shorthand-only version left the div fully transparent
            // until the photo finished decoding, which is what read as a
            // flicker/flash on every load, especially on reload where the
            // image isn't warm in the decode cache yet.
            backgroundColor: 'var(--surface-2)',
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }
        : {
            background: `radial-gradient(ellipse at 30% 25%, hsla(${hue}, 70%, 55%, 0.32), transparent 60%),
          radial-gradient(ellipse at 75% 80%, hsla(${(hue + 60) % 360}, 65%, 45%, 0.22), transparent 55%),
          var(--surface-2)`,
          }}
    >
      {!imageUrl && <span>{emoji}</span>}
      {label && !imageUrl && <span className="poster-label">{label}</span>}
    </div>
  );
}

export const categoryEmoji = (category: string) =>
  ({
    Concerts: '🎸',
    Comedy: '🎤',
    Festivals: '🎪',
    'This weekend': '🌇',
  })[category] ?? '🎶';
