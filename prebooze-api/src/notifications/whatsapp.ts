import { Injectable, Logger } from '@nestjs/common';

/** WhatsApp sender — provider-agnostic. With no AISENSY_API_KEY configured we
 * run the dev provider (logs the OTP); AiSensy (a Meta BSP) handles the
 * business/template approval and forwards to the Meta Cloud API for us. */
@Injectable()
export class WhatsappService {
  private readonly log = new Logger('WhatsApp');

  get live(): boolean {
    return Boolean(process.env.AISENSY_API_KEY);
  }

  /** Send an approved AiSensy campaign/template to one recipient.
   * `params` fill the template's numbered variables in order, e.g. {{1}}. */
  async send(phone: string, campaignName: string, params: string[]): Promise<void> {
    const destination = phone.replace(/[^\d]/g, '');
    if (!this.live) {
      this.log.log(`[dev] ${campaignName} -> ${phone}: ${params.join(' | ')}`);
      return;
    }
    const res = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: process.env.AISENSY_API_KEY,
        campaignName,
        destination,
        userName: 'Prebooze',
        templateParams: params,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.log.error(`AiSensy send failed ${res.status}: ${body}`);
      throw new Error('WhatsApp send failed');
    }
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    return this.send(phone, 'otp', [code]);
  }
}
