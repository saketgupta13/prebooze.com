import { PrismaService } from '../prisma.service';

/** Resolves who should be notified about something happening on an event —
 * the owning organizer, or (for a venue-hosted event with no organizer) the
 * venue itself. Extracted from OrganizerService's own private version so
 * BookingsService/the abandoned-cart cron/refund flow can reuse the exact
 * same resolution instead of each re-deriving it slightly differently —
 * same "duplication is what let drift happen" lesson as lib/events.ts's
 * isEventOver. */
export async function notifyEventOwner(
  prisma: PrismaService,
  event: { organizerId: string | null; hostedByVenue: boolean; venueId: string | null },
): Promise<{ userId: string; email: string; name: string } | null> {
  if (!event.organizerId) {
    if (!event.hostedByVenue || !event.venueId) return null;
    const venue = await prisma.venue.findUnique({ where: { id: event.venueId } });
    if (!venue?.userId) return null;
    const user = await prisma.user.findUnique({ where: { id: venue.userId } });
    return user ? { userId: user.id, email: user.email, name: user.name } : null;
  }
  const org = await prisma.organizer.findUnique({ where: { id: event.organizerId } });
  if (!org?.userId) return null;
  const user = await prisma.user.findUnique({ where: { id: org.userId } });
  return user ? { userId: user.id, email: user.email, name: user.name } : null;
}
