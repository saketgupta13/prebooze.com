/** Deterministic placeholder QR — real QR generation (signed booking token)
 * comes with the backend integration. */
export default function QRCode({ seed, size = 148, caption }: { seed: string; size?: number; caption?: string }) {
  const n = 21;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967295;
  };
  const cells: boolean[] = [];
  for (let i = 0; i < n * n; i++) cells.push(rand() > 0.52);

  const finder = (cx: number, cy: number, x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
      const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      return ring !== 2 && ring !== 3 ? true : ring === 3;
    }
    return null;
  };

  const logo = Math.round(size * 0.22);
  return (
    <div className="qr-wrap" style={{ position: 'relative', display: 'inline-block' }}>
      <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges">
        {Array.from({ length: n * n }, (_, i) => {
          const x = i % n;
          const y = Math.floor(i / n);
          const f = finder(0, 0, x, y) ?? finder(n - 7, 0, x, y) ?? finder(0, n - 7, x, y);
          const on = f !== null ? f : cells[i];
          return on ? <rect key={i} x={x} y={y} width={1} height={1} fill="#14150f" /> : null;
        })}
      </svg>
      <span
        style={{
          position: 'absolute', top: size / 2, left: '50%', transform: 'translate(-50%, -50%)',
          width: logo + 10, height: logo + 10, background: '#fff', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #fff',
        }}
      >
        <img src="/prebooze-logo.png" alt="" style={{ width: logo, height: logo, objectFit: 'contain' }} />
      </span>
      {caption && <span className="cap">{caption}</span>}
    </div>
  );
}
