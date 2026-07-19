import { Injectable, Logger } from '@nestjs/common';

/** WhatsApp sender — provider-agnostic. With no WA_ACCESS_TOKEN configured we
 * run the dev provider (logs the message); the Meta Cloud API implementation
 * slots in once the business number + templates are approved. */
@Injectable()
export class WhatsappService {
  private readonly log = new Logger('WhatsApp');

  get live(): boolean {
    return Boolean(process.env.WA_ACCESS_TOKEN && process.env.WA_PHONE_NUMBER_ID);
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    if (!this.live) {
      this.log.log(`[dev] OTP for ${phone}: ${code}`);
      return;
    }
    const to = phone.replace(/[^\d]/g, '');
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: 'otp', // pre-approved HSM template
            language: { code: 'en' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }],
          },
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      this.log.error(`WA send failed ${res.status}: ${body}`);
      throw new Error('WhatsApp send failed');
    }
  }
}
