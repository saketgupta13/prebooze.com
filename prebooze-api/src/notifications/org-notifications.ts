import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PushService } from './push';

/** Per-user in-app notification inbox for organizers — same shape as the
 * admin side's shared NotificationsService (icon/text/to/read), except
 * scoped to one userId instead of one shared panel everyone sees. */
@Injectable()
export class OrgNotificationsService {
  constructor(private prisma: PrismaService, private push: PushService) {}

  async list(userId: string) {
    return this.prisma.orgNotification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async unreadCount(userId: string) {
    return this.prisma.orgNotification.count({ where: { userId, read: false } });
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.orgNotification.findUnique({ where: { id } });
    if (!n || n.userId !== userId) throw new NotFoundException('Notification not found');
    return this.prisma.orgNotification.update({ where: { id }, data: { read: true } });
  }

  async markAllRead(userId: string) {
    await this.prisma.orgNotification.updateMany({ where: { userId, read: false }, data: { read: true } });
    return { ok: true };
  }

  /** Real entry point for raising an organizer notification — writes the
   * in-app inbox row AND fans out a real push in the same call, so every
   * future trigger point (event approved, booking received, ...) only
   * needs this one method rather than remembering both halves separately.
   * Fire-and-forget: never blocks or throws into the caller's own action. */
  async notify(userId: string, icon: string, text: string, to?: string): Promise<void> {
    await this.prisma.orgNotification.create({ data: { userId, icon, text, to } }).catch(() => {});
    await this.push.send(userId, `${icon} Prebooze`, text).catch(() => {});
  }
}
