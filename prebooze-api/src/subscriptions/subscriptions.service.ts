import { BadRequestException, Injectable } from '@nestjs/common';
import type { SubTierRole } from '@prisma/client';
import { PrismaService } from '../prisma.service';

/** Role plan tiers (organizer/promoter/venue/lineup) — real Razorpay
 * Subscriptions recurring billing removed 2026-09-21 (see
 * prebooze_razorpay_complete_removal memory). All historical
 * RoleSubscription/SubscriptionCharge rows and tables were dropped along
 * with the payment history preservation for one-time payments elsewhere —
 * subscriptions had zero active rows at removal time. subscribe()/cancel()
 * now just refuse; tiers() stays real since SubTier itself wasn't dropped
 * (still used to display plan info even with no way to purchase one). Will
 * be rebuilt on PhonePe AutoPay once that's available from PhonePe. */
@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  async tiers(role: SubTierRole) {
    return this.prisma.subTier.findMany({ where: { role }, orderBy: { price: 'asc' } });
  }

  // No RoleSubscription rows exist anymore (table dropped) — every entity
  // reads as having no subscription, same as it would if it simply never
  // subscribed. Callers (lineup/venue/promoter "my subscription" screens,
  // admin billing list) all already handle a null/empty result correctly.
  async current(_role: SubTierRole, _entityId: string) {
    return null;
  }

  async listAll(_role?: SubTierRole) {
    return [];
  }

  async subscribe(_role: SubTierRole, _entityId: string, _tierId: string) {
    throw new BadRequestException('Subscriptions are currently unavailable. Use one-time payments instead.');
  }

  async cancel(_role: SubTierRole, _entityId: string) {
    throw new BadRequestException('Subscriptions are currently unavailable.');
  }
}
