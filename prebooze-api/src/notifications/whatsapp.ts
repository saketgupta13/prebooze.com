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
   * `params` fill the template's numbered variables in order, e.g. {{1}}.
   * `buttons` is only needed for templates with a button component — an
   * Authentication template's "Copy Code" button is represented at the API
   * level as a `url`-type button (a Meta/WhatsApp quirk) that needs the
   * same code passed again as a button parameter, separately from the body
   * `templateParams` — omit it entirely for plain-text templates. */
  async send(phone: string, campaignName: string, params: string[], buttons?: unknown[]): Promise<void> {
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
        ...(buttons ? { buttons } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.log.error(`AiSensy send failed ${res.status}: ${body}`);
      throw new Error('WhatsApp send failed');
    }
  }

  /** Campaign is 'otp_login' — confirmed working via a real AiSensy test
   * send. The earlier "Button at index 0 of type Url requires a parameter"
   * failure wasn't actually about the template's button type (Copy Code
   * vs. One-Tap Autofill, which was the first hypothesis) — it was that
   * our own request never included the `buttons` array Meta's Copy Code
   * button requires, with the OTP code passed again as a button parameter
   * on top of the body's templateParams. */
  async sendOtp(phone: string, code: string): Promise<void> {
    return this.send(phone, 'otp_login', [code], [
      { type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: code }] },
    ]);
  }

  /** Campaign 'otp_phone_change' — same Authentication-template shape as
   * otp_login (Copy Code button, code passed both in the body param and the
   * button param), kept as its own campaign so the message text can say
   * "verify your new number" instead of "log in". Needs its own AiSensy/Meta
   * template approval before this actually delivers in production, same as
   * any other new campaign name added to this file. */
  async sendPhoneChangeOtp(phone: string, code: string): Promise<void> {
    return this.send(phone, 'otp_phone_change', [code], [
      { type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: code }] },
    ]);
  }
}
