import { useEffect, useRef } from 'react';

interface Props {
  images: string[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  alt?: (index: number) => string;
}

/** Full-screen photo viewer shared by every gallery on the site (venue,
 * event) — opens over the current page instead of navigating to a raw
 * image in a new tab, with Escape/backdrop-click/✕ to close and swipe or
 * arrow-key navigation between photos. Tap targets are sized for mobile
 * (44px+) since this is the one interaction most guests hit on a phone. */
export default function ImageLightbox({ images, index, onClose, onNavigate, alt }: Props) {
  const touchStartX = useRef<number | null>(null);
  const count = images.length;
  const go = (d: number) => onNavigate((index + d + count) % count);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && count > 1) go(-1);
      else if (e.key === 'ArrowRight' && count > 1) go(1);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count]);

  return (
    <div className="lightbox-ov" onClick={onClose} role="dialog" aria-modal="true" aria-label="Photo viewer">
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      {count > 1 && (
        <>
          <button className="lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous photo">
            ‹
          </button>
          <button className="lightbox-nav lightbox-next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next photo">
            ›
          </button>
        </>
      )}
      <img
        src={images[index]}
        alt={alt ? alt(index) : `Photo ${index + 1} of ${count}`}
        className="lightbox-img"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current == null || count < 2) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (dx > 40) go(-1);
          else if (dx < -40) go(1);
          touchStartX.current = null;
        }}
      />
      {count > 1 && (
        <div className="lightbox-counter">
          {index + 1} / {count}
        </div>
      )}
    </div>
  );
}
