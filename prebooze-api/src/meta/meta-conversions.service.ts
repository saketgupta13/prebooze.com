import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

export interface MetaUserData {
  phone?: string | null;
  email?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null; // _fbp cookie, if the client sent it along
  fbc?: string | null; // _fbc cookie/click-id, if the client sent it along
}

const sha256 = (raw: string) => createHash('sha256').update(raw.trim().toLowerCase()).digest('hex');

/** Server-side mirror of the browser Meta Pixel (see prebooze-web's
 * src/lib/meta.ts) — same event, same `eventId`, sent a second way. Meta
 * dedupes on (pixel, event_name, event_id), so a browser event blocked by
 * an ad blocker or lost to iOS tracking limits still lands via this path,
 * without double-counting when both arrive. Not a Stape/third-party
 * gateway — posts straight to Meta's own Graph API with the System User
 * token (prebooze_meta_pixel_setup memory has the credential's location),
 * so there's no recurring third-party subscription for what Meta itself
 * already offers for free. */
@Injectable()
export class MetaConversionsService {
  private readonly log = new Logger('MetaConversions');

  get live(): boolean {
    return Boolean(process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN);
  }

  async sendEvent(
    eventName: string,
    eventId: string,
    eventSourceUrl: string,
    userData: MetaUserData,
    customData?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.live) return;
    const pixelId = process.env.META_PIXEL_ID;
    const token = process.env.META_ACCESS_TOKEN;

    const ud: Record<string, unknown> = {};
    if (userData.phone) ud.ph = [sha256(userData.phone.replace(/[^\d]/g, ''))];
    if (userData.email) ud.em = [sha256(userData.email)];
    if (userData.clientIp) ud.client_ip_address = userData.clientIp;
    if (userData.userAgent) ud.client_user_agent = userData.userAgent;
    if (userData.fbp) ud.fbp = userData.fbp;
    if (userData.fbc) ud.fbc = userData.fbc;

    const body = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: 'website',
          event_source_url: eventSourceUrl,
          user_data: ud,
          custom_data: customData,
        },
      ],
    };

    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) this.log.warn(`Meta CAPI ${eventName} failed: ${res.status} ${await res.text()}`);
    } catch (e) {
      this.log.warn(`Meta CAPI ${eventName} error: ${(e as Error).message}`);
    }
  }
}
