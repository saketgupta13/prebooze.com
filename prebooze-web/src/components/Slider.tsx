import { useRef } from 'react';
import type { ReactNode } from 'react';

/** Horizontal scroll-snap slider with prev/next controls. */
export default function Slider({ children, slideWidth = 260 }: { children: ReactNode; slideWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * slideWidth * 2, behavior: 'smooth' });
  return (
    <div className="slider-wrap">
      <div className="slider-track" ref={ref} style={{ ['--slide-w' as string]: `${slideWidth}px` }}>
        {children}
      </div>
      <button className="slider-btn left" onClick={() => scroll(-1)} aria-label="Previous">‹</button>
      <button className="slider-btn right" onClick={() => scroll(1)} aria-label="Next">›</button>
    </div>
  );
}
