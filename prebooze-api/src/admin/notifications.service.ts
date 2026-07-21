import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/** A shared inbox, not per-staff read receipts — matches the mock's
 * NotificationsPanel exactly (one `read` boolean per notification, visible
 * to every staff member regardless of role). Depends only on PrismaService
 * so it can be declared as a provider in any module that needs to raise a
 * notification (Organizer/Bookings/Kyc), without importing AdminModule
 * wholesale — same pattern as StaffAuthGuard/PermissionGuard elsewhere. */
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.adminNotification.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async markRead(id: string) {
    const n = await this.prisma.adminNotification.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Notification not found');
    return this.prisma.adminNotification.update({ where: { id }, data: { read: true } });
  }

  async markAllRead() {
    await this.prisma.adminNotification.updateMany({ where: { read: false }, data: { read: true } });
    return { ok: true };
  }

  /** Fire-and-forget — never blocks the real action it's attached to. */
  async notify(icon: string, text: string, to?: string) {
    await this.prisma.adminNotification.create({ data: { icon, text, to } }).catch(() => {});
  }
}
