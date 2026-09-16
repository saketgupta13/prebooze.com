import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/** Sends real push notifications via Expo's push service — no vendor API key
 * needed (unlike WhatsappService/EmailService), Expo's own infra relays to
 * APNs/FCM using the project id embedded in the token itself. One user can
 * have more than one registered device (a PushToken row per device, see
 * schema.prisma) — send() fans out to all of them in a single batched Expo
 * request (Expo accepts up to 100 messages per call; this app has nowhere
 * near that many devices per user, so no chunking is needed yet). */
@Injectable()
export class PushService {
  private readonly log = new Logger('Push');

  constructor(private prisma: PrismaService) {}

  async register(userId: string, token: string, platform: string): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform },
      create: { userId, token, platform },
    });
  }

  /** Called on logout so a signed-out device stops receiving another
   * account's pushes if a different person logs into the same phone next. */
  async unregister(token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { token } });
  }

  async send(userId: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return;

    const messages = tokens.map((t) => ({ to: t.token, title, body, data, sound: 'default' }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      this.log.error(`Expo push send failed ${res.status}: ${await res.text()}`);
      return;
    }

    // Expo returns one ticket per message, same order as the request — a
    // DeviceNotRegistered error means the app was uninstalled/token expired;
    // forget it so future sends don't keep wasting a call on a dead device.
    const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    const dead = (json.data ?? [])
      .map((ticket, i) => (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? tokens[i].token : null))
      .filter((t): t is string => t !== null);
    if (dead.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
  }
}
