import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { renderTemplate } from './email-templates';

export interface EmailAttachment {
  filename: string;
  content: string; // base64
}

/** Email sender — provider-agnostic, same shape as WhatsappService right next
 * to it. With no RESEND_API_KEY configured we run the dev provider (logs the
 * subject + recipient); once a key is set this posts straight to Resend's
 * HTTP API — no SDK dependency, matching the rest of this notifications
 * module. */
@Injectable()
export class EmailService {
  private readonly log = new Logger('Email');

  constructor(private prisma: PrismaService) {}

  get live(): boolean {
    return Boolean(process.env.RESEND_API_KEY);
  }

  /** `to` is often empty — guest signup in this app is phone/OTP-first (see
   * WhatsappService), so a user may have no email on file at all. Silently
   * no-op rather than throwing: a missing email is a normal, expected state
   * here, not an error condition worth failing the caller's real action over. */
  async send(to: string | null | undefined, subject: string, html: string, attachments?: EmailAttachment[]): Promise<void> {
    if (!to?.trim()) return;
    if (!this.live) {
      this.log.log(`[dev] "${subject}" -> ${to}${attachments?.length ? ` (+${attachments.length} attachment(s))` : ''}`);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Prebooze <noreply@prebooze.com>',
        // Sends go out as a clean, unmonitored noreply@ identity (guests
        // shouldn't expect a reply from an automated confirmation), but a
        // real reply still needs somewhere to land — routes it to a real
        // monitored inbox instead of bouncing or vanishing into noreply@.
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
        to,
        subject,
        html,
        ...(attachments?.length ? { attachments } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.log.error(`Resend send failed ${res.status}: ${body}`);
      throw new Error('Email send failed');
    }
  }

  /** Looks up an admin-customized subject/body for `templateId` (see the
   * EmailTemplate table / admin's Email templates page) and falls back to
   * the hardcoded default in email-templates.ts when nothing's been
   * customized — this is the one place that decides "default vs override,"
   * so every call site just says which template + what data, never how it's
   * rendered. */
  async sendTemplate(to: string | null | undefined, templateId: string, data: Record<string, string>, attachments?: EmailAttachment[]): Promise<void> {
    if (!to?.trim()) return;
    const override = await this.prisma.emailTemplate.findUnique({ where: { id: templateId } });
    const { subject, html } = renderTemplate(templateId, data, override);
    await this.send(to, subject, html, attachments);
  }
}
