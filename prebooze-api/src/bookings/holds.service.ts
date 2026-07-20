import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type Redis from 'ioredis';
import { REDIS } from '../redis.provider';
import { PrismaService } from '../prisma.service';

const HOLD_TTL_S = 8 * 60; // 8 minutes, matches prebooze-web's CART_HOLD_MINUTES

export interface HoldData {
  eventId: string;
  qty: Record<string, number>; // tierId -> quantity
  userId: string;
}

/** Cart holds live in Redis only (TTL 8 min) — they're a soft, UX-facing
 * reservation (shows the countdown, blocks a stale checkout from resuming).
 * The hard inventory guarantee against overselling comes from the atomic
 * tier.sold guard in BookingsService.create, not from the hold itself. */
@Injectable()
export class HoldsService {
  constructor(
    @Inject(REDIS) private redis: Redis,
    private prisma: PrismaService,
  ) {}

  async create(userId: string, eventId: string, qty: Record<string, number>) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: { tiers: true } });
    if (!event || event.status !== 'approved') throw new NotFoundException('Event not found');

    for (const [tierId, n] of Object.entries(qty)) {
      if (n <= 0) continue;
      const tier = event.tiers.find((t) => t.id === tierId);
      if (!tier) throw new BadRequestException(`Unknown ticket tier ${tierId}`);
      if (tier.sold + n > tier.quantity) throw new BadRequestException(`Not enough "${tier.name}" tickets left`);
    }

    const holdId = randomBytes(16).toString('hex');
    const data: HoldData = { eventId, qty, userId };
    await this.redis.set(`hold:${holdId}`, JSON.stringify(data), 'EX', HOLD_TTL_S);
    return { holdId, expiresAt: new Date(Date.now() + HOLD_TTL_S * 1000).toISOString() };
  }

  async get(holdId: string): Promise<HoldData> {
    const raw = await this.redis.get(`hold:${holdId}`);
    if (!raw) throw new BadRequestException('This cart hold has expired — please select tickets again');
    return JSON.parse(raw);
  }

  async release(holdId: string) {
    await this.redis.del(`hold:${holdId}`);
  }
}
