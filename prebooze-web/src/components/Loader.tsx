import { usePlatformInfo } from '../lib/usePlatformInfo';

/** Real platform logo (admin-uploaded, same source as the header), pulsing
 * in place of a generic spinner — used for every full-page loading state
 * instead of plain "Loading…" text. */
export default function Loader({ size = 52 }: { size?: number }) {
  const { logoUrl } = usePlatformInfo();
  return (
    <img
      src={logoUrl || '/prebooze-logo.png'}
      alt="Loading…"
      className="loader-logo"
      style={{ width: size, height: size }}
    />
  );
}

/** Full-page variant — drop-in replacement for the old
 * `<main className="page"><div className="container center">Loading…</div></main>` blocks. */
export function PageLoader() {
  return (
    <main className="page">
      <div className="container center" style={{ padding: '80px 0' }}>
        <Loader size={56} />
      </div>
    </main>
  );
}
