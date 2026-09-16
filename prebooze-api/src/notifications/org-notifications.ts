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

  async getPrefs(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { notificationsEnabled: true } });
    return { enabled: user?.notificationsEnabled ?? true };
  }

  async setPrefs(userId: string, enabled: boolean) {
    // Explicit `select` — an unscoped update() implicitly returns every
    // column, which breaks on a local dev DB with drift vs the schema (see
    // prebooze_local_prisma_drift memory); scoping to just the one column
    // we changed avoids that regardless of drift.
    await this.prisma.user.update({ where: { id: userId }, data: { notificationsEnabled: enabled }, select: { id: true } });
    return { enabled };
  }

  /** Real entry point for raising an organizer notification — writes the
   * in-app inbox row AND fans out a real push in the same call, so every
   * future trigger point (event approved, booking received, ...) only
   * needs this one method rather than remembering both halves separately.
   * Checks the real per-user mute switch first and skips entirely (no row,
   * no push) when off — someone who turned notifications off shouldn't
   * still get a silent inbox entry piling up. Fire-and-forget either way:
   * never blocks or throws into the caller's own action. */
  async notify(userId: string, icon: string, text: string, to?: string): Promise<void> {
    const { enabled } = await this.getPrefs(userId).catch(() => ({ enabled: true }));
    if (!enabled) return;
    await this.prisma.orgNotification.create({ data: { userId, icon, text, to } }).catch(() => {});
    await this.push.send(userId, `${icon} Prebooze`, text).catch(() => {});
  }
}
