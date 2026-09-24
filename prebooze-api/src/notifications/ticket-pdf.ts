import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { join } from 'path';
import type { Booking, Event, Venue } from '@prisma/client';

type TicketBooking = Pick<Booking, 'id' | 'qrToken' | 'tierName' | 'mainGuest' | 'qty' | 'guests' | 'coverCharge'>;
type TicketEvent = Pick<Event, 'title' | 'date' | 'privateLocality' | 'privateCity'> & { organizer?: { brandName: string } | null };

const DARK = '#14150f';
const CARD = '#1f2118';
const ACCENT = '#9be13d';
const TEXT = '#edefe6';
const MUTED = '#9a9d8c';
const MUTED2 = '#7d8070';
const MUTED3 = '#b9bcab';
const DASH = '#3a3d30';

// Same two marks the in-app/web canvas ticket (lib/ticket.ts) uses — a
// wordmark-ish full logo up top, and the plain bunny icon cut into the QR's
// centre lower down. Copied in as real files (nest-cli.json's "assets" glob
// ships them to dist/notifications/assets) rather than fetched at render
// time, since this runs server-side with no browser Image() to load from.
const LOGO_PATH = join(__dirname, 'assets/prebooze-logo.png');
const MARK_PATH = join(__dirname, 'assets/prebooze-mark.png');

function wrapLines(doc: PDFKit.PDFDocument, text: string, maxW: number, fontSize: number): string[] {
  // Must measure with the same font the title actually draws in
  // (Helvetica-Bold) — measuring with the default (non-bold) font undercounts
  // each line's width, so PDFKit's own text() auto-wraps the "already
  // wrapped" bold line a second time and the two lines overlap.
  doc.font('Helvetica-Bold').fontSize(fontSize);
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (doc.widthOfString(test) > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  lines.push(line);
  return lines;
}

/** Real PDF ticket — generated fresh from the booking's own stored fields
 * every time it's sent, same "no binary stored, render from data" approach
 * as invoicePdfBuffer. The QR encodes the same signed booking.qrToken the
 * in-app download (lib/ticket.ts) and the gate scanner both already use —
 * one real check-in token, three ways to carry it (in-app PNG, WhatsApp/
 * email PDF, My Bookings page). Kept in step with lib/ticket.ts's design —
 * that canvas version got ~10 real design-iteration commits this one never
 * did (typed "PREBOOZE" text on a green strip instead of the real logo,
 * missing organizer/cover-charge/guest-list/thank-you content) until this
 * rewrite (2026-09-24).
 */
export async function ticketPdfBuffer(booking: TicketBooking, event: TicketEvent, venue: Venue | null): Promise<Buffer> {
  const qrDataUrl = await QRCode.toDataURL(booking.qrToken || booking.id, { errorCorrectionLevel: 'H', margin: 0, color: { dark: '#000000', light: '#ffffff' } });
  // Headcount, not ticket count — a "Couple"/"Group of N" tier's `qty` is
  // ticket units, but `guests` is one entry per actual person admitted.
  const guests: Array<{ name: string }> = Array.isArray(booking.guests) ? (booking.guests as Array<{ name: string }>) : [];
  const headcount = guests.length || booking.qty;

  const W = 360;
  const margin = 24;
  const contentW = W - margin * 2;
  const hasOrganizer = !!event.organizer?.brandName;
  const dateStr = `${event.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${event.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;

  // Measure the title's wrapped line count on a throwaway doc first — PDFKit
  // lays out top-down as content streams in, so the real page height (H)
  // can't be known until everything above the footer has actually been
  // drawn once. Cheaper to measure with a real (discarded) render than to
  // hand-precompute every line's height the way lib/ticket.ts's canvas
  // version does up front.
  const measureDoc = new PDFDocument({ size: [W, 2000], margin: 0 });
  const titleLines = wrapLines(measureDoc, event.title, contentW, 16);

  return new Promise((resolve, reject) => {
    let y = 0;
    measureDoc.on('data', () => {});
    measureDoc.on('end', () => {
      const H = Math.ceil(y);
      const finalDoc = new PDFDocument({ size: [W, H], margin: 0 });
      const chunks: Buffer[] = [];
      finalDoc.on('data', (c) => chunks.push(c));
      finalDoc.on('end', () => resolve(Buffer.concat(chunks)));
      finalDoc.on('error', reject);
      drawTicket(finalDoc, W, H, margin, contentW, booking, event, venue, qrDataUrl, headcount, guests, hasOrganizer, titleLines, dateStr);
      finalDoc.end();
    });
    measureDoc.on('error', reject);
    y = drawTicket(measureDoc, W, 2000, margin, contentW, booking, event, venue, qrDataUrl, headcount, guests, hasOrganizer, titleLines, dateStr);
    measureDoc.end();
  });
}

function drawTicket(
  doc: PDFKit.PDFDocument,
  W: number,
  H: number,
  margin: number,
  contentW: number,
  booking: TicketBooking,
  event: TicketEvent,
  venue: Venue | null,
  qrDataUrl: string,
  headcount: number,
  guests: Array<{ name: string }>,
  hasOrganizer: boolean,
  titleLines: string[],
  dateStr: string,
): number {
  doc.rect(0, 0, W, H).fill(DARK);
  doc.roundedRect(8, 8, W - 16, H - 16, 14).fill(CARD);

  let y = 32;
  try {
    const logoW = 130;
    doc.image(LOGO_PATH, W / 2 - logoW / 2, y, { width: logoW });
    y += logoW * (199 / 960) + 14;
  } catch {
    doc.fillColor(TEXT).fontSize(18).font('Helvetica-Bold').text('PREBOOZE', margin, y, { width: contentW, align: 'center' });
    y += 30;
  }
  doc.fillColor(ACCENT).fontSize(9).font('Helvetica-Bold').text('E-TICKET', margin, y, { width: contentW, align: 'center', characterSpacing: 1.5 });
  y += 26;

  doc.fillColor(TEXT).fontSize(16).font('Helvetica-Bold');
  titleLines.forEach((l, i) => doc.text(l, margin, y + i * 20, { width: contentW, lineBreak: false }));
  y += titleLines.length * 20 + 8;

  if (hasOrganizer) {
    doc.fillColor(ACCENT).fontSize(10).font('Helvetica-Bold').text(`Hosted by ${event.organizer!.brandName}`, margin, y, { width: contentW });
    y += 20;
  }

  doc.fillColor(MUTED).fontSize(9.5).font('Helvetica');
  doc.text(dateStr, margin, y, { width: contentW });
  y += 16;
  doc.text(venue ? `${venue.name}, ${venue.city}` : event.privateLocality && event.privateCity ? `${event.privateLocality}, ${event.privateCity}` : 'Venue TBA', margin, y, { width: contentW });
  y += 16;
  doc.text(booking.tierName, margin, y, { width: contentW });
  y += 16;
  doc.text(`${booking.mainGuest} · ${headcount} guest${headcount > 1 ? 's' : ''}`, margin, y, { width: contentW });
  y += 16;

  if (booking.coverCharge) {
    // Rs., not ₹ — PDFKit's standard Helvetica font has no Rupee glyph in its
    // WinAnsi encoding, same reason invoice-pdf.ts already avoids it.
    doc.fillColor(ACCENT).fontSize(10).font('Helvetica-Bold').text(`Includes Rs. ${booking.coverCharge.toLocaleString('en-IN')} redeemable at the venue`, margin, y, { width: contentW });
    y += 22;
  } else {
    y += 4;
  }

  doc.moveTo(margin, y).lineTo(W - margin, y).dash(6, { space: 8 }).strokeColor(DASH).stroke();
  doc.undash();
  y += 20;

  const qrSize = 190;
  const qrX = (W - qrSize) / 2;
  const pad = 10;
  doc.roundedRect(qrX - pad, y - pad, qrSize + pad * 2, qrSize + pad * 2, 10).fillAndStroke('#ffffff', ACCENT);
  doc.image(qrDataUrl, qrX, y, { width: qrSize, height: qrSize });

  const box = 30;
  const cx = W / 2;
  const cy = y + qrSize / 2;
  doc.roundedRect(cx - box / 2 - 2, cy - box / 2 - 2, box + 4, box + 4, 6).fillAndStroke('#000000', ACCENT);
  try {
    const ip = 4;
    doc.image(MARK_PATH, cx - box / 2 + ip, cy - box / 2 + ip, { width: box - ip * 2, height: box - ip * 2 });
  } catch {
    doc.fillColor(ACCENT).fontSize(16).font('Helvetica-Bold').text('P', cx - 6, cy - 8);
  }

  y += qrSize + pad * 2 + 16;
  doc.fillColor(MUTED2).fontSize(8).font('Helvetica').text('Present this QR code at the gate for entry', margin, y, { width: contentW, align: 'center' });
  y += 16;
  doc.fillColor(ACCENT).fontSize(13).font('Helvetica-Bold').text(booking.id, margin, y, { width: contentW, align: 'center' });
  y += 22;

  doc.fillColor(TEXT).fontSize(10).font('Helvetica-Bold').text(`Guests on this ticket (${guests.length || headcount})`, margin, y, { width: contentW, align: 'center' });
  y += 16;
  doc.fillColor(MUTED3).fontSize(9.5).font('Helvetica');
  const names = guests.length ? guests.map((g, i) => `${i + 1}. ${g.name}`) : [`1. ${booking.mainGuest}`];
  let line = '';
  const flush = () => {
    if (line) {
      doc.text(line, margin, y, { width: contentW, align: 'center' });
      y += 14;
      line = '';
    }
  };
  for (const nm of names) {
    const test = line ? `${line}   ${nm}` : nm;
    if (doc.widthOfString(test) > contentW && line) flush();
    line = line ? `${line}   ${nm}` : nm;
  }
  flush();
  y += 6;

  doc.fillColor(MUTED2).fontSize(9).font('Helvetica').text(`Scan at entry · valid for ${headcount} guest${headcount > 1 ? 's' : ''} · carry a photo ID`, margin, y, { width: contentW, align: 'center' });
  y += 22;

  doc.fillColor(TEXT).fontSize(10).font('Helvetica-Bold').text('Thanks for booking with Prebooze — see you there!', margin, y, { width: contentW, align: 'center' });
  y += 26;

  doc.fillColor(MUTED2).fontSize(8).font('Helvetica').text('Terms & conditions apply — www.prebooze.com/legal/terms', margin, y, { width: contentW, align: 'center' });
  y += 14;
  doc.fillColor(MUTED2).fontSize(8.5).font('Helvetica').text('www.prebooze.com', margin, y, { width: contentW, align: 'center' });
  y += 28;
  return y;
}
