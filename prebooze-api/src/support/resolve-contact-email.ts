import { PrismaService } from '../prisma.service';

/** Resolves the real email a ticket ack/reply should go to for a given
 * user+role. Real gap (2026-09-24, organizer feedback): Help Center's
 * "add email" used to always mean the account-level User.email — the
 * right mental model for a guest, but wrong for an elevated role, which
 * thinks of its brand/business contact email (Organizer.contact /
 * Promoter.contact / Venue.contact) as *the* email, not a separate hidden
 * field from their own brand profile. Shared by SupportService.raise() and
 * AdminSupportTicketsService.reply() so both resolve the same way — same
 * "duplication is what let drift happen" lesson as lib/events.ts's
 * isEventOver. Lineup has no contact-email field on its model at all yet,
 * so it falls back to User.email same as guest — a real, currently-
 * accepted gap, not fixed here. */
export async function resolveContactEmail(
  prisma: PrismaService,
  userId: string | null | undefined,
  role: string | null | undefined,
  fallback: string | null | undefined,
): Promise<string | null> {
  if (userId) {
    if (role === 'organizer') {
      const org = await prisma.organizer.findUnique({ where: { userId }, select: { contact: true } });
      if (org?.contact) return org.contact;
    } else if (role === 'promoter') {
      const p = await prisma.promoter.findUnique({ where: { userId }, select: { contact: true } });
      if (p?.contact) return p.contact;
    } else if (role === 'venue') {
      const v = await prisma.venue.findUnique({ where: { userId }, select: { contact: true } });
      if (v?.contact) return v.contact;
    }
  }
  return fallback ?? null;
}
