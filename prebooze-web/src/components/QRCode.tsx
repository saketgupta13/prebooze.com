/** Prebooze proprietary entry code — NOT a standard QR. The matrix is derived
 * from a salted hash of the booking token (no format/timing patterns), so
 * generic QR readers can't decode it — only the Prebooze scanner, which
 * validates the same salted derivation server-side, accepts it. Real signed
 * tokens come with the backend (see BACKEND.md → Real QR). */
const SALT = 'PBZ1|';

export default function QRCode({ seed, size = 148, caption }: { seed: string; size?: number; caption?: string }) {
  const n = 21;
  const salted = SALT + seed;
  let h = 2166136261;
  for (let i = 0; i < salted.length; i++) {
    h ^= salted.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967295;
  };
  const cells: boolean[] = [];
  for (let i = 0; i < n * n; i++) cells.push(rand() > 0.58);

  const finder = (cx: number, cy: number, x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
      const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      return ring !== 2 && ring !== 3 ? true : ring === 3;
    }
    return null;
  };

  const logo = Math.round(size * 0.26);
  return (
    <div className="qr-wrap" style={{ position: 'relative', display: 'inline-block' }}>
      <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" style={{ borderRadius: 8, display: 'block' }}>
        <rect x={0} y={0} width={n} height={n} fill="#000000" />
        {Array.from({ length: n * n }, (_, i) => {
          const x = i % n;
          const y = Math.floor(i / n);
          const f = finder(0, 0, x, y) ?? finder(n - 7, 0, x, y) ?? finder(0, n - 7, x, y);
          const on = f !== null ? f : cells[i];
          return on ? <rect key={i} x={x} y={y} width={1} height={1} fill="#9be13d" /> : null;
        })}
      </svg>
      <span
        style={{
          position: 'absolute', top: 14 + size / 2, left: '50%', transform: 'translate(-50%, -50%)',
          width: logo + 10, height: logo + 10, background: '#000', borderRadius: 8,
          border: '1.5px solid #9be13d',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 3px #000',
        }}
      >
        <img src="/prebooze-mark.png" alt="" style={{ width: logo, height: logo, objectFit: 'contain' }} />
      </span>
      {caption && <span className="cap">{caption}</span>}
    </div>
  );
}
