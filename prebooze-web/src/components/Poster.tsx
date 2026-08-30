import type { ReactNode } from 'react';

interface Props {
  hue: number;
  emoji?: string;
  /** A real icon component (e.g. CategoryIcon) — takes priority over `emoji`
   * when set. Category posters use this instead of an emoji glyph. */
  icon?: ReactNode;
  label?: string;
  variant?: 'portrait' | 'landscape' | 'square' | 'reel';
  className?: string;
  imageUrl?: string | null;
  /** Real content description (event title, venue/organizer/lineup name,
   * blog post title...) — this is what makes the photo indexable by Google
   * Image Search, not just visually present. Leave unset only for the rare
   * case this is genuinely decorative. */
  alt?: string;
  /** True for the one hero image on a detail page (event poster, venue
   * photo, profile logo) that's likely the page's LCP element — everywhere
   * else (grid/slider cards) defaults to native lazy-loading, which is
   * strictly better than the old CSS background-image this replaced (that
   * loaded every instance immediately regardless of scroll position, since
   * background-images are never lazy). */
  eager?: boolean;
}

/** Branded placeholder block — the wireframes specify gray placeholders;
 * we render dark gradient art blocks until real photography is sourced. Now
 * that a real poster upload exists (admin's event editor), `imageUrl`
 * renders the real photo instead — every caller gets it for free by just
 * passing `event.posterUrl`, no per-page changes needed.
 *
 * Real photo is a real <img>, not a CSS background-image — a background
 * paints pixels but is invisible to Google Image Search and can't carry
 * alt text at all, which meant none of this site's real photography
 * (event posters, venue galleries, brand logos) was ever indexable. */
export default function Poster({ hue, emoji = '🎶', icon, label, variant = 'portrait', className = '', imageUrl, alt = '', eager = false }: Props) {
  const cls = variant === 'portrait' ? '' : variant;
  return (
    <div
      className={`poster ${cls} ${className}`}
      style={imageUrl
        ? { backgroundColor: 'var(--surface-2)' } // instant fill under the <img> — same "no flash while decoding" reasoning as before
        : {
            background: `radial-gradient(ellipse at 30% 25%, hsla(${hue}, 70%, 55%, 0.32), transparent 60%),
          radial-gradient(ellipse at 75% 80%, hsla(${(hue + 60) % 360}, 65%, 45%, 0.22), transparent 55%),
          var(--surface-2)`,
          }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
        />
      ) : (
        <>
          <span className={icon ? 'poster-icon' : undefined}>{icon ?? emoji}</span>
          {label && <span className="poster-label">{label}</span>}
        </>
      )}
    </div>
  );
}
