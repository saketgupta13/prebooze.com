import type { PrismaService } from '../prisma.service';

/** Extracts every phone-number-shaped chunk out of a Lead.contact string as
 * a last-10-digit key — Lead.contact is free-form (sales staff type it in,
 * not the normalizePhone-enforced format User.phone uses), and can contain
 * more than one number crammed into one field (seen in real data: "+91
 * 93465 85973 , 70328 15973"). Splitting on non-digit runs first, rather
 * than stripping the whole string to digits in one pass, is what keeps two
 * separate numbers from getting concatenated into one wrong blob. Matching
 * on the last 10 digits (not the full string) is what makes "+91 99..." and
 * "099..." and "99..." all resolve to the same key regardless of whichever
 * way a given lead's number happened to get typed in. */
function last10DigitKeys(raw: string): string[] {
  return (raw.match(/\d[\d\s]*\d/g) ?? [])
    .map((chunk) => chunk.replace(/\D/g, ''))
    .filter((digits) => digits.length >= 10)
    .map((digits) => digits.slice(-10));
}

/** Every phone number (as a last-10-digit key) that appears on any Lead —
 * used to exclude lead-tracked people from the Customers list/count, so a
 * prospect being sold to as an organizer/venue/promoter/lineup doesn't also
 * show up as a plain guest. Scoped to Lead specifically, not "any role
 * application" — a real self-serve applicant already gets excluded via
 * roleStatus, this is only for people who haven't (yet, or ever) gone that
 * far but are still being tracked in the sales pipeline. */
export async function leadPhoneKeySet(prisma: PrismaService): Promise<Set<string>> {
  const leads = await prisma.lead.findMany({ where: { contact: { not: null } }, select: { contact: true } });
  const keys = new Set<string>();
  for (const l of leads) {
    if (!l.contact) continue;
    for (const key of last10DigitKeys(l.contact)) keys.add(key);
  }
  return keys;
}

export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}
