import { useEffect, useState } from 'react';
import QRCodeLib from 'qrcode';

/** A real, standard-compliant QR code encoding `value` — scannable by any
 * QR reader, not just Prebooze's. High error-correction ('H', ~30%
 * tolerance) so the branded logo cutout in the center doesn't break
 * decodability, the same trick real-world branded tickets use.
 *
 * `value` is a signed JWT (see BookingsService.create's qrToken), not a
 * short opaque id — that's what makes this a genuinely dense code (version
 * 13, 69x69 modules for a typical booking). Displaying that dense a code at
 * a small physical size leaves very little real-world margin for a gate
 * scanner against screen glare, hand-shake, or an imperfect angle, even
 * though it decodes fine in a clean digital test — 148 was too small in
 * practice (see the organizer-scanner gate-check fix this size bump shipped
 * alongside). 220 gives real cameras meaningfully more area to resolve the
 * same module count into. */
export default function QRCode({ value, size = 220, caption }: { value: string; size?: number; caption?: string }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCodeLib.toDataURL(value, {
      errorCorrectionLevel: 'H',
      margin: 1,
      // `scale` (px per module) instead of `width` — forcing an exact pixel
      // `width` makes the library pad any leftover fractional-module space
      // onto the right/bottom edge in the background color, visible as an
      // uneven dead black bar. Scale always tiles exactly, no padding.
      scale: 14,
      color: { dark: '#9be13d', light: '#000000' },
    })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [value, size]);

  const logo = Math.round(size * 0.26);
  return (
    // NOTE: no `display` here — the .qr-wrap CSS class already sets
    // `display: inline-flex` (column, centered), which is what actually
    // keeps the image and the absolutely-positioned logo centered on the
    // same box. An inline `display` here previously silently overrode it,
    // widening the box to the caption text's width and dragging the logo
    // off-center along with it.
    <div className="qr-wrap" style={{ position: 'relative' }}>
      {dataUrl ? (
        <img src={dataUrl} alt="Entry QR code" width={size} height={size} style={{ borderRadius: 8, display: 'block' }} />
      ) : (
        <div style={{ width: size, height: size, borderRadius: 8, background: '#000000' }} />
      )}
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
