/** A real, standard-compliant QR code encoding `value` — the exact same
 * signed JWT the guest's own ticket renders (see prebooze-web's QRCode.tsx,
 * which this was ported from), so what admin sees here is the real code
 * scannable by the organizer Scanner or any QR reader, not a decorative
 * lookalike. High error-correction ('H', ~30% tolerance) so the branded
 * logo cutout in the center doesn't break decodability. Standard
 * black-on-white modules — green-on-black consistently failed to scan via
 * the in-app camera scanner in real-world testing (see prebooze-web's
 * QRCode.tsx for the full investigation); this mirrors that fix exactly so
 * a code that scans on a guest's phone also scans here. */
import { useEffect, useState } from 'react';
import QRCodeLib from 'qrcode';
import { useBranding } from '../lib/useBranding';

export default function QRCode({ value, size = 148, caption }: { value: string; size?: number; caption?: string }) {
  const { logoUrl } = useBranding();
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCodeLib.toDataURL(value, {
      errorCorrectionLevel: 'H',
      margin: 1,
      scale: 14,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [value]);

  const logo = Math.round(size * 0.16);
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        {dataUrl ? (
          <img src={dataUrl} alt="Entry QR code" width={size} height={size} style={{ borderRadius: 8, display: 'block' }} />
        ) : (
          <div style={{ width: size, height: size, borderRadius: 8, background: '#ffffff' }} />
        )}
        <span
          style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: logo + 10, height: logo + 10, background: '#000', borderRadius: 8,
            border: '1.5px solid #9be13d',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 3px #000',
          }}
        >
          <img src={logoUrl || '/logo.png'} alt="" style={{ width: logo, height: logo, objectFit: 'contain' }} />
        </span>
      </div>
      {caption && <div style={{ fontSize: 11, fontWeight: 700, color: '#9be13d', textAlign: 'center' }}>{caption}</div>}
    </div>
  );
}
