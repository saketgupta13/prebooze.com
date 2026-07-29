import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { SubTierRole, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { RazorpayService } from '../payments/razorpay.service';
import { EmailService } from '../notifications/email';
import { StaffAlertsService } from '../notifications/staff-alerts';
import { money } from '../notifications/email-templates';
import { WalletService } from '../wallet/wallet.service';

/** Real Razorpay Subscriptions billing for organizer/promoter/venue/lineup
 * plans (guest wallet top-ups are a separate, deliberately-not-this thing —
 * guests use wallet credit, not recurring billing). Role-agnostic: callers
 * always pass an already-resolved entity id (Organizer.id / Promoter.id /
 * Venue.id / Lineup.id), resolved by each role's own service the same way it
 * already resolves "my organizer/promoter/venue/line-up" for every other
 * endpoint — this service never looks up a User itself except to find an
 * email to notify.
 *
 * Lineup previously had no self-serve console/module at all (KYC-only
 * directory entry — see DirectoryService); a minimal one (`src/lineup/`) now
 * exists specifically to carry its subscription routes. */
@Injectable()
export class SubscriptionsService {
  private readonly log = new Logger('Subscriptions');

  constructor(
    private prisma: PrismaService,
    private razorpay: RazorpayService,
    private email: EmailService,
    private staffAlerts: StaffAlertsService,
    private wallet: WalletService,
  ) {}

  async tiers(role: SubTierRole) {
    return this.prisma.subTier.findMany({ where: { role }, orderBy: { price: 'asc' } });
  }

  /** Admin billing visibility — every entity's subscription across every
   * role, or filtered to one role. Entity display names are resolved
   * separately per role since RoleSubscription only stores a raw entityId
   * (no polymorphic FK across three different tables). */
  async listAll(role?: SubTierRole) {
    const subs = await this.prisma.roleSubscription.findMany({
      where: role ? { role } : undefined,
      include: { tier: true },
      orderBy: { updatedAt: 'desc' },
    });
    const [organizers, promoters, venues, lineups] = await Promise.all([
      this.prisma.organizer.findMany({ select: { id: true, brandName: true } }),
      this.prisma.promoter.findMany({ select: { id: true, name: true } }),
      this.prisma.venue.findMany({ select: { id: true, name: true } }),
      this.prisma.lineup.findMany({ select: { id: true, name: true } }),
    ]);
    const nameFor = (r: SubTierRole, id: string) =>
      (r === 'organizer' ? organizers.find((o) => o.id === id)?.brandName
        : r === 'promoter' ? promoters.find((p) => p.id === id)?.name
        : r === 'lineup' ? lineups.find((l) => l.id === id)?.name
        : venues.find((v) => v.id === id)?.name) ?? id;
    return subs.map((s) => ({ ...s, entityName: nameFor(s.role, s.entityId) }));
  }

  async current(role: SubTierRole, entityId: string) {
    return this.prisma.roleSubscription.findUnique({
      where: { role_entityId: { role, entityId } },
      include: { tier: true, charges: { orderBy: { occurredAt: 'desc' }, take: 12 } },
    });
  }

  /** Free tiers (price 0) activate instantly, no Razorpay involved — same
   * as the old behaviour. Paid tiers create (or reuse) a Razorpay Plan, then
   * a fresh Subscription in `created` status; the caller must redirect the
   * owner to `shortUrl` to actually authorize it — nothing here grants the
   * tier until the `subscription.activated` webhook confirms it. */
  async subscribe(role: SubTierRole, entityId: string, tierId: string) {
    const tier = await this.prisma.subTier.findUnique({ where: { id: tierId } });
    if (!tier || tier.role !== role) throw new BadRequestException('Unknown plan for this role');

    if (tier.price === 0) {
      await this.applyTier(role, entityId, tier.id);
      await this.prisma.roleSubscription.upsert({
        where: { role_entityId: { role, entityId } },
        create: { role, entityId, tierId: tier.id, status: 'active', currentStart: new Date() },
        update: { tierId: tier.id, status: 'active', razorpaySubId: null, shortUrl: null, currentStart: new Date(), currentEnd: null, paidCount: 0 },
      });
      return { ok: true, requiresAuthorization: false };
    }

    let planId = tier.razorpayPlanId;
    if (!planId) {
      const created = await this.razorpay.createPlan(`${role[0].toUpperCase()}${role.slice(1)} — ${tier.name}`, tier.price * 100, `Prebooze ${role} ${tier.name} plan`);
      planId = created.planId;
      await this.prisma.subTier.update({ where: { id: tier.id }, data: { razorpayPlanId: planId } });
    }

    const sub = await this.razorpay.createSubscription(planId, { role, entityId, tierId: tier.id });
    await this.prisma.roleSubscription.upsert({
      where: { role_entityId: { role, entityId } },
      create: { role, entityId, tierId: tier.id, razorpaySubId: sub.subscriptionId, status: 'created', shortUrl: sub.shortUrl },
      update: { tierId: tier.id, razorpaySubId: sub.subscriptionId, status: 'created', shortUrl: sub.shortUrl, currentStart: null, currentEnd: null, paidCount: 0 },
    });
    return {
      ok: true,
      requiresAuthorization: true,
      subscriptionId: sub.subscriptionId,
      shortUrl: sub.shortUrl,
      keyId: process.env.RAZORPAY_KEY_ID || undefined,
    };
  }

  /** Cancels at the end of the current billing cycle — the owner keeps
   * access through what they already paid for, matching how a real SaaS
   * cancellation (and Razorpay's own `cancel_at_cycle_end`) normally works. */
  async cancel(role: SubTierRole, entityId: string) {
    const sub = await this.prisma.roleSubscription.findUnique({ where: { role_entityId: { role, entityId } } });
    if (!sub || sub.status === 'cancelled') throw new BadRequestException('No active subscription to cancel');
    if (sub.razorpaySubId) await this.razorpay.cancelSubscription(sub.razorpaySubId, true);
    await this.prisma.roleSubscription.update({ where: { id: sub.id }, data: { status: 'cancelled' } });
    return { ok: true };
  }

  // ---------- webhook ----------

  /** Dispatches a verified Razorpay webhook event. Identifies the record by
   * OUR stored `razorpaySubId`, never by trusting `notes` in the payload —
   * the payload is signature-verified so notes could be trusted too, but
   * looking it up by id is the more standard, tamper-proof pattern. */
  async handleWebhookEvent(event: string, payload: unknown) {
    const subEntity = (payload as { subscription?: { entity?: RazorpaySubEntity } })?.subscription?.entity;
    if (!subEntity?.id) return;

    const record = await this.prisma.roleSubscription.findUnique({ where: { razorpaySubId: subEntity.id } });
    if (!record) {
      this.log.warn(`Webhook ${event} for unknown subscription ${subEntity.id}`);
      return;
    }

    const currentStart = subEntity.current_start ? new Date(subEntity.current_start * 1000) : undefined;
    const currentEnd = subEntity.current_end ? new Date(subEntity.current_end * 1000) : undefined;

    switch (event) {
      case 'subscription.authenticated':
        await this.prisma.roleSubscription.update({ where: { id: record.id }, data: { status: 'authenticated' } });
        break;

      case 'subscription.activated':
        await this.prisma.roleSubscription.update({
          where: { id: record.id },
          data: { status: 'active', currentStart: currentStart ?? new Date(), currentEnd, shortUrl: null },
        });
        await this.applyTier(record.role, record.entityId, record.tierId);
        await this.notifyOwner(record.role, record.entityId, 'subscription_activated');
        break;

      case 'subscription.charged': {
        const payment = (payload as { payment?: { entity?: { id?: string; amount?: number; status?: string } } })?.payment?.entity;
        await this.prisma.$transaction([
          this.prisma.roleSubscription.update({
            where: { id: record.id },
            data: { status: 'active', paidCount: { increment: 1 }, currentStart, currentEnd },
          }),
          this.prisma.subscriptionCharge.create({
            data: {
              subscriptionId: record.id,
              razorpayPaymentId: payment?.id,
              amount: payment?.amount ? Math.round(payment.amount / 100) : 0,
              status: payment?.status === 'captured' ? 'captured' : 'failed',
            },
          }),
        ]);
        await this.applyTier(record.role, record.entityId, record.tierId);
        // Auto-save the method this real charge actually used — same
        // WalletService.saveUsedMethod dedup-by-matchKey path a guest
        // checkout uses, just resolved through the entity's owning User
        // instead of a userId the caller already has (see ownerEmail).
        if (payment?.id && payment.status === 'captured') {
          const owner = await this.ownerEmail(record.role, record.entityId);
          if (owner) {
            await this.razorpay.getPayment(payment.id).then((p) => this.wallet.saveUsedMethod(owner.userId, p)).catch(() => {});
          }
        }
        break;
      }

      case 'subscription.pending':
        await this.prisma.roleSubscription.update({ where: { id: record.id }, data: { status: 'pending' } });
        break;

      case 'subscription.halted':
        await this.prisma.roleSubscription.update({ where: { id: record.id }, data: { status: 'halted' } });
        await this.demoteToFree(record.role, record.entityId);
        await this.notifyOwner(record.role, record.entityId, 'subscription_payment_failed');
        await this.staffAlerts.alert(`⚠️ Subscription payment halted — ${record.role} ${record.entityId}`).catch(() => {});
        break;

      case 'subscription.cancelled':
      case 'subscription.completed':
      case 'subscription.expired':
        await this.prisma.roleSubscription.update({
          where: { id: record.id },
          data: { status: event.split('.')[1] as SubscriptionStatus },
        });
        await this.demoteToFree(record.role, record.entityId);
        break;

      default:
        this.log.log(`Ignoring unhandled webhook event: ${event}`);
    }
  }

  // ---------- internals ----------

  /** Only Promoter has a hot-path field (`planId`, read directly by the
   * guest-list monthly-quota check in PromoterService) that needs to mirror
   * the authoritative RoleSubscription. Organizer/venue/lineup have no such
   * consumer yet — nothing to write there until one exists. */
  private async applyTier(role: SubTierRole, entityId: string, tierId: string) {
    if (role === 'promoter') await this.prisma.promoter.update({ where: { id: entityId }, data: { planId: tierId } });
  }

  private async demoteToFree(role: SubTierRole, entityId: string) {
    const free = await this.prisma.subTier.findFirst({ where: { role, price: 0 } });
    if (free) await this.applyTier(role, entityId, free.id);
  }

  private async ownerEmail(role: SubTierRole, entityId: string): Promise<{ email: string; name: string; userId: string } | null> {
    if (role === 'organizer') {
      const o = await this.prisma.organizer.findUnique({ where: { id: entityId }, select: { userId: true, brandName: true } });
      if (!o?.userId) return null;
      const u = await this.prisma.user.findUnique({ where: { id: o.userId } });
      return u?.email ? { email: u.email, name: o.brandName, userId: u.id } : null;
    }
    if (role === 'promoter') {
      const p = await this.prisma.promoter.findUnique({ where: { id: entityId }, select: { userId: true, name: true } });
      if (!p?.userId) return null;
      const u = await this.prisma.user.findUnique({ where: { id: p.userId } });
      return u?.email ? { email: u.email, name: p.name, userId: u.id } : null;
    }
    if (role === 'lineup') {
      const l = await this.prisma.lineup.findUnique({ where: { id: entityId }, select: { userId: true, name: true } });
      if (!l?.userId) return null;
      const u = await this.prisma.user.findUnique({ where: { id: l.userId } });
      return u?.email ? { email: u.email, name: l.name, userId: u.id } : null;
    }
    // venue: Venue.userId is only populated for venues onboarded after that
    // field was added — fall back to the reverse User.venueId scalar
    // (a findFirst, not findUnique — the pre-existing workaround) for any
    // venue onboarded before then.
    const v = await this.prisma.venue.findUnique({ where: { id: entityId }, select: { userId: true, name: true } });
    const u = v?.userId
      ? await this.prisma.user.findUnique({ where: { id: v.userId } })
      : await this.prisma.user.findFirst({ where: { venueId: entityId } });
    if (!u?.email) return null;
    return { email: u.email, name: v?.name ?? u.name, userId: u.id };
  }

  private async notifyOwner(role: SubTierRole, entityId: string, templateId: 'subscription_activated' | 'subscription_payment_failed') {
    const owner = await this.ownerEmail(role, entityId);
    if (!owner) return;
    const sub = await this.prisma.roleSubscription.findUnique({ where: { role_entityId: { role, entityId } }, include: { tier: true } });
    if (!sub) return;
    await this.email
      .sendTemplate(owner.email, templateId, { name: owner.name, planName: sub.tier.name, amount: money(sub.tier.price) })
      .catch(() => {});
  }
}

interface RazorpaySubEntity {
  id: string;
  current_start?: number | null;
  current_end?: number | null;
}
