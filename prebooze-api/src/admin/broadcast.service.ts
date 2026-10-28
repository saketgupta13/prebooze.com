import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GuestNotificationsService } from '../notifications/guest-notifications';

export type BroadcastAudience = { audienceType: 'city' | 'event' | 'follow'; city?: string; eventSlug?: string; followeeKey?: string };

@Injectable()
export class BroadcastService {
  private readonly log = new Logger('Broadcast');

  constructor(
    private prisma: PrismaService,
    private guestNotifications: GuestNotificationsService,
  ) {}

  async audienceCount(a: BroadcastAudience): Promise<number> {
    const ids = await this.targetUserIds(a);
    return ids.length;
  }

  /** Immediate or scheduled — a `scheduledFor` in the future just logs a
   * row with status 'scheduled' and returns without sending; CronService's
   * broadcastTick (every 5 min, same cadence as the abandoned-cart tick)
   * picks it up and calls sendNow once it's actually due. */
  async send(title: string, message: string, a: BroadcastAudience, scheduledFor?: string): Promise<{ sent: number; scheduled: boolean }> {
    if (!title?.trim()) throw new BadRequestException('Title is required');
    if (!message?.trim()) throw new BadRequestException('Message is required');
    const when = scheduledFor ? new Date(scheduledFor) : null;
    if (when && when.getTime() > Date.now()) {
      const audienceCount = await this.audienceCount(a);
      await this.prisma.broadcastLog.create({
        data: { title: title.trim(), message: message.trim(), ...this.audienceFields(a), audienceCount, status: 'scheduled', scheduledFor: when },
      });
      return { sent: 0, scheduled: true };
    }
    const sent = await this.sendNow(title.trim(), message.trim(), a);
    return { sent, scheduled: false };
  }

  /** Called directly for an immediate send, and by CronService.broadcastTick
   * for a due scheduled one — always writes the BroadcastLog row itself so
   * there's one real history regardless of which path triggered it. */
  async sendNow(title: string, message: string, a: BroadcastAudience, logId?: string): Promise<number> {
    const userIds = await this.targetUserIds(a);
    let sent = 0;
    for (const userId of userIds) {
      await this.guestNotifications.notify(userId, 'promo', message, a.eventSlug || undefined).catch((err) =>
        this.log.warn(`Broadcast to ${userId} failed: ${(err as Error).message}`),
      );
      sent += 1;
    }
    if (logId) {
      await this.prisma.broadcastLog.update({ where: { id: logId }, data: { sentCount: sent, status: 'sent', sentAt: new Date() } });
    } else {
      await this.prisma.broadcastLog.create({
        data: { title, message, ...this.audienceFields(a), audienceCount: userIds.length, sentCount: sent, status: 'sent', sentAt: new Date() },
      });
    }
    this.log.log(`Broadcast "${title}" sent to ${sent} guest(s)`);
    return sent;
  }

  async dueScheduled() {
    return this.prisma.broadcastLog.findMany({ where: { status: 'scheduled', scheduledFor: { lte: new Date() } } });
  }

  async history(limit = 50) {
    return this.prisma.broadcastLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }

  private audienceFields(a: BroadcastAudience) {
    return { audienceType: a.audienceType, city: a.city || null, eventSlug: a.eventSlug || null, followeeKey: a.followeeKey || null };
  }

  /** Every audience type starts from guests who actually have the app
   * installed (a real `app:'guest'` PushToken row) — sending to an account
   * that never registered a device would just be a wasted write. */
  private async targetUserIds(a: BroadcastAudience): Promise<string[]> {
    const tokens = await this.prisma.pushToken.findMany({ where: { app: 'guest' }, select: { userId: true }, distinct: ['userId'] });
    const installed = new Set(tokens.map((t) => t.userId));
    if (installed.size === 0) return [];

    if (a.audienceType === 'event') {
      if (!a.eventSlug) return [];
      const event = await this.prisma.event.findUnique({ where: { slug: a.eventSlug }, select: { id: true } });
      if (!event) return [];
      const [interests, wishlists] = await Promise.all([
        this.prisma.eventInterest.findMany({ where: { eventId: event.id }, select: { userId: true } }),
        this.prisma.eventWishlist.findMany({ where: { eventId: event.id }, select: { userId: true } }),
      ]);
      const ids = new Set([...interests.map((r) => r.userId), ...wishlists.map((r) => r.userId)]);
      return [...ids].filter((id) => installed.has(id));
    }

    if (a.audienceType === 'follow') {
      if (!a.followeeKey) return [];
      const follows = await this.prisma.follow.findMany({ where: { followeeKey: a.followeeKey }, select: { followerId: true } });
      return follows.map((f) => f.followerId).filter((id) => installed.has(id));
    }

    // 'city' (default) — blank city reaches every installed guest
    if (!a.city) return [...installed];
    const matching = await this.prisma.user.findMany({ where: { id: { in: [...installed] }, city: a.city }, select: { id: true } });
    return matching.map((u) => u.id);
  }
}
