import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FUNNEL_TYPES } from './track.service';

/** Counts *distinct sessions* that reached each stage, not raw event counts
 * — someone reloading an event page five times should count once, same as
 * a real conversion funnel. Volume here is small enough (an early-stage
 * platform, not millions of rows/day) that deduping in JS over one query is
 * simpler and plenty fast, versus a raw COUNT(DISTINCT ...) query per stage. */
@Injectable()
export class FunnelReportService {
  constructor(private prisma: PrismaService) {}

  async get(from?: string, to?: string, eventId?: string) {
    const rows = await this.prisma.funnelEvent.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      select: { type: true, sessionId: true },
    });

    const stages = FUNNEL_TYPES.map((type) => ({
      type,
      sessions: new Set(rows.filter((r) => r.type === type).map((r) => r.sessionId)).size,
    }));

    return { stages, totalEvents: rows.length };
  }
}
