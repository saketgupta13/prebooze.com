import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../notifications/email';
import { WhatsappService } from '../notifications/whatsapp';
import { money } from '../notifications/email-templates';
import { invoicePdfBuffer } from './invoice-pdf';

export interface CreateInvoiceInput {
  type: 'booking' | 'featured';
  refId: string;
  role: 'guest' | 'organizer' | 'promoter' | 'venue' | 'lineup';
  payerName: string;
  payerEmail?: string | null;
  payerPhone?: string | null;
  city?: string | null;
  description: string;
  subtotal: number;
  gstPct?: number;
  gstAmount?: number;
  total: number;
}

export interface InvoiceFilters {
  role?: string;
  city?: string;
  type?: string;
  from?: string; // ISO date
  to?: string; // ISO date
}

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private wa: WhatsappService,
  ) {}

  /** Sequential, gap-free numbering (Indian GST invoicing convention) via an
   * atomic counter increment in the same transaction as the row create —
   * two concurrent bookings can never be handed the same number. */
  async create(input: CreateInvoiceInput) {
    const year = new Date().getFullYear();
    return this.prisma.$transaction(async (tx) => {
      const counter = await tx.invoiceCounter.upsert({
        where: { id: 'main' },
        update: { value: { increment: 1 } },
        create: { id: 'main', value: 1 },
      });
      const number = `INV-${year}-${String(counter.value).padStart(6, '0')}`;
      return tx.invoice.create({
        data: {
          number,
          type: input.type,
          refId: input.refId,
          role: input.role,
          payerName: input.payerName,
          payerEmail: input.payerEmail || null,
          payerPhone: input.payerPhone || null,
          city: input.city || null,
          description: input.description,
          subtotal: input.subtotal,
          gstPct: input.gstPct ?? 0,
          gstAmount: input.gstAmount ?? 0,
          total: input.total,
        },
      });
    });
  }

  async list(filters: InvoiceFilters) {
    return this.prisma.invoice.findMany({
      where: {
        ...(filters.role ? { role: filters.role } : {}),
        ...(filters.city ? { city: filters.city } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.from || filters.to
          ? { issuedAt: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59`) } : {}) } }
          : {}),
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async get(id: string) {
    const inv = await this.prisma.invoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  /** Self-serve invoice history — Invoice has no organizerId/userId column
   * (only payer contact fields), so ownership is matched on the caller's own
   * phone number (User.phone is unique) the same way it was written at
   * FeaturedService.request() time. */
  async mine(role: string, payerPhone: string) {
    return this.prisma.invoice.findMany({ where: { role, payerPhone }, orderBy: { issuedAt: 'desc' } });
  }

  /** Ownership-checked PDF fetch for the self-serve endpoints — throws
   * instead of returning someone else's invoice if the phone doesn't match. */
  async pdfForOwner(id: string, role: string, payerPhone: string) {
    const inv = await this.get(id);
    if (inv.role !== role || inv.payerPhone !== payerPhone) throw new NotFoundException('Invoice not found');
    return this.pdf(id);
  }

  async pdf(id: string) {
    const inv = await this.get(id);
    const buffer = await invoicePdfBuffer(inv);
    return { filename: `${inv.number}.pdf`, buffer };
  }

  async resendEmail(id: string) {
    const inv = await this.get(id);
    if (!inv.payerEmail) throw new NotFoundException('This invoice has no email on file');
    const { buffer } = await this.pdf(id);
    await this.email.sendTemplate(inv.payerEmail, 'invoice', {
      name: inv.payerName, invoiceNumber: inv.number, description: inv.description, total: money(inv.total),
    }, [{ filename: `${inv.number}.pdf`, content: buffer.toString('base64') }]);
    await this.prisma.invoice.update({ where: { id }, data: { lastSentAt: new Date() } });
    return { ok: true };
  }

  async resendWhatsapp(id: string) {
    const inv = await this.get(id);
    if (!inv.payerPhone) throw new NotFoundException('This invoice has no phone on file');
    // AiSensy's campaign API carries structured template text, not arbitrary
    // media attachments (see WhatsappService) — sends the invoice summary
    // with an amount/number, not the PDF itself; the PDF goes out via the
    // email resend above. Same "don't let a dead WhatsApp integration surface
    // as a raw 500" reasoning as auth.service.ts's OTP send.
    try {
      await this.wa.send(inv.payerPhone, 'invoice_resend', [inv.number, money(inv.total)]);
    } catch {
      throw new BadRequestException('WhatsApp send failed — the invoice PDF still went out by email');
    }
    await this.prisma.invoice.update({ where: { id }, data: { lastSentAt: new Date() } });
    return { ok: true };
  }
}
