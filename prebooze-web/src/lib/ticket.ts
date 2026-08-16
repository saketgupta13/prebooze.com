import QRCodeLib from 'qrcode';
import type { Booking, Event, Venue } from '../types';
import { fmtDate, fmtTime } from '../data/mock';

const loadImg = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

/** Render the ticket in our design onto a canvas and download it as a PNG. */
export async function downloadTicket(booking: Booking, event: Event, venue: Venue | undefined) {
  // Two different marks: the wordmark-ish full logo up top, and the plain
  // bunny icon cut into the QR's centre lower down — same split the rest
  // of the app already uses (compare the guest header vs. QRCode.tsx).
  const [logo, headerLogo] = await Promise.all([loadImg('/prebooze-mark.png'), loadImg('/prebooze-logo.png')]);
  const W = 640;
  const H = 980 + Math.max(0, Math.ceil(booking.guests.length / 2) - 1) * 20; // room for the guest list
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return;

  // background + card
  ctx.fillStyle = '#14150f';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1f2118';
  roundRect(ctx, 24, 24, W - 48, H - 48, 22);
  ctx.fill();

  // header — real logo, centered, no colored strip (previously a solid
  // green band with "PREBOOZE" typed out as text). "E-TICKET" sits below
  // the mark rather than beside a wordmark that no longer exists here.
  let headerBottom = 60;
  if (headerLogo) {
    const logoW = 220;
    const logoH = logoW * (headerLogo.height / headerLogo.width);
    ctx.drawImage(headerLogo, W / 2 - logoW / 2, 40, logoW, logoH);
    headerBottom = 40 + logoH;
  }
  ctx.fillStyle = '#9be13d';
  ctx.font = '700 13px Manrope, sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '2px';
  ctx.fillText('E-TICKET', W / 2, headerBottom + 26);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';

  // event details
  ctx.fillStyle = '#edefe6';
  ctx.font = '800 28px Manrope, sans-serif';
  wrapText(ctx, event.title, 48, 174, W - 96, 34);
  ctx.fillStyle = '#9a9d8c';
  ctx.font = '600 17px Manrope, sans-serif';
  ctx.fillText(`📅  ${fmtDate(event.date)} · ${fmtTime(event.date)}`, 48, 244);
  ctx.fillText(`📍  ${venue ? `${venue.name}, ${venue.city}` : 'Venue TBA'}`, 48, 272);
  ctx.fillText(`🎟  ${booking.tierName}`, 48, 300);
  ctx.fillText(`👤  ${booking.mainGuest} · ${booking.qty} guest${booking.qty > 1 ? 's' : ''}`, 48, 328);

  // divider (perforation)
  ctx.strokeStyle = '#3a3d30';
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(48, 362);
  ctx.lineTo(W - 48, 362);
  ctx.stroke();
  ctx.setLineDash([]);

  // QR block — real, standard QR encoding the booking's signed check-in
  // token (booking.qrToken), high error-correction so the logo cutout below
  // doesn't break decodability. Standard black-on-white modules — see
  // QRCode.tsx's doc comment: settled here after repeated real-world
  // testing showed green-on-black consistently failing to scan even after
  // three separate scanner-side fixes. This canvas path duplicates that
  // same QR independently (a downloadable/printable ticket, not the
  // on-screen component), so it needed the identical color choice.
  const qr = QRCodeLib.create(booking.qrToken || booking.id, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const qsize = 340;
  const cell = qsize / n;
  const qx = (W - qsize) / 2;
  const qy = 404;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, qx - 18, qy - 18, qsize + 36, qsize + 36, 14);
  ctx.fill();
  ctx.strokeStyle = '#9be13d';
  ctx.lineWidth = 2;
  roundRect(ctx, qx - 18, qy - 18, qsize + 36, qsize + 36, 14);
  ctx.stroke();
  ctx.fillStyle = '#000000';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.modules.get(y, x)) ctx.fillRect(qx + x * cell, qy + y * cell, cell + 0.5, cell + 0.5);
    }
  }

  // brand bunny in the QR centre on black — 0.16 of qsize (340), same
  // shrunk ratio as QRCode.tsx: the previous ~0.26 occluded too much real
  // data for jsQR specifically, even inside H-level error correction.
  const box = 54;
  ctx.fillStyle = '#000000';
  roundRect(ctx, W / 2 - box / 2 - 3, qy + qsize / 2 - box / 2 - 3, box + 6, box + 6, 12);
  ctx.fill();
  ctx.strokeStyle = '#9be13d';
  ctx.lineWidth = 1.5;
  roundRect(ctx, W / 2 - box / 2, qy + qsize / 2 - box / 2, box, box, 10);
  ctx.stroke();
  if (logo) {
    const pad = 6;
    ctx.drawImage(logo, W / 2 - box / 2 + pad, qy + qsize / 2 - box / 2 + pad, box - pad * 2, box - pad * 2);
  } else {
    ctx.fillStyle = '#9be13d';
    ctx.font = '800 34px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('P', W / 2, qy + qsize / 2 + 12);
    ctx.textAlign = 'left';
  }
  ctx.fillStyle = '#7d8070';
  ctx.font = '600 12px Manrope, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Present this QR code at the gate for entry', W / 2, qy + qsize + 36);
  ctx.textAlign = 'left';

  // booking id + guest list + footer
  ctx.fillStyle = '#9be13d';
  ctx.font = '800 22px Manrope, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(booking.id, W / 2, qy + qsize + 62);

  ctx.fillStyle = '#edefe6';
  ctx.font = '700 14px Manrope, sans-serif';
  ctx.fillText(`Guests on this ticket (${booking.guests.length})`, W / 2, qy + qsize + 92);
  ctx.fillStyle = '#b9bcab';
  ctx.font = '600 14px Manrope, sans-serif';
  let gy = qy + qsize + 114;
  const names = booking.guests.map((g, i) => `${i + 1}. ${g.name}`);
  let line = '';
  const flush = () => { if (line) { ctx.fillText(line, W / 2, gy); gy += 20; line = ''; } };
  for (const nm of names) {
    const test = line ? `${line}   ${nm}` : nm;
    if (ctx.measureText(test).width > W - 120 && line) flush();
    line = line ? `${line}   ${nm}` : nm;
  }
  flush();

  ctx.fillStyle = '#7d8070';
  ctx.font = '600 14px Manrope, sans-serif';
  ctx.fillText(`Scan at entry · valid for ${booking.qty} guest${booking.qty > 1 ? 's' : ''} · carry a photo ID`, W / 2, gy + 10);
  ctx.fillText('prebooze.com', W / 2, H - 40);
  ctx.textAlign = 'left';

  // Blob + object URL, not a raw data: URI — Safari (desktop and iOS) is
  // inconsistent about honoring `download` on a data: href, sometimes just
  // navigating to/rendering the URI instead of saving it. An object URL is
  // the reliable cross-browser way to trigger an actual file save, and the
  // anchor needs to be in the document for `.click()` to fire the download
  // dialog consistently rather than silently no-op.
  c.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prebooze-ticket-${booking.id.replace(/[^\w-]/g, '')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  ctx.fillText(line, x, yy);
}
