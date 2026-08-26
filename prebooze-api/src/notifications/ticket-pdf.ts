import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type { Booking, Event, Venue } from '@prisma/client';

type TicketBooking = Pick<Booking, 'id' | 'qrToken' | 'tierName' | 'mainGuest' | 'qty' | 'guests'>;

const GREEN = '#8bc34a';
const DARK = '#14150f';
const CARD = '#1f2118';
const MUTED = '#9a9d8c';

/** Real PDF ticket — generated fresh from the booking's own stored fields
 * every time it's sent, same "no binary stored, render from data" approach
 * as invoicePdfBuffer. The QR encodes the same signed booking.qrToken the
 * in-app download (lib/ticket.ts) and the gate scanner both already use —
 * one real check-in token, three ways to carry it (in-app PNG, WhatsApp/
 * email PDF, My Bookings page). */
export async function ticketPdfBuffer(booking: TicketBooking, event: Event, venue: Venue | null): Promise<Buffer> {
  const qrDataUrl = await QRCode.toDataURL(booking.qrToken || booking.id, { errorCorrectionLevel: 'H', margin: 1 });
  // Headcount, not ticket count — a "Couple"/"Group of N" tier's `qty` is
  // ticket units, but `guests` is one entry per actual person admitted.
  const headcount = Array.isArray(booking.guests) ? booking.guests.length : booking.qty;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [320, 480], margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, 320, 480).fill(DARK);
    doc.rect(12, 12, 296, 456).fill(CARD);

    doc.rect(12, 12, 296, 46).fill(GREEN);
    doc.fillColor(DARK).fontSize(16).font('Helvetica-Bold').text('PREBOOZE', 24, 27);
    doc.fontSize(8).font('Helvetica-Bold').text('E-TICKET', 24, 27, { width: 272, align: 'right' });

    let y = 76;
    doc.fillColor('#edefe6').fontSize(13).font('Helvetica-Bold').text(event.title, 24, y, { width: 272 });
    y += doc.heightOfString(event.title, { width: 272 }) + 10;

    doc.fillColor(MUTED).fontSize(9).font('Helvetica');
    doc.text(`${event.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${event.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`, 24, y, { width: 272 });
    y += 14;
    doc.text(venue ? `${venue.name}, ${venue.city}` : event.privateLocality && event.privateCity ? `${event.privateLocality}, ${event.privateCity}` : 'Venue TBA', 24, y, { width: 272 });
    y += 14;
    doc.text(booking.tierName, 24, y, { width: 272 });
    y += 14;
    doc.text(`${booking.mainGuest} · ${headcount} guest${headcount > 1 ? 's' : ''}`, 24, y, { width: 272 });
    y += 22;

    doc.moveTo(24, y).lineTo(296, y).dash(4, { space: 4 }).strokeColor('#3a3d30').stroke();
    doc.undash();
    y += 16;

    const qrSize = 180;
    const qrX = (320 - qrSize) / 2;
    doc.image(qrDataUrl, qrX, y, { width: qrSize, height: qrSize });
    y += qrSize + 10;

    doc.fillColor(MUTED).fontSize(8).font('Helvetica').text('Present this QR code at the gate for entry', 24, y, { width: 272, align: 'center' });
    y += 14;
    doc.fillColor(GREEN).fontSize(13).font('Helvetica-Bold').text(booking.id, 24, y, { width: 272, align: 'center' });
    y += 20;
    doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(`Scan at entry · valid for ${headcount} guest${headcount > 1 ? 's' : ''} · carry a photo ID`, 24, y, { width: 272, align: 'center' });
    y += 12;
    doc.text('prebooze.com', 24, y, { width: 272, align: 'center' });

    doc.end();
  });
}
