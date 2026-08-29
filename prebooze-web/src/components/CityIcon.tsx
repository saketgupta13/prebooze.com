import type { ReactElement, SVGProps } from 'react';

/** Detailed line-art landmark icons for the city picker — drawn to match
 * BookMyShow's actual city-picker reference (thin architectural outline
 * icons: Gateway of India for Mumbai, Charminar for Hyderabad, Victoria
 * Memorial for Kolkata, etc.), just in the app's own accent green instead
 * of their black. No colored badge/background — same plain-icon-plus-label
 * layout as the reference. Deliberately independent of the City.icon DB
 * field — see CityPicker.tsx. */

const GREEN = '#9be13d';

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: GREEN,
  strokeWidth: 1.1,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function GatewayOfIndia(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <line x1="2" y1="21" x2="22" y2="21" />
      <line x1="3" y1="19.3" x2="21" y2="19.3" />
      <line x1="4.2" y1="8" x2="4.2" y2="19.3" />
      <path d="M3.3 8a0.9 1.4 0 0 1 1.8 0" />
      <line x1="4.2" y1="6.5" x2="4.2" y2="8" />
      <line x1="19.8" y1="8" x2="19.8" y2="19.3" />
      <path d="M18.9 8a0.9 1.4 0 0 1 1.8 0" />
      <line x1="19.8" y1="6.5" x2="19.8" y2="8" />
      <path d="M7.5 19.3V12a4.5 4.5 0 0 1 9 0v7.3" />
      <path d="M8.8 19.3V12.3a3.2 3.2 0 0 1 6.4 0v7" />
      <line x1="10.3" y1="6.4" x2="10.3" y2="7.6" />
      <line x1="12" y1="6" x2="12" y2="7.6" />
      <line x1="13.7" y1="6.4" x2="13.7" y2="7.6" />
    </svg>
  );
}

function IndiaGate(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="4.3" y1="19.4" x2="19.7" y2="19.4" />
      <path d="M6 19.4V9.5a6 6 0 0 1 12 0v9.9" />
      <path d="M7.4 19.4V9.8a4.6 4.6 0 0 1 9.2 0v9.6" />
      <line x1="6" y1="14" x2="7.4" y2="14" />
      <line x1="16.6" y1="14" x2="18" y2="14" />
    </svg>
  );
}

function VidhanaSoudha(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <line x1="2.5" y1="21" x2="21.5" y2="21" />
      <path d="M4 21V14.5h16V21" />
      <path d="M9.3 14.5a2.7 2.7 0 0 1 5.4 0" />
      <circle cx="12" cy="10.3" r="0.55" />
      <line x1="12" y1="11.8" x2="12" y2="10.85" />
      <line x1="6.3" y1="14.5" x2="6.3" y2="21" />
      <line x1="9" y1="14.5" x2="9" y2="21" />
      <line x1="15" y1="14.5" x2="15" y2="21" />
      <line x1="17.7" y1="14.5" x2="17.7" y2="21" />
    </svg>
  );
}

function Charminar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} strokeWidth={1.05}>
      <line x1="2.5" y1="21" x2="21.5" y2="21" />
      <line x1="3.4" y1="9.5" x2="3.4" y2="21" />
      <path d="M2.6 9.5a0.8 1.2 0 0 1 1.6 0" />
      <line x1="3.4" y1="8.1" x2="3.4" y2="9.5" />
      <line x1="8.3" y1="9.5" x2="8.3" y2="21" />
      <path d="M7.5 9.5a0.8 1.2 0 0 1 1.6 0" />
      <line x1="8.3" y1="8.1" x2="8.3" y2="9.5" />
      <line x1="15.7" y1="9.5" x2="15.7" y2="21" />
      <path d="M14.9 9.5a0.8 1.2 0 0 1 1.6 0" />
      <line x1="15.7" y1="8.1" x2="15.7" y2="9.5" />
      <line x1="20.6" y1="9.5" x2="20.6" y2="21" />
      <path d="M19.8 9.5a0.8 1.2 0 0 1 1.6 0" />
      <line x1="20.6" y1="8.1" x2="20.6" y2="9.5" />
      <path d="M9.5 21v-5.2a2.5 2.5 0 0 1 5 0V21" />
      <path d="M10.4 12.4v-1.6a1.6 1.6 0 0 1 3.2 0v1.6" />
    </svg>
  );
}

function Gopuram(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} strokeWidth={1.05}>
      <line x1="3" y1="21" x2="21" y2="21" />
      <path d="M5 21l1.3-3.4h11.4L19 21" />
      <path d="M6.8 17.6l1.1-3h8.2l1.1 3" />
      <path d="M8.4 14.6l1-2.6h5.2l1 2.6" />
      <path d="M9.9 12l0.8-2.2h2.6l0.8 2.2" />
      <path d="M11.1 9.8l0.5-1.8h0.8l0.5 1.8" />
      <line x1="6.9" y1="19.2" x2="7.4" y2="18.3" />
      <line x1="17.1" y1="19.2" x2="16.6" y2="18.3" />
      <line x1="8.1" y1="16.2" x2="8.5" y2="15.4" />
      <line x1="15.9" y1="16.2" x2="15.5" y2="15.4" />
    </svg>
  );
}

function VictoriaMemorial(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} strokeWidth={1.05}>
      <line x1="2" y1="21" x2="22" y2="21" />
      <path d="M4.5 21v-5.5h15V21" />
      <path d="M9.3 15.5v-1.6h5.4v1.6" />
      <path d="M9.6 13.9a2.4 2.2 0 0 1 4.8 0" />
      <line x1="12" y1="11.7" x2="12" y2="10.4" />
      <circle cx="12" cy="9.9" r="0.5" />
      <path d="M5.6 15.5a1 1 0 0 1 2 0" />
      <path d="M16.4 15.5a1 1 0 0 1 2 0" />
      <line x1="7.2" y1="15.5" x2="7.2" y2="21" />
      <line x1="16.8" y1="15.5" x2="16.8" y2="21" />
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
  const windows: [number, number][] = [
    [8, 10.2], [12, 8.6], [16, 10.2],
    [7, 14], [12, 13], [17, 14],
    [9, 17.4], [15, 17.4],
  ];
  return (
    <svg {...base} {...props} strokeWidth={1}>
      <path d="M4 20V10a8 8 0 0 1 16 0v10" />
      <line x1="4" y1="20" x2="20" y2="20" />
      {windows.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={0.55} fill={GREEN} stroke="none" />
      ))}
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
  Nagpur: Orange,
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
