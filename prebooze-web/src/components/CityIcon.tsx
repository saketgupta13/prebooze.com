import type { ReactElement, SVGProps } from 'react';
import { Landmark } from 'lucide-react';

/** Hand-drawn, stroke-based landmark silhouettes for the city picker — same
 * idea as BookMyShow's city grid (Gateway of India for Mumbai, Charminar
 * for Hyderabad, etc.) instead of a generic pin or a random admin-typed
 * emoji. Drawn in the same visual language as the rest of the app's icons
 * (lucide's own stroke weight/caps/joins) so they sit naturally next to
 * them. Deliberately independent of the City.icon DB field — that field is
 * free-typed by admin staff and was never guaranteed to be a sensible
 * landmark; this is a curated, professional set covering the real cities
 * Prebooze actually operates in, with a generic fallback for any other
 * city (new launches, US cities, etc.) rather than mixing a polished
 * illustration style with a stray raw emoji. */

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function GatewayOfIndia(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <line x1="2" y1="20" x2="22" y2="20" />
      <line x1="4" y1="8.5" x2="4" y2="20" />
      <line x1="20" y1="8.5" x2="20" y2="20" />
      <circle cx="4" cy="6.6" r="1.1" />
      <circle cx="20" cy="6.6" r="1.1" />
      <path d="M8 20v-8a4 4 0 0 1 8 0v8" />
      <circle cx="12" cy="7.3" r="1" />
    </svg>
  );
}

function IndiaGate(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <line x1="3" y1="20" x2="21" y2="20" />
      <path d="M5.5 20V10a6.5 6.5 0 0 1 13 0v10" />
    </svg>
  );
}

function VidhanaSoudha(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <line x1="2" y1="20" x2="22" y2="20" />
      <path d="M4 20v-7h16v7" />
      <path d="M9.5 13a2.5 2.5 0 0 1 5 0" />
      <line x1="7" y1="13" x2="7" y2="20" />
      <line x1="12" y1="13" x2="12" y2="20" />
      <line x1="17" y1="13" x2="17" y2="20" />
    </svg>
  );
}

function Charminar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <line x1="2" y1="20" x2="22" y2="20" />
      <line x1="3" y1="9" x2="3" y2="20" />
      <line x1="8.5" y1="9" x2="8.5" y2="20" />
      <line x1="15.5" y1="9" x2="15.5" y2="20" />
      <line x1="21" y1="9" x2="21" y2="20" />
      <path d="M2.1 9l0.9-2 0.9 2" />
      <path d="M7.6 9l0.9-2 0.9 2" />
      <path d="M14.6 9l0.9-2 0.9 2" />
      <path d="M20.1 9l0.9-2 0.9 2" />
      <path d="M9.5 20v-4.5a2.5 2.5 0 0 1 5 0v4.5" />
      <path d="M10.5 12v-2a1.5 1.8 0 0 1 3 0v2" />
    </svg>
  );
}

function Gopuram(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <line x1="3" y1="20" x2="21" y2="20" />
      <path d="M5.5 20l1.2-3.2h10.6l1.2 3.2" />
      <path d="M7.5 16.8l1-3h7l1 3" />
      <path d="M9 13.8l0.9-2.6h4.2l0.9 2.6" />
      <path d="M10.4 11.2l0.7-2.2h1.8l0.7 2.2" />
      <line x1="12" y1="9" x2="12" y2="5.5" />
    </svg>
  );
}

function HowrahBridge(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <line x1="2" y1="18" x2="22" y2="18" />
      <line x1="6" y1="18" x2="6" y2="7" />
      <line x1="18" y1="18" x2="18" y2="7" />
      <path d="M6 7h12" />
      <path d="M6 18l6-7 6 7" />
    </svg>
  );
}

function PalmTree(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21v-8" />
      <path d="M12 13c-2-4-6-5-9-3" />
      <path d="M12 13c2-4 6-5 9-3" />
      <path d="M12 13c-3.2-2-6.7-1.6-9 1" />
      <path d="M12 13c3.2-2 6.7-1.6 9 1" />
      <path d="M12 13c-0.8-3-0.3-5.4 1.2-7" />
    </svg>
  );
}

function Orange(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 6.5V3" />
      <path d="M12 3.5c1.4-1 2.8-1 4-.1" />
      <path d="M12 7v13" />
    </svg>
  );
}

function HawaMahal(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20v-11a8 8 0 0 1 16 0v11" />
      <line x1="4" y1="20" x2="20" y2="20" />
      <circle cx="8.5" cy="11" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="9.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="11" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="7.3" cy="15" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.2" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="16.7" cy="15" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Kite(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l6.5 6L12 20l-6.5-11z" />
      <line x1="5.5" y1="9" x2="18.5" y2="9" />
      <line x1="12" y1="3" x2="12" y2="20" />
      <path d="M12 20c1 1 1.6 2.4 1 3.5" />
    </svg>
  );
}

const CITY_LANDMARKS: Record<string, (p: SVGProps<SVGSVGElement>) => ReactElement> = {
  Mumbai: GatewayOfIndia,
  Delhi: IndiaGate,
  Bengaluru: VidhanaSoudha,
  Bangalore: VidhanaSoudha,
  Hyderabad: Charminar,
  Chennai: Gopuram,
  Kolkata: HowrahBridge,
  Goa: PalmTree,
  Nagpur: Orange,
  Jaipur: HawaMahal,
  Ahmedabad: Kite,
};

/** A real landmark silhouette for known cities, generic pin-style fallback
 * (lucide's Landmark) for anything else — new launches, US cities, etc. */
export default function CityIcon({ city, size = 26, className }: { city: string; size?: number; className?: string }) {
  const Icon = CITY_LANDMARKS[city] ?? Landmark;
  return <Icon width={size} height={size} className={className} />;
}
