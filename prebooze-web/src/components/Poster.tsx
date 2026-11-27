import type { ReactNode } from 'react';
import { Music } from 'lucide-react';

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
// Real measurement 2026-11-27: every poster/logo is stored once at a fixed
// ~960px hero size regardless of context — a grid/list card showing it at a
// few hundred CSS px downloaded the exact same bytes as the one full-width
// detail-page hero (100-220KB each). ThumbController generates+caches a
// 400px copy on first request at the same filename, under /uploads/thumb/
// 400/ instead of /uploads/ — same origin, same file, just smaller, so
// nothing about the grid's layout/CSS changes, only which bytes load.
// Deliberately only ever applied to a non-eager (grid/slider) image — the
// one `eager` hero per page already needs the larger size. Falls back to
// the original URL untouched for anything that isn't a plain StorageService
// upload URL (e.g. an external/placeholder URL), same fail-open stance as
// the backend thumbnail generator itself.
function thumbUrl(url: string): string {
  const m = url.match(/^(https?:\/\/[^/]+)\/uploads\/([0-9]+-[0-9a-f]{16}\.(?:jpg|jpeg|png|webp))$/i);
  return m ? `${m[1]}/uploads/thumb/400/${m[2]}` : url;
}

export default function Poster({ hue, emoji, icon, label, variant = 'portrait', className = '', imageUrl, alt = '', eager = false }: Props) {
  const cls = variant === 'portrait' ? '' : variant;
  const src = (imageUrl && !eager ? thumbUrl(imageUrl) : imageUrl) ?? undefined;
  // Falls all the way back to a real lucide icon (not the old hardcoded
  // musical-note emoji literal) when a caller supplies neither a real
  // `icon` nor its own `emoji` glyph — same "poster-icon" 40px treatment
  // as an explicit icon.
  const resolvedIcon = icon ?? (emoji ? undefined : <Music size={40} />);
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
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
        />
      ) : (
        <>
          <span className={resolvedIcon ? 'poster-icon' : undefined}>{resolvedIcon ?? emoji}</span>
          {label && <span className="poster-label">{label}</span>}
        </>
      )}
    </div>
  );
}
