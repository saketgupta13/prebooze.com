import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { PaymentsService } from './payments.service';
import { EmailService } from '../notifications/email';
import { money } from '../notifications/email-templates';
import { StaffAlertsService } from '../notifications/staff-alerts';
import { FeaturedService } from '../featured/featured.service';
import { BookingsService } from '../bookings/bookings.service';
import { LeadsService } from './leads.service';
import { NotificationsService } from './notifications.service';
import { CartsService } from './carts.service';
import { SettlementsService } from './settlements.service';

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
    private leads: LeadsService,
    private notifications: NotificationsService,
    private carts: CartsService,
    private settlements: SettlementsService,
  ) {}

  /** Payouts are never marked paid automatically — there's no real bank
   * integration behind PaymentsService.markPaid, so auto-processing used to
   * mean flipping paidOut and fabricating a UTR on a schedule, including for
   * events that hadn't happened yet. On the configured payout day this now
   * only pings staff with what's actually due (post-completion, per
   * PaymentsService.payoutsDue's own date gate) so a human pays it for real
   * and records the real UTR themselves via the admin panel. */
  @Cron('0 8 * * *')
  async autoPayoutTick() {
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
    if (!settings?.autoPayout) return;
    if (WEEKDAY_NAMES[new Date().getDay()] !== settings.payoutDay) return;

    try {
      const due = await this.payments.payoutsDue();
      const outstanding = due.rows.filter((r) => !r.paidOut);
      if (!outstanding.length) return;
      await this.staffAlerts.alert(
        `💸 ${outstanding.length} payout${outstanding.length === 1 ? '' : 's'} due today — ₹${Math.round(due.dueTotal).toLocaleString('en-IN')} total. Review and pay in /admin/payments.`,
      ).catch(() => {});
    } catch (err) {
      this.log.error(`Payout reminder failed: ${(err as Error).message}`);
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

  /** Daily nudge for organizer leads (see Lead/LeadActivity) whose follow-up
   * date has arrived and haven't moved to a terminal stage — one bell
   * notification per lead, then `followUpDone` so it doesn't repeat every
   * day until the date is changed or the stage moves on. */
  @Cron('0 9 * * *')
  async leadFollowUpTick() {
    const due = await this.leads.dueFollowUps();
    for (const lead of due) {
      await this.notifications.notify('📇', `Follow up with lead "${lead.name}" (${lead.source})`, '/admin/leads').catch(() => {});
      await this.prisma.lead.update({ where: { id: lead.id }, data: { followUpDone: true } }).catch(() => {});
    }
    if (due.length) this.log.log(`Lead follow-ups: notified for ${due.length} lead(s)`);
  }

  /** Every 5 minutes — frequent, unlike the once-daily ticks above, since
   * this is chasing a 30-minute-since-last-activity window (see
   * LeadsService.sendAutoNudges) rather than a fixed time of day; a lead
   * that goes quiet at any hour should get its nudge within a few minutes
   * of crossing that threshold, not wait for the next morning. */
  @Cron('*/5 * * * *')
  async leadAutoNudgeTick() {
    const { sent } = await this.leads.sendAutoNudges();
    if (sent) this.log.log(`Lead auto-nudge: WhatsApp reminder sent to ${sent} draft lead(s)`);
  }

  /** Every 5 minutes, same cadence as the lead nudge above and for the same
   * reason — chasing an 8-minute hold expiry (CartsService.sendAutoNudges),
   * not a fixed time of day. This is the single highest-leverage recovery
   * point in the booking funnel: a guest who verified OTP and held a
   * ticket but never paid is the closest thing to a sure conversion if
   * reminded quickly, versus every earlier funnel stage. */
  @Cron('*/5 * * * *')
  async cartAutoNudgeTick() {
    const { sent } = await this.carts.sendAutoNudges();
    if (sent) this.log.log(`Cart auto-nudge: WhatsApp+email reminder sent to ${sent} abandoned cart(s)`);
  }

  /** Daily — real 2026-08-28 finding: booking #TKT-99421's real Razorpay
   * refund failed on 2026-08-14, staffAlerts.alert() fired exactly once at
   * that moment, and it sat completely unresolved for two weeks — the
   * guest was never actually paid back, and nobody noticed because a
   * single WhatsApp ping is trivial to miss and nothing ever reminded
   * anyone again. This re-surfaces every booking whose refundFailedAt is
   * still set, every day, with a day-count that makes it harder to ignore
   * the longer it sits — both a persistent admin bell notification per
   * booking and a daily WhatsApp nag, until BookingsService.retryRefund
   * actually clears it. */
  @Cron('0 9 * * *')
  async stuckRefundTick() {
    const stuck = await this.prisma.booking.findMany({ where: { refundFailedAt: { not: null } } });
    for (const b of stuck) {
      const days = Math.floor((Date.now() - b.refundFailedAt!.getTime()) / (24 * 60 * 60 * 1000));
      await this.notifications
        .notify('⚠', `Refund still stuck for ${days} day${days === 1 ? '' : 's'} — booking ${b.id} (₹${b.total}) — retry in Booking detail`, `/admin/bookings/${encodeURIComponent(b.id)}`)
        .catch(() => {});
    }
    if (stuck.length) {
      await this.staffAlerts
        .alert(`⚠ ${stuck.length} refund${stuck.length === 1 ? '' : 's'} still stuck and unresolved (real money not yet back with the guest) — check the admin bell for which ones.`)
        .catch(() => {});
      this.log.warn(`Stuck refund tick: ${stuck.length} still unresolved`);
    }
  }

  /** Daily — settlements only ever get added, never edited, and the account
   * settles every few days to a week+ (not a fixed schedule), so daily is
   * plenty frequent without hammering Razorpay's API for no reason. */
  @Cron('0 10 * * *')
  async settlementSyncTick() {
    const { synced } = await this.settlements.sync();
    if (synced) this.log.log(`Settlement sync: ${synced} record(s)`);
  }

  /** Daily — corrects the "Razorpay commission" ledger estimate to the real
   * per-payment fee once Razorpay's finalized it (see BookingsService.
   * reconcileRazorpayFees's own doc comment for why this can't just happen
   * at sale time). */
  @Cron('0 10 * * *')
  async razorpayFeeReconcileTick() {
    const { reconciled } = await this.bookings.reconcileRazorpayFees();
    if (reconciled) this.log.log(`Razorpay fee reconcile: ${reconciled} booking(s)`);
  }
}
