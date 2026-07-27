import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { PaymentsService } from './payments.service';
import { EmailService } from '../notifications/email';
import { money } from '../notifications/email-templates';
import { StaffAlertsService } from '../notifications/staff-alerts';
import { FeaturedService } from '../featured/featured.service';
import { BookingsService } from '../bookings/bookings.service';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Settings > Payouts > "Payout day" + "Auto payout" and Settings > Notifications
 * > "Weekly summary email" were previously stored/displayed only — nothing ever
 * read them. This is the scheduler that makes them real. Both run daily at
 * 08:00 server time and no-op unless their setting is actually on. */
@Injectable()
export class CronService {
  private readonly log = new Logger('Cron');

  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
    private email: EmailService,
    private staffAlerts: StaffAlertsService,
    private featured: FeaturedService,
    private bookings: BookingsService,
  ) {}

  /** Runs the same batch-payout logic as the manual "Run batch" button in
   * /admin/payments, but only when today matches the configured payout day
   * and autoPayout is switched on. */
  @Cron('0 8 * * *')
  async autoPayoutTick() {
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
    if (!settings?.autoPayout) return;
    if (WEEKDAY_NAMES[new Date().getDay()] !== settings.payoutDay) return;

    try {
      const due = await this.payments.payoutsDue();
      const ids = due.rows.filter((r) => !r.paidOut).map((r) => r.id);
      if (!ids.length) return;
      await this.payments.runBatch(ids);
      this.log.log(`Auto payout: processed ${ids.length} event(s)`);
    } catch (err) {
      this.log.error(`Auto payout run failed: ${(err as Error).message}`);
      await this.staffAlerts.alert(`⚠️ Automatic payout run failed: ${(err as Error).message}`).catch(() => {});
    }
  }

  /** Every Monday — the setting itself has no day picker, so Monday is a
   * fixed choice (start-of-week summary), unlike the payout day above. */
  @Cron('0 8 * * 1')
  async weeklySummaryTick() {
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
    if (!settings?.weeklyEmail) return;

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [revenueAgg, bookingsCount, due, owners] = await Promise.all([
      this.prisma.booking.aggregate({
        where: { createdAt: { gte: since }, status: { in: ['confirmed', 'refund_requested', 'refunded'] } },
        _sum: { total: true },
      }),
      this.prisma.booking.count({ where: { createdAt: { gte: since } } }),
      this.payments.payoutsDue(),
      this.prisma.staff.findMany({ where: { roleName: 'Owner' } }),
    ]);

    const periodLabel = `${since.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    for (const owner of owners) {
      await this.email
        .sendTemplate(owner.email, 'weekly_summary', {
          ownerName: owner.name,
          revenue: money(revenueAgg._sum.total ?? 0),
          bookings: String(bookingsCount),
          payoutsDue: money(due.dueTotal),
          periodLabel,
        })
        .catch(() => {});
    }
    this.log.log(`Weekly summary sent to ${owners.length} owner(s)`);
  }

  /** `Featured.status` never transitioned to 'expired' on its own — the
   * public catalog already hides an expired placement via a live
   * `expiresAt: { gt: new Date() }` filter regardless of `status`, but
   * admin's own Featured list reads `status` directly, so a lapsed
   * placement sat there reading "active" forever. Runs hourly since
   * `expiresAt` can fall at any time of day (event start times, not just
   * midnight), unlike the once-daily payout/summary jobs above. */
  @Cron('0 * * * *')
  async featuredExpiryTick() {
    const res = await this.prisma.featured.updateMany({
      where: { status: 'active', expiresAt: { lte: new Date() } },
      data: { status: 'expired' },
    });
    if (res.count) this.log.log(`Featured expiry: marked ${res.count} placement(s) expired`);
  }

  /** Proactive — the manual "Send renewal reminder" button (Expired tab)
   * only ever reaches placements that have *already* lapsed. This runs
   * daily and emails the owner while there's still time to renew, once per
   * placement (FeaturedService.remindExpiringSoon gates re-sends via
   * `expiryReminderSentAt`). */
  @Cron('0 9 * * *')
  async featuredExpiringSoonTick() {
    const { remindedCount } = await this.featured.remindExpiringSoon();
    if (remindedCount) this.log.log(`Featured expiring-soon: reminded ${remindedCount} owner(s)`);
  }

  /** Daily — prompts guests with a real confirmed booking to review the
   * organizer once the event has actually finished (see
   * BookingsService.remindForReview for the exact 24-72h-after-end window
   * and the reviewReminderSentAt gate). */
  @Cron('0 11 * * *')
  async reviewRequestTick() {
    const { remindedCount } = await this.bookings.remindForReview();
    if (remindedCount) this.log.log(`Review request: reminded ${remindedCount} guest(s)`);
  }
}
