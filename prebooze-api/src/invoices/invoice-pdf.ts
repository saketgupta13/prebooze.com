import PDFDocument from 'pdfkit';
import type { Invoice } from '@prisma/client';

const GREEN = '#8bc34a';
const MUTED = '#666666';

/** Real PDF, generated fresh from the stored Invoice row every time it's
 * downloaded/resent — nothing binary is kept in the database, the row's
 * scalar fields are the single source of truth and this is a pure
 * projection of them, same reasoning as rendering an email from data
 * instead of storing rendered HTML. */
export function invoicePdfBuffer(inv: Invoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor(GREEN).fontSize(20).font('Helvetica-Bold').text('PREBOOZE', 50, 50);
    // "Tax Invoice" is reserved for a GST-registered issuer — Prebooze
    // isn't, so this is always a plain Invoice.
    doc.fillColor('#000').fontSize(9).font('Helvetica').text('Invoice', 50, 74);

    doc.fontSize(10).fillColor('#000');
    doc.text(`Invoice No.: ${inv.number}`, 350, 50, { align: 'right', width: 195 });
    doc.text(`Date: ${inv.issuedAt.toISOString().slice(0, 10)}`, 350, 65, { align: 'right', width: 195 });
    doc.text(`Status: ${inv.status === 'issued' ? 'Issued' : 'Void'}`, 350, 80, { align: 'right', width: 195 });

    doc.moveTo(50, 105).lineTo(545, 105).strokeColor('#ddd').stroke();

    doc.fillColor(MUTED).fontSize(9).text('BILL TO', 50, 120);
    doc.fillColor('#000').fontSize(11).font('Helvetica-Bold').text(inv.payerBrand || inv.payerName, 50, 134);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    let y = 150;
    if (inv.payerBrand) { doc.text(`Contact: ${inv.payerName}`, 50, y); y += 13; }
    if (inv.payerEmail) { doc.text(inv.payerEmail, 50, y); y += 13; }
    if (inv.payerPhone) { doc.text(inv.payerPhone, 50, y); y += 13; }
    if (inv.city) { doc.text(inv.city, 50, y); y += 13; }
    if (inv.payerGstin) { doc.text(`GSTIN: ${inv.payerGstin}`, 50, y); y += 13; }
    if (inv.payerPan) { doc.text(`PAN: ${inv.payerPan}`, 50, y); y += 13; }
    doc.text(`Role: ${cap(inv.role)}`, 50, y);
    y += 13;

    const tableTop = Math.max(220, y + 16);
    doc.fillColor('#fff').rect(50, tableTop, 495, 22).fill(GREEN);
    doc.fillColor('#000').fontSize(9).font('Helvetica-Bold');
    doc.text('DESCRIPTION', 58, tableTop + 6);
    doc.text('AMOUNT', 470, tableTop + 6, { align: 'right', width: 67 });

    let rowY = tableTop + 30;
    doc.font('Helvetica').fontSize(10).fillColor('#000');
    doc.text(inv.description, 58, rowY, { width: 380 });
    doc.text(fmt(inv.subtotal), 470, rowY, { align: 'right', width: 67 });

    rowY += 26;
    doc.moveTo(50, rowY - 6).lineTo(545, rowY - 6).strokeColor('#eee').stroke();

    doc.moveTo(300, rowY).lineTo(545, rowY).strokeColor('#000').stroke();
    rowY += 8;
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('TOTAL', 350, rowY);
    doc.text(fmt(inv.total), 470, rowY, { align: 'right', width: 67 });

    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text('This is a system-generated invoice from Prebooze. For questions, contact support via the website or email info@prebooze.com.', 50, 760, { width: 495, align: 'center' });

    doc.end();
  });
}

const fmt = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-IN')}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
