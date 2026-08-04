import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export const FUNNEL_TYPES = [
  'event_viewed',
  'book_clicked',
  'otp_requested',
  'otp_verified',
  'checkout_viewed',
  'payment_widget_opened',
  'payment_submitted',
  'booking_completed',
] as const;

interface TrackInput {
  sessionId?: string;
  type?: string;
  eventId?: string;
  meta?: Record<string, unknown>;
}

/** Booking-funnel visibility — see FunnelEvent in schema.prisma for why this
 * exists. Deliberately never throws back to the caller: a tracking write is
 * never allowed to surface as a user-visible error or block the real action
 * it's observing, so every failure is logged and swallowed here rather than
 * left to each call site's own .catch(() => {}). */
@Injectable()
export class TrackService {
  private readonly log = new Logger('Track');

  constructor(private prisma: PrismaService) {}

  async record(input: TrackInput, userId?: string) {
    if (!input.sessionId?.trim() || !input.type || !(FUNNEL_TYPES as readonly string[]).includes(input.type)) {
      return { ok: false };
    }
    await this.prisma.funnelEvent
      .create({
        data: {
          sessionId: input.sessionId.trim().slice(0, 100),
          userId,
          type: input.type,
          eventId: input.eventId,
          meta: input.meta as Prisma.InputJsonValue | undefined,
        },
      })
      .catch((err) => this.log.warn(`Failed to record ${input.type}: ${(err as Error).message}`));
    return { ok: true };
  }
}
