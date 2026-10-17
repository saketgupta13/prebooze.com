import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PushService } from './push';

/** Per-user in-app notification inbox for guests — the guest-app equivalent
 * of OrgNotificationsService (same icon/text/to/read shape), scoped to one
 * userId. The bell icon on the guest app's Home used to only open push
 * preference settings because no feed existed at all; this is the one real
 * entry point every guest-facing push trigger should write through. */
@Injectable()
export class GuestNotificationsService {
  constructor(private prisma: PrismaService, private push: PushService) {}

  async list(userId: string) {
    return this.prisma.guestNotification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async unreadCount(userId: string) {
    return this.prisma.guestNotification.count({ where: { userId, read: false } });
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.guestNotification.findUnique({ where: { id } });
    if (!n || n.userId !== userId) throw new NotFoundException('Notification not found');
    return this.prisma.guestNotification.update({ where: { id }, data: { read: true } });
  }

  async markAllRead(userId: string) {
    await this.prisma.guestNotification.updateMany({ where: { userId, read: false }, data: { read: true } });
    return { ok: true };
  }

  /** Writes the in-app inbox row AND fans out the real push in the same
   * call — same contract as OrgNotificationsService.notify. Checks the
   * guest's own per-user mute switch (User.notificationsEnabled, same
   * field organizers use) and skips entirely when off: no row, no push.
   * `to`, when present, is always a bare event slug today (both current
   * trigger points — new event from a followed profile, a followed person
   * going — are event-shaped) — sent as `eventSlug` in the push payload to
   * match the guest app's existing navigateToNotificationTarget handler,
   * which was already live before this inbox existed. */
  async notify(userId: string, icon: string, text: string, to?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { notificationsEnabled: true } });
    if (user && user.notificationsEnabled === false) return;
    await this.prisma.guestNotification.create({ data: { userId, icon, text, to } }).catch(() => {});
    await this.push.send(userId, 'Prebooze', text, to ? { eventSlug: to } : undefined).catch(() => {});
  }
}
