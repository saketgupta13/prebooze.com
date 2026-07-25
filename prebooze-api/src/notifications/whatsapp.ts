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

  /** Campaign name is 'otp_verify' — third name for this one template.
   * 'otp' burned through two failed submissions (Authentication-denied
   * pre-verification, then Utility-paused for policy violation) before
   * being deleted; Meta enforces a 30-day lockout on reusing a deleted
   * template's name regardless of prior approval status, so 'otp_login'
   * was used instead. 'otp_login' got APPROVED but with a "One-Tap
   * Autofill" button (a URL-type button meant for native Android apps to
   * auto-read the code) instead of the plain "Copy Code" button — Meta
   * doesn't allow editing a template's component structure post-creation,
   * only delete-and-recreate, and deleting would re-trigger the same
   * 30-day lock. Rather than burn another name to that lock, this is a
   * fresh one built with the correct Copy Code button. */
  async sendOtp(phone: string, code: string): Promise<void> {
    return this.send(phone, 'otp_verify', [code]);
  }
}
