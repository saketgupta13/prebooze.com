import { useEffect, useState } from 'react';
import QRCodeLib from 'qrcode';

/** A real, standard-compliant QR code encoding `value` — scannable by any
 * QR reader, not just Prebooze's. High error-correction ('H', ~30%
 * tolerance) so the branded logo cutout in the center doesn't break
 * decodability, the same trick real-world branded tickets use.
 *
 * Standard black-on-white modules — settled here after repeated real-world
 * testing: green-on-black (the original brand look) consistently failed to
 * scan via the in-app camera scanner even after three separate scanner-side
 * fixes (inversion-polarity handling, higher capture resolution +
 * continuous autofocus, an Otsu-threshold binarization fallback), while a
 * phone's native camera app decoded the exact same physical code every
 * time. That consistent gap — every scanner-side patch helped in synthetic
 * tests but not in the field — pointed at the color choice itself, not the
 * scanner. Black-on-white is what every QR reader in existence is built
 * and tuned against; it's the one change that actually closed the gap. The
 * logo cutout stays branded (a separate overlay, not part of the scanned
 * modules) and shrunk (0.16 of size, not the original 0.26) to leave more
 * clean data regardless.
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
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [value, size]);

  // 0.26 (a good third of the code's width) was too much real occlusion for
  // jsQR specifically, even inside H-level error correction's ~30% budget —
  // real-world capture noise (glare, blur) eats into the same budget, and a
  // phone's native camera decoder tolerates that combination far better
  // than a small JS library does. 0.16 leaves meaningfully more clean data.
  const logo = Math.round(size * 0.16);
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
        <div style={{ width: size, height: size, borderRadius: 8, background: '#ffffff' }} />
      )}
      <span
        style={{
          // True center on both axes — this used to be `top: 14 + size/2`,
          // a fixed 14px offset below center that had nothing to do with
          // the QR itself (likely meant to visually balance against the
          // caption below, but it just left the badge off-center on the
          // code). `50%`/`50%` with the same translate centers it exactly.
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
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
