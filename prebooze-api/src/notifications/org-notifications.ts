import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PushService } from './push';

// `icon` on OrgNotification stores one of these short kind slugs, not a raw
// emoji/glyph — the RN app maps each to a real lucide-react-native icon +
// color in its panel (a text emoji looked out of place next to the rest of
// the app's vector iconography). This map supplies just the emoji used in
// the *push notification title* (the OS tray itself is a fine place for a
// decorative glyph — Android renders it natively either way).
const KIND_EMOJI: Record<string, string> = {
  approved: '✅', rejected: '❌', booking: '🎟️', payout: '💸', review: '⭐', team: '🛡️',
};

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
   * `kind` is a short slug (see KIND_EMOJI above / the RN panel's own icon
   * map) — not a raw emoji — so the in-app panel can render a real vector
   * icon instead of a text glyph; the push title still gets a decorative
   * emoji prefix via KIND_EMOJI, since that's normal for an OS tray entry.
   * Checks the real per-user mute switch first and skips entirely (no row,
   * no push) when off — someone who turned notifications off shouldn't
   * still get a silent inbox entry piling up. Fire-and-forget either way:
   * never blocks or throws into the caller's own action. */
  async notify(userId: string, kind: string, text: string, to?: string): Promise<void> {
    const { enabled } = await this.getPrefs(userId).catch(() => ({ enabled: true }));
    if (!enabled) return;
    await this.prisma.orgNotification.create({ data: { userId, icon: kind, text, to } }).catch(() => {});
    const emoji = KIND_EMOJI[kind] ?? '🔔';
    await this.push.send(userId, `${emoji} Prebooze`, text).catch(() => {});
  }

  /** TEMPORARY, self-serve only — drops one realistic example row per
   * notification "kind" this app will eventually raise into the CALLING
   * user's own inbox, via the same real notify() path (so a real push
   * fires too — this is meant to be checked against both the in-app panel
   * AND the Android system tray). Wipes this user's ENTIRE inbox first (not
   * just text-matched rows — simpler and means a second press always shows
   * a clean, predictable set instead of accumulating stale copies with
   * outdated sample text from an earlier version of this method), so
   * pressing the trigger more than once — including a genuine double-fire
   * from a fast double-tap — replaces rather than duplicates. Remove this
   * method + its controller route once the organizer has looked — it's not
   * a real feature, just a one-time way to preview the UI without a raw DB
   * write. */
  async seedDemo(userId: string): Promise<{ seeded: number }> {
    const samples: { kind: string; text: string; to?: string; minutesAgo: number; read: boolean }[] = [
      { kind: 'approved', text: '"Rooftop Sundown Sessions" was approved — it\'s live now', to: '/events', minutesAgo: 5, read: false },
      { kind: 'rejected', text: '"Warehouse Techno Night" was rejected — poster resolution too low, please re-upload', to: '/events', minutesAgo: 240, read: false },
      { kind: 'booking', text: 'Priya Sharma bought 2x General Entry for "Rooftop Sundown Sessions" — ₹1,800', to: '/bookings', minutesAgo: 30, read: false },
      { kind: 'payout', text: 'Payout of ₹12,045 was marked paid to your bank account', to: '/payouts', minutesAgo: 1440, read: true },
      { kind: 'review', text: 'New 5-star review on "Acoustic Sundowner"', to: '/reviews', minutesAgo: 2880, read: true },
      { kind: 'team', text: 'Manager accepted your team invite and can now manage the door', to: '/team-roles', minutesAgo: 4320, read: true },
    ];
    await this.prisma.orgNotification.deleteMany({ where: { userId } });
    for (const s of samples) {
      await this.prisma.orgNotification.create({
        data: { userId, icon: s.kind, text: s.text, to: s.to, read: s.read, createdAt: new Date(Date.now() - s.minutesAgo * 60_000) },
      });
      // Real push per sample (not the batched notify() call) so each one
      // arrives as its own Android system-tray entry, same as it would from
      // a genuine trigger — the whole point of this preview.
      const emoji = KIND_EMOJI[s.kind] ?? '🔔';
      await this.push.send(userId, `${emoji} Prebooze`, s.text).catch(() => {});
    }
    return { seeded: samples.length };
  }
}
