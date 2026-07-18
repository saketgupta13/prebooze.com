import type { Booking, Event, Venue } from '../types';
import { fmtDate, fmtTime } from '../data/mock';

/** Same deterministic pattern as the on-screen QRCode component. */
function qrCells(seed: string, n = 21): boolean[] {
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
  return cells;
}

const finder = (cx: number, cy: number, x: number, y: number): boolean | null => {
  const dx = x - cx;
  const dy = y - cy;
  if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
    const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
    return ring !== 2 && ring !== 3 ? true : ring === 3;
  }
  return null;
};

/** Render the ticket in our design onto a canvas and download it as a PNG. */
export function downloadTicket(booking: Booking, event: Event, venue: Venue | undefined) {
  const W = 640;
  const H = 960;
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

  // header band
  ctx.fillStyle = '#9be13d';
  roundRect(ctx, 24, 24, W - 48, 92, 22);
  ctx.fill();
  ctx.fillStyle = '#1f2118';
  ctx.fillRect(24, 84, W - 48, 32);
  ctx.fillStyle = '#14150f';
  ctx.font = '800 30px Manrope, sans-serif';
  ctx.fillText('PREBOOZE', 48, 74);
  ctx.font = '700 15px Manrope, sans-serif';
  ctx.fillText('E-TICKET', W - 130, 74);

  // event details
  ctx.fillStyle = '#edefe6';
  ctx.font = '800 28px Manrope, sans-serif';
  wrapText(ctx, event.title, 48, 160, W - 96, 34);
  ctx.fillStyle = '#9a9d8c';
  ctx.font = '600 17px Manrope, sans-serif';
  ctx.fillText(`📅  ${fmtDate(event.date)} · ${fmtTime(event.date)}`, 48, 230);
  ctx.fillText(`📍  ${venue ? `${venue.name}, ${venue.city}` : 'Venue TBA'}`, 48, 258);
  ctx.fillText(`🎟  ${booking.tierName}`, 48, 286);
  ctx.fillText(`👤  ${booking.mainGuest} · ${booking.qty} guest${booking.qty > 1 ? 's' : ''}`, 48, 314);

  // divider (perforation)
  ctx.strokeStyle = '#3a3d30';
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(48, 348);
  ctx.lineTo(W - 48, 348);
  ctx.stroke();
  ctx.setLineDash([]);

  // QR block
  const n = 21;
  const qsize = 340;
  const cell = qsize / n;
  const qx = (W - qsize) / 2;
  const qy = 390;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, qx - 18, qy - 18, qsize + 36, qsize + 36, 14);
  ctx.fill();
  const cells = qrCells(booking.id);
  ctx.fillStyle = '#14150f';
  for (let i = 0; i < n * n; i++) {
    const x = i % n;
    const y = Math.floor(i / n);
    const f = finder(0, 0, x, y) ?? finder(n - 7, 0, x, y) ?? finder(0, n - 7, x, y);
    const on = f !== null ? f : cells[i];
    if (on) ctx.fillRect(qx + x * cell, qy + y * cell, cell + 0.5, cell + 0.5);
  }

  // booking id + footer
  ctx.fillStyle = '#9be13d';
  ctx.font = '800 22px Manrope, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(booking.id, W / 2, qy + qsize + 62);
  ctx.fillStyle = '#7d8070';
  ctx.font = '600 14px Manrope, sans-serif';
  ctx.fillText(`Scan at entry · valid for ${booking.qty} guest${booking.qty > 1 ? 's' : ''} · carry a photo ID`, W / 2, qy + qsize + 92);
  ctx.fillText('prebooze.com', W / 2, H - 52);
  ctx.textAlign = 'left';

  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = `prebooze-ticket-${booking.id.replace(/[^\w-]/g, '')}.png`;
  a.click();
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
