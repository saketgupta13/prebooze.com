import type { ReactElement, SVGProps } from 'react';

/** Detailed line-art landmark icons for the city picker, redrawn against
 * real reference photos (Wikimedia Commons) of each monument rather than
 * from memory — Gateway of India's wide-set domed towers + single tall
 * arch, Charminar's 4 evenly-spaced towers + gallery band, India Gate's
 * stepped cornice + medallions, Hawa Mahal's actual stepped-pyramid window
 * grid, etc. Matches BookMyShow's city-picker reference style (thin
 * outline icons, no badge background), in the app's own accent green.
 * Deliberately independent of the City.icon DB field — see CityPicker.tsx. */

const GREEN = '#9be13d';

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: GREEN,
  strokeWidth: 1,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function GatewayOfIndia(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <line x1="2" y1="21" x2="22" y2="21" />
      <line x1="3" y1="19.6" x2="21" y2="19.6" />
      <line x1="3.4" y1="8.3" x2="3.4" y2="19.6" />
      <path d="M2.5 8.3a0.9 1.3 0 0 1 1.8 0" />
      <line x1="3.4" y1="6.4" x2="3.4" y2="8.3" />
      <line x1="20.6" y1="8.3" x2="20.6" y2="19.6" />
      <path d="M19.7 8.3a0.9 1.3 0 0 1 1.8 0" />
      <line x1="20.6" y1="6.4" x2="20.6" y2="8.3" />
      <path d="M5.2 19.6v-3.6a1.2 1.5 0 0 1 2.4 0v3.6" />
      <path d="M16.4 19.6v-3.6a1.2 1.5 0 0 1 2.4 0v3.6" />
      <path d="M8.7 19.6V12.2 Q8.7 9 12 8.2 Q15.3 9 15.3 12.2 V19.6" />
      <line x1="7.6" y1="7" x2="16.4" y2="7" />
    </svg>
  );
}

function IndiaGate(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="4.2" y1="19.5" x2="19.8" y2="19.5" />
      <path d="M5.5 19.5V6.6h13V19.5" />
      <line x1="5" y1="6.6" x2="19" y2="6.6" />
      <line x1="5.5" y1="5.4" x2="18.5" y2="5.4" />
      <path d="M8.3 19.5V11a3.7 3.7 0 0 1 7.4 0v8.5" />
      <circle cx="7" cy="14.5" r="0.9" />
      <circle cx="17" cy="14.5" r="0.9" />
    </svg>
  );
}

function Charminar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} strokeWidth={0.65} strokeLinecap="butt" strokeLinejoin="miter">
      <line x1="6.5" y1="2.4" x2="6.5" y2="3.3" />
      <rect x="5.7" y="3.6" width="1.5" height="0.9" />
      <rect x="5.1" y="4.8" width="2.7" height="2.1" />
      <rect x="5.7" y="7.2" width="1.5" height="0.9" />
      <rect x="4.5" y="8.4" width="3.9" height="1.5" />
      <line x1="5.25" y1="10.8" x2="5.25" y2="21" />
      <line x1="6.45" y1="10.8" x2="6.45" y2="21" />
      <line x1="7.65" y1="10.8" x2="7.65" y2="21" />
      <line x1="4.5" y1="12.75" x2="8.4" y2="12.75" />
      <line x1="4.5" y1="14.55" x2="8.4" y2="14.55" />
      <line x1="17.5" y1="2.4" x2="17.5" y2="3.3" />
      <rect x="16.8" y="3.6" width="1.5" height="0.9" />
      <rect x="16.2" y="4.8" width="2.7" height="2.1" />
      <rect x="16.8" y="7.2" width="1.5" height="0.9" />
      <rect x="15.6" y="8.4" width="3.9" height="1.5" />
      <line x1="18.75" y1="10.8" x2="18.75" y2="21" />
      <line x1="17.55" y1="10.8" x2="17.55" y2="21" />
      <line x1="16.35" y1="10.8" x2="16.35" y2="21" />
      <line x1="15.6" y1="12.75" x2="19.5" y2="12.75" />
      <line x1="15.6" y1="14.55" x2="19.5" y2="14.55" />
      <line x1="9.3" y1="10.8" x2="9.3" y2="11.4" />
      <line x1="10.5" y1="10.8" x2="10.5" y2="11.4" />
      <line x1="11.7" y1="10.8" x2="11.7" y2="11.4" />
      <line x1="12.9" y1="10.8" x2="12.9" y2="11.4" />
      <line x1="14.1" y1="10.8" x2="14.1" y2="11.4" />
      <line x1="7.5" y1="11.55" x2="16.5" y2="11.55" />
      <line x1="9.9" y1="12" x2="9.9" y2="12.3" />
      <line x1="11.7" y1="12" x2="11.7" y2="12.3" />
      <line x1="13.5" y1="12" x2="13.5" y2="12.3" />
      <path d="M9.45 21V16.8 Q9.45 15.6 10.5 15 L11.85 14.55 L13.2 15 Q14.1 15.6 14.1 16.8 V21" />
      <line x1="5.1" y1="21" x2="18.9" y2="21" />
    </svg>
  );
}

function VidhanaSoudha(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <line x1="2" y1="21" x2="22" y2="21" />
      <path d="M3.3 21V15.5h17.4V21" />
      <line x1="5" y1="15.5" x2="5" y2="21" />
      <line x1="7.3" y1="15.5" x2="7.3" y2="21" />
      <line x1="16.7" y1="15.5" x2="16.7" y2="21" />
      <line x1="19" y1="15.5" x2="19" y2="21" />
      <line x1="9.8" y1="15.5" x2="9.8" y2="21" />
      <line x1="14.2" y1="15.5" x2="14.2" y2="21" />
      <path d="M9 15.5l3-2.6 3 2.6" />
      <path d="M9.8 12.6a2.2 2 0 0 1 4.4 0" />
      <line x1="12" y1="10.6" x2="12" y2="9.2" />
      <path d="M11.3 9.2h1.4" />
      <path d="M3.3 15.5a1 1 0 0 1 2 0" />
      <path d="M18.7 15.5a1 1 0 0 1 2 0" />
    </svg>
  );
}

function Gopuram(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} strokeWidth={0.95}>
      <line x1="4" y1="21" x2="20" y2="21" />
      <path d="M6 21V17.5h12V21" />
      <path d="M6.6 17.5V14.6h10.8V17.5" />
      <path d="M7.3 14.6V11.9h9.4V14.6" />
      <path d="M8 11.9V9.4h8V11.9" />
      <path d="M8.8 9.4V7.2h6.4V9.4" />
      <path d="M9.2 7.2a2.8 1.6 0 0 1 5.6 0" />
      <line x1="12" y1="5.6" x2="12" y2="4.3" />
      <line x1="7.5" y1="19.3" x2="7.9" y2="18.5" />
      <line x1="16.5" y1="19.3" x2="16.1" y2="18.5" />
      <line x1="8" y1="16" x2="8.4" y2="15.2" />
      <line x1="16" y1="16" x2="15.6" y2="15.2" />
    </svg>
  );
}

function VictoriaMemorial(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} strokeWidth={0.95}>
      <line x1="2" y1="21" x2="22" y2="21" />
      <path d="M4 21v-6h16v6" />
      <path d="M9.2 15v-2h5.6v2" />
      <path d="M9.5 13a2.5 2.3 0 0 1 5 0" />
      <line x1="12" y1="10.7" x2="12" y2="9.3" />
      <circle cx="12" cy="8.8" r="0.5" />
      <path d="M5.8 15v-1.3h2.4v1.3" />
      <path d="M6.2 13.7a1 0.9 0 0 1 1.6 0" />
      <path d="M15.8 15v-1.3h2.4v1.3" />
      <path d="M16.2 13.7a1 0.9 0 0 1 1.6 0" />
      <path d="M10.6 21v-3.4a1.4 1.4 0 0 1 2.8 0V21" />
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

function Deekshabhoomi(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <line x1="2.5" y1="21" x2="21.5" y2="21" />
      <path d="M3.5 21V17.5h17V21" />
      <line x1="3.5" y1="17.5" x2="20.5" y2="17.5" />
      <line x1="5" y1="17.5" x2="5" y2="21" />
      <line x1="6.5" y1="17.5" x2="6.5" y2="21" />
      <line x1="8" y1="17.5" x2="8" y2="21" />
      <line x1="16" y1="17.5" x2="16" y2="21" />
      <line x1="17.5" y1="17.5" x2="17.5" y2="21" />
      <line x1="19" y1="17.5" x2="19" y2="21" />
      <path d="M10.3 21v-2.5a1.7 1.7 0 0 1 3.4 0V21" />
      <path d="M4.5 17.5c0.6-0.7 1.2-0.7 1.8 0c0.6-0.7 1.2-0.7 1.8 0c0.6-0.7 1.2-0.7 1.8 0c0.6-0.7 1.2-0.7 1.8 0c0.6-0.7 1.2-0.7 1.8 0c0.6-0.7 1.2-0.7 1.8 0c0.6-0.7 1.2-0.7 1.8 0c0.6-0.7 1.2-0.7 1.8 0" />
      <path d="M3.5 17.2C3.5 10 7 5.3 12 5.3S20.5 10 20.5 17.2" />
      <path d="M10.6 5.3V3.7h2.8v1.6" />
      <line x1="12" y1="3.7" x2="12" y2="2" />
      <path d="M11.3 2c0.4-0.5 1-0.5 1.4 0" />
    </svg>
  );
}

function HawaMahal(props: SVGProps<SVGSVGElement>) {
  const rows: { y: number; x0: number; x1: number; n: number }[] = [
    { y: 19.5, x0: 4.3, x1: 19.7, n: 7 },
    { y: 16.3, x0: 5.3, x1: 18.7, n: 6 },
    { y: 13.3, x0: 6.5, x1: 17.5, n: 5 },
    { y: 10.5, x0: 7.8, x1: 16.2, n: 4 },
  ];
  return (
    <svg {...base} {...props} strokeWidth={0.9}>
      <path d="M3.5 21V19.5H20.5V21" />
      <path d="M4.5 19.5V16.3H19.5V19.5" />
      <path d="M5.7 16.3V13.3H18.3V16.3" />
      <path d="M7 13.3V10.5H17V13.3" />
      <path d="M8.5 10.5V8.3H15.5V10.5" />
      <path d="M9 8.3a0.6 0.6 0 0 1 1.2 0" />
      <path d="M11.4 8.3a0.6 0.6 0 0 1 1.2 0" />
      <path d="M13.8 8.3a0.6 0.6 0 0 1 1.2 0" />
      {rows.flatMap((r) =>
        Array.from({ length: r.n }, (_, i) => {
          const cx = r.n === 1 ? r.x0 : r.x0 + ((r.x1 - r.x0) / (r.n - 1)) * i;
          return <circle key={`${r.y}-${i}`} cx={cx} cy={r.y - 1.1} r={0.35} fill={GREEN} stroke="none" />;
        })
      )}
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

function CitySkyline(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <line x1="2" y1="21" x2="22" y2="21" />
      <path d="M3.5 21V12h4v9" />
      <path d="M9 21V7h4v14" />
      <path d="M14.5 21V10h4v11" />
      <line x1="11" y1="7" x2="11" y2="4.5" />
      <line x1="9.5" y1="5.5" x2="12.5" y2="5.5" />
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
  Kolkata: VictoriaMemorial,
  Goa: PalmTree,
  Nagpur: Deekshabhoomi,
  Jaipur: HawaMahal,
  Ahmedabad: Kite,
};

/** A real landmark silhouette for known cities, generic skyline fallback
 * for anything else — new launches, US cities, etc. Always rendered in the
 * app's own accent green, regardless of where it's placed. */
export default function CityIcon({ city, size = 30, className }: { city: string; size?: number; className?: string }) {
  const Icon = CITY_LANDMARKS[city] ?? CitySkyline;
  return <Icon width={size} height={size} className={className} />;
}
