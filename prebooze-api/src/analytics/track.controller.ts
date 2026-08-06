import { Body, Controller, Post, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TrackService } from './track.service';

/** Public, no-auth — a logged-out visitor browsing before they've ever
 * signed in is exactly the drop-off this exists to see, so this can never
 * require a session. Decoded manually the same way CatalogController's
 * person() route does, so a logged-in visitor's events still get a real
 * userId attached when a valid token happens to be present. */
@Controller('track')
export class TrackController {
  constructor(
    private track: TrackService,
    private jwt: JwtService,
  ) {}

  @Post()
  async record(
    @Body()
    body: {
      sessionId?: string;
      type?: string;
      eventId?: string;
      meta?: Record<string, unknown>;
      referrerHost?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      landingPath?: string;
    },
    @Req()
    req: {
      headers: { authorization?: string; 'user-agent'?: string; 'x-forwarded-for'?: string };
      socket?: { remoteAddress?: string };
    },
  ) {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    let userId: string | undefined;
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync(token);
        if (payload.sub && payload.phone) userId = payload.sub;
      } catch {
        // not logged in / expired — fine, still record the event anonymously
      }
    }
    // nginx sets X-Forwarded-For to the real visitor IP (see deploy config)
    // — falls back to the socket's own address only for local/direct dev.
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;
    return this.track.record(body, userId, req.headers['user-agent'], ip);
  }
}
