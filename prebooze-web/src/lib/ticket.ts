import QRCodeLib from 'qrcode';
import type { Booking, Event, Venue } from '../types';
import { fmtDate, fmtTime } from '../data/mock';
import { platform } from '../api';
import { instagramHandle } from './social';

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
  const [logo, headerLogo, settings] = await Promise.all([
    loadImg('/prebooze-mark.png'),
    loadImg('/prebooze-logo.png'),
    platform.settings().catch(() => null),
  ]);
  const igHandle = instagramHandle(settings?.socials.instagram);
  const W = 640;

  // The title can wrap to 1 or 2 lines and the organizer line is optional
  // (older bookings' events weren't fetched with organizer included) — so
  // everything below the title has to flow from where the title actually
  // ended, not a fixed guess. Measure first on a throwaway context (canvas
  // pixel size doesn't affect measureText) and compute every y-coordinate
  // up front, once — the draw step below just uses these same numbers
  // rather than re-deriving them, so the two can't drift out of sync.
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = '800 28px Manrope, sans-serif';
  const titleLines = wrapLines(measure, event.title, W - 96);

  const hasOrganizer = !!event.organizer?.brandName;
  const titleLastY = 174 + (titleLines.length - 1) * 34;
  const organizerY = titleLastY + 40;
  const dateY = (hasOrganizer ? organizerY : titleLastY) + (hasOrganizer ? 38 : 70);
  const locationY = dateY + 28;
  const tierY = locationY + 28;
  const guestY = tierY + 28;
  const coverY = guestY + 28;
  const dividerY = (booking.coverCharge ? coverY : guestY) + 34;
  const qy = dividerY + 42;
  const qsize = 340;
  const tailFromQy = 632; // QR block + footer height (thank-you + Instagram + domain), fixed regardless of header/title height
  const guestListExtra = Math.max(0, Math.ceil(booking.guests.length / 2) - 1) * 20;
  const H = qy + tailFromQy + guestListExtra;
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
  titleLines.forEach((l, i) => ctx.fillText(l, 48, 174 + i * 34));

  // organizer — who's actually hosting, not just what/when/where. Only
  // present when the booking's event was fetched with organizer included
  // (BookingsService's create/adminCreate/list all do, as of this).
  if (hasOrganizer) {
    ctx.fillStyle = '#9be13d';
    ctx.font = '700 15px Manrope, sans-serif';
    ctx.fillText(`🎪  Hosted by ${event.organizer!.brandName}`, 48, organizerY);
  }

  ctx.fillStyle = '#9a9d8c';
  ctx.font = '600 17px Manrope, sans-serif';
  ctx.fillText(`📅  ${fmtDate(event.date)} · ${fmtTime(event.date)}`, 48, dateY);
  ctx.fillText(`📍  ${venue ? `${venue.name}, ${venue.city}` : 'Venue TBA'}`, 48, locationY);
  ctx.fillText(`🎟  ${booking.tierName}`, 48, tierY);
  ctx.fillText(`👤  ${booking.mainGuest} · ${booking.qty} guest${booking.qty > 1 ? 's' : ''}`, 48, guestY);
  if (booking.coverCharge) {
    ctx.fillStyle = '#9be13d';
    ctx.font = '700 15px Manrope, sans-serif';
    ctx.fillText(`🍹  Includes ₹${booking.coverCharge} redeemable at the venue`, 48, coverY);
    ctx.fillStyle = '#9a9d8c';
    ctx.font = '600 17px Manrope, sans-serif';
  }

  // divider (perforation)
  ctx.strokeStyle = '#3a3d30';
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(48, dividerY);
  ctx.lineTo(W - 48, dividerY);
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
  const cell = qsize / n;
  const qx = (W - qsize) / 2;
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

  ctx.fillStyle = '#edefe6';
  ctx.font = '700 15px Manrope, sans-serif';
  ctx.fillText('Thanks for booking with Prebooze — see you there! 🎉', W / 2, gy + 40);

  if (igHandle) {
    ctx.fillStyle = '#9be13d';
    ctx.font = '600 13px Manrope, sans-serif';
    ctx.fillText(`📸  Follow us @${igHandle} on Instagram`, W / 2, gy + 64);
  }

  ctx.fillStyle = '#7d8070';
  ctx.font = '600 11px Manrope, sans-serif';
  ctx.fillText('Terms & conditions apply — www.prebooze.com/legal/terms', W / 2, H - 60);
  ctx.font = '600 12px Manrope, sans-serif';
  ctx.fillText('www.prebooze.com', W / 2, H - 40);
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

/** Word-wraps `text` to `maxW`, returning the lines rather than drawing
 * them directly — the caller needs to know how many lines it'll take
 * (the title can run 1 or 2 lines) before it can lay out everything below
 * it, so measuring and drawing had to split into separate steps. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  lines.push(line);
  return lines;
}
