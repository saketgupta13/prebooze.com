import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GuestNotificationsService } from '../notifications/guest-notifications';

/** Admin-sent promotional/offer pushes to the guest app — reuses
 * GuestNotificationsService.notify() for each recipient, the exact same
 * real pipeline (in-app inbox row + app-scoped Expo push, respecting the
 * guest's own notificationsEnabled mute switch) every other guest-facing
 * trigger in this app already goes through. Audience is "every guest who
 * actually has the guest app installed" (a real PushToken row tagged
 * app:'guest'), not every registered account — a guest who's never
 * installed the app, or an organizer-only account, has nothing to send
 * this to. Optional city filter narrows to guests whose own account city
 * matches (best-effort targeting; a guest's stored city is self-reported,
 * same caveat CityContext's own fallback-to-Nagpur comment already notes). */
@Injectable()
export class BroadcastService {
  private readonly log = new Logger('Broadcast');

  constructor(
    private prisma: PrismaService,
    private guestNotifications: GuestNotificationsService,
  ) {}

  async audienceCount(city?: string): Promise<number> {
    const userIds = await this.targetUserIds(city);
    return userIds.length;
  }

  async send(title: string, message: string, city?: string, eventSlug?: string): Promise<{ sent: number }> {
    if (!title?.trim()) throw new BadRequestException('Title is required');
    if (!message?.trim()) throw new BadRequestException('Message is required');
    const userIds = await this.targetUserIds(city);
    let sent = 0;
    for (const userId of userIds) {
      await this.guestNotifications.notify(userId, 'promo', message.trim(), eventSlug || undefined).catch((err) =>
        this.log.warn(`Broadcast to ${userId} failed: ${(err as Error).message}`),
      );
      sent += 1;
    }
    this.log.log(`Broadcast "${title}" sent to ${sent} guest(s)${city ? ` in ${city}` : ''}`);
    return { sent };
  }

  private async targetUserIds(city?: string): Promise<string[]> {
    const tokens = await this.prisma.pushToken.findMany({ where: { app: 'guest' }, select: { userId: true }, distinct: ['userId'] });
    if (!city) return tokens.map((t) => t.userId);
    const ids = tokens.map((t) => t.userId);
    if (!ids.length) return [];
    const matching = await this.prisma.user.findMany({ where: { id: { in: ids }, city }, select: { id: true } });
    return matching.map((u) => u.id);
  }
}
