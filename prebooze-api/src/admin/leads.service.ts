import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../notifications/email';
import { WhatsappService } from '../notifications/whatsapp';

export const LEAD_SOURCES = ['Instagram', 'WhatsApp', 'Phone call', 'Referral / walk-in', 'Website inquiry', 'Facebook/Instagram Ads', 'Other social', 'Other'] as const;
// Auto-captured (see captureDraft/resolveDraft below), never staff-picked —
// the only two sources a draft lead can carry, so resolveDraft's "find an
// existing untouched draft for this person" lookup can filter on this list
// without also matching a real sales-entered lead that happens to share the
// same phone/role.
const DRAFT_SOURCES = ['Website inquiry', 'Facebook/Instagram Ads'] as const;
export const LEAD_STAGES = ['New', 'Contacted', 'Interested', 'Negotiating', 'Signed up', 'Declined'] as const;
export const LEAD_ROLES = ['organizer', 'venue', 'promoter', 'lineup'] as const;
export type LeadRole = (typeof LEAD_ROLES)[number];

// Real Meta campaigns tag utm_source as "meta", "fb", or "ig" — "facebook"
// (the only value earlier code checked for) barely ever shows up in actual
// traffic. Matched case-insensitively so a campaign builder capitalizing it
// differently doesn't silently fall through to "Website inquiry" again.
const META_AD_SOURCES = ['meta', 'facebook', 'fb', 'instagram', 'ig'];
function isMetaAdSource(utmSource?: string): boolean {
  return !!utmSource && META_AD_SOURCES.includes(utmSource.toLowerCase());
}

// utm_medium values every currently-running paid campaign uses to sell
// tickets to guests — see the exclusion in captureDraft below.
const SALES_AD_MEDIUMS = ['paid_social', 'paid', 'cpc', 'ppc'];

const ONBOARDING_PATH: Record<LeadRole, string> = {
  organizer: '/organizer/onboarding',
  venue: '/venue/onboarding',
  promoter: '/promoter/onboarding',
  lineup: '/lineup/onboarding',
};

// Best-effort formatting for the free-form contact/alternateContact fields
// below — always strips invisible Unicode direction marks (a real thing
// copy-pasting a number off Instagram/WhatsApp leaves behind, breaks
// click-to-call and confuses the last-10-digits match in
// lead-phone-match.util.ts) and collapses whitespace. Only reformats to
// "+91 XXXXXXXXXX" when the value is *purely* phone-shaped (10-15 digits,
// optional leading +) — unlike auth.service.ts's normalizePhone, this never
// throws, since a sales-typed contact can legitimately be a handle, a name,
// or several numbers in one field (lead-phone-match.util.ts already handles
// that case), not just a single clean phone number.
function cleanContact(raw: string): string {
  const stripped = raw.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim().replace(/\s+/g, ' ');
  const digitsOnly = stripped.replace(/[^\d+]/g, '');
  if (/^\+?\d{10,15}$/.test(digitsOnly)) {
    const withCc = digitsOnly.startsWith('+') ? digitsOnly : `+91${digitsOnly.slice(-10)}`;
    return `${withCc.slice(0, withCc.length - 10)} ${withCc.slice(-10)}`;
  }
  return stripped;
}

const LEAD_INCLUDE = {
  assignedTo: { select: { id: true, name: true } },
  organizer: { select: { id: true, brandName: true, username: true } },
  venue: { select: { id: true, name: true } },
  promoter: { select: { id: true, slug: true, name: true } },
  lineup: { select: { id: true, slug: true, name: true } },
} as const;

interface CreateLeadBody {
  name: string;
  role?: string;
  source: string;
  contact?: string;
  alternateContact?: string;
  email?: string;
  contactPerson?: string;
  country?: string;
  state?: string;
  city?: string;
  eventType?: string;
  assignedToId?: string;
  followUpAt?: string;
}

interface UpdateLeadBody {
  name?: string;
  source?: string;
  contact?: string;
  alternateContact?: string;
  email?: string;
  contactPerson?: string;
  country?: string;
  state?: string;
  city?: string;
  eventType?: string;
  stage?: string;
  assignedToId?: string | null;
  followUpAt?: string | null;
}

@Injectable()
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private wa: WhatsappService,
  ) {}

  /** Empty = unrestricted (every existing staff row, and Owner always).
   * A non-empty scope is what makes a salesperson only see/work one or more
   * specific lead pipelines — enforced here, not just hidden in the UI, same
   * "re-fetch fresh from DB, don't trust a possibly-stale JWT claim"
   * discipline as PermissionGuard. */
  private async scopeFor(staffId?: string): Promise<string[]> {
    if (!staffId) return [];
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId }, select: { leadRoleScope: true, roleName: true } });
    if (!staff || staff.roleName === 'Owner') return [];
    return staff.leadRoleScope;
  }

  private assertInScope(scope: string[], role: string) {
    if (scope.length && !scope.includes(role)) {
      throw new ForbiddenException(`Your sales access doesn't cover "${role}" leads`);
    }
  }

  async list(staffId?: string) {
    const scope = await this.scopeFor(staffId);
    return this.prisma.lead.findMany({
      where: scope.length ? { role: { in: scope } } : undefined,
      include: { ...LEAD_INCLUDE, activities: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(id: string, staffId?: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: { ...LEAD_INCLUDE, activities: { orderBy: { createdAt: 'desc' } } },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    this.assertInScope(await this.scopeFor(staffId), lead.role);
    return lead;
  }

  async create(body: CreateLeadBody, staffId?: string) {
    if (!body.name?.trim()) throw new BadRequestException('Name is required');
    if (!LEAD_SOURCES.includes(body.source as (typeof LEAD_SOURCES)[number])) throw new BadRequestException('Invalid source');
    const role = body.role ?? 'organizer';
    if (!LEAD_ROLES.includes(role as LeadRole)) throw new BadRequestException('Invalid role');
    this.assertInScope(await this.scopeFor(staffId), role);
    return this.prisma.lead.create({
      data: {
        name: body.name.trim(),
        role,
        source: body.source,
        contact: body.contact?.trim() ? cleanContact(body.contact) : null,
        alternateContact: body.alternateContact?.trim() ? cleanContact(body.alternateContact) : null,
        email: body.email?.trim() || null,
        contactPerson: body.contactPerson?.trim() || null,
        country: body.country?.trim() || null,
        state: body.state?.trim() || null,
        city: body.city?.trim() || null,
        eventType: body.eventType?.trim() || null,
        assignedToId: body.assignedToId || null,
        followUpAt: body.followUpAt ? new Date(body.followUpAt) : null,
      },
    });
  }

  private async requireInScope(id: string, staffId?: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    this.assertInScope(await this.scopeFor(staffId), lead.role);
    return lead;
  }

  async update(id: string, body: UpdateLeadBody, staffId?: string) {
    await this.requireInScope(id, staffId);
    if (body.stage && !LEAD_STAGES.includes(body.stage as (typeof LEAD_STAGES)[number])) throw new BadRequestException('Invalid stage');
    if (body.source && !LEAD_SOURCES.includes(body.source as (typeof LEAD_SOURCES)[number])) throw new BadRequestException('Invalid source');
    return this.prisma.lead.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.source !== undefined ? { source: body.source } : {}),
        ...(body.contact !== undefined ? { contact: body.contact?.trim() ? cleanContact(body.contact) : null } : {}),
        ...(body.alternateContact !== undefined ? { alternateContact: body.alternateContact?.trim() ? cleanContact(body.alternateContact) : null } : {}),
        ...(body.email !== undefined ? { email: body.email?.trim() || null } : {}),
        ...(body.contactPerson !== undefined ? { contactPerson: body.contactPerson?.trim() || null } : {}),
        ...(body.country !== undefined ? { country: body.country?.trim() || null } : {}),
        ...(body.state !== undefined ? { state: body.state?.trim() || null } : {}),
        ...(body.city !== undefined ? { city: body.city?.trim() || null } : {}),
        ...(body.eventType !== undefined ? { eventType: body.eventType?.trim() || null } : {}),
        ...(body.stage !== undefined ? { stage: body.stage } : {}),
        ...(body.assignedToId !== undefined ? { assignedToId: body.assignedToId || null } : {}),
        ...(body.followUpAt !== undefined ? { followUpAt: body.followUpAt ? new Date(body.followUpAt) : null, followUpDone: false } : {}),
      },
      include: LEAD_INCLUDE,
    });
  }

  // ---------- guest-facing: incomplete onboarding capture ----------
  // Two call sites feed this (see LeadsController below): the moment a
  // logged-in visitor lands on a role's onboarding page (bare phone number,
  // nothing else yet), and again, debounced, once they've typed something
  // into the form's first field before leaving without submitting. Both
  // upsert the same row — one evolving draft per (phone, role), not two.
  async captureDraft(userId: string, role: string, partial: { name?: string; city?: string; eventType?: string; utmSource?: string; utmMedium?: string }) {
    if (!LEAD_ROLES.includes(role as LeadRole)) throw new BadRequestException('Invalid role');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    // Already holds a role, or already has a real application in flight
    // (for this role or another — KycService.submitRole enforces the same
    // "one number, one role" rule) — a shadow draft lead would be noise
    // once a real application already exists.
    if (user.role || user.roleStatus === 'pending') return null;
    // Every paid campaign actually running right now is a guest ticket-sales
    // campaign (utm_medium=paid_social, e.g. "hyd-flash-aug15") — anyone it
    // sends here is a ticket buyer by construction, not a venue/organizer
    // prospect, even if they wander onto an onboarding page and type a name
    // before leaving to just book instead. A future real lead-generation
    // campaign (recruiting venues/organizers/promoters) should tag itself
    // with a utm_medium NOT in this list so it isn't excluded here. Organic/
    // direct/referral visitors (no medium, or a non-ad medium) are unaffected
    // — someone who found the onboarding page themselves is a real inquiry
    // regardless of ad spend.
    if (partial.utmMedium && SALES_AD_MEDIUMS.includes(partial.utmMedium.toLowerCase())) return null;

    const source = isMetaAdSource(partial.utmSource) ? 'Facebook/Instagram Ads' : 'Website inquiry';
    const existing = await this.prisma.lead.findFirst({
      where: { contact: user.phone, role, stage: 'New', source: { in: [...DRAFT_SOURCES] } },
      orderBy: { updatedAt: 'desc' },
    });

    const name = partial.name?.trim() || existing?.name || user.name || user.phone;
    if (existing) {
      return this.prisma.lead.update({
        where: { id: existing.id },
        data: {
          name,
          source,
          city: partial.city?.trim() || existing.city,
          eventType: partial.eventType?.trim() || existing.eventType,
          email: user.email || existing.email,
        },
      });
    }
    return this.prisma.lead.create({
      data: {
        name,
        role,
        source,
        contact: user.phone,
        email: user.email || null,
        city: partial.city?.trim() || null,
        eventType: partial.eventType?.trim() || null,
        stage: 'New',
      },
    });
  }

  /** Called from KycService.submitRole / VenueService.onboard once a real
   * application actually lands — an untouched draft lead (still `stage:
   * 'New'`, nobody on staff has engaged with it) for this same person+role
   * is marked converted rather than deleted, so it becomes a real record of
   * "this lead worked" instead of just vanishing. A draft staff has already
   * started working (moved off 'New') is left alone — a human's mid-contact
   * with it, an automatic stage flip out from under them would be
   * confusing; they'll see the real application land on its own. */
  async resolveDraft(phone: string, role: string) {
    const existing = await this.prisma.lead.findFirst({
      where: { contact: phone, role, stage: 'New', source: { in: [...DRAFT_SOURCES] } },
    });
    if (!existing) return;
    await this.prisma.lead.update({ where: { id: existing.id }, data: { stage: 'Signed up' } });
  }

  /** Called from BookingsService once a real guest booking is paid for —
   * covers the other half of the gap resolveDraft leaves: someone who
   * merely visited/half-filled a role's onboarding page (see captureDraft
   * above) and then converted as an ordinary paying guest instead of ever
   * submitting that application. Deletes rather than stage-flips, unlike
   * resolveDraft — "Signed up" would misreport them as having joined that
   * role, when what actually happened is they were never a real lead for
   * it. Any role, since a guest conversion invalidates a stale draft
   * regardless of which onboarding page it came from. Only ever touches
   * untouched (`stage: 'New'`) drafts — one staff has already started
   * working is left alone, same reasoning as resolveDraft. */
  async clearDraftsForGuestConversion(phone: string) {
    await this.prisma.lead.deleteMany({
      where: { contact: phone, stage: 'New', source: { in: [...DRAFT_SOURCES] } },
    });
  }

  async remove(id: string, staffId?: string) {
    await this.requireInScope(id, staffId);
    await this.prisma.lead.delete({ where: { id } });
    return { ok: true };
  }

  async addActivity(id: string, text: string, staffId?: string) {
    if (!text?.trim()) throw new BadRequestException('Activity text is required');
    await this.requireInScope(id, staffId);
    await this.prisma.lead.update({ where: { id }, data: { updatedAt: new Date() } });
    return this.prisma.leadActivity.create({ data: { leadId: id, text: text.trim() } });
  }

  async searchOrganizers(q: string) {
    if (!q?.trim()) return [];
    return this.prisma.organizer.findMany({
      where: { OR: [{ brandName: { contains: q, mode: 'insensitive' } }, { username: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, brandName: true, username: true, city: true },
      take: 10,
    });
  }

  async searchVenues(q: string) {
    if (!q?.trim()) return [];
    return this.prisma.venue.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true, city: true },
      take: 10,
    });
  }

  async searchPromoters(q: string) {
    if (!q?.trim()) return [];
    return this.prisma.promoter.findMany({
      where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, slug: true, name: true, city: true },
      take: 10,
    });
  }

  async searchLineups(q: string) {
    if (!q?.trim()) return [];
    return this.prisma.lineup.findMany({
      where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, slug: true, name: true, city: true },
      take: 10,
    });
  }

  async linkOrganizer(id: string, organizerId: string, staffId?: string) {
    const lead = await this.requireInScope(id, staffId);
    if (lead.role !== 'organizer') throw new BadRequestException(`This is a "${lead.role}" lead — can't link an organizer to it`);
    const organizer = await this.prisma.organizer.findUnique({ where: { id: organizerId } });
    if (!organizer) throw new NotFoundException('Organizer not found');
    const already = await this.prisma.lead.findUnique({ where: { organizerId } });
    if (already && already.id !== id) throw new BadRequestException('That organizer is already linked to another lead');
    return this.prisma.lead.update({ where: { id }, data: { organizerId, stage: 'Signed up' }, include: LEAD_INCLUDE });
  }

  async linkVenue(id: string, venueId: string, staffId?: string) {
    const lead = await this.requireInScope(id, staffId);
    if (lead.role !== 'venue') throw new BadRequestException(`This is a "${lead.role}" lead — can't link a venue to it`);
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Venue not found');
    const already = await this.prisma.lead.findUnique({ where: { venueId } });
    if (already && already.id !== id) throw new BadRequestException('That venue is already linked to another lead');
    return this.prisma.lead.update({ where: { id }, data: { venueId, stage: 'Signed up' }, include: LEAD_INCLUDE });
  }

  async linkPromoter(id: string, promoterId: string, staffId?: string) {
    const lead = await this.requireInScope(id, staffId);
    if (lead.role !== 'promoter') throw new BadRequestException(`This is a "${lead.role}" lead — can't link a promoter to it`);
    const promoter = await this.prisma.promoter.findUnique({ where: { id: promoterId } });
    if (!promoter) throw new NotFoundException('Promoter not found');
    const already = await this.prisma.lead.findUnique({ where: { promoterId } });
    if (already && already.id !== id) throw new BadRequestException('That promoter is already linked to another lead');
    return this.prisma.lead.update({ where: { id }, data: { promoterId, stage: 'Signed up' }, include: LEAD_INCLUDE });
  }

  async linkLineup(id: string, lineupId: string, staffId?: string) {
    const lead = await this.requireInScope(id, staffId);
    if (lead.role !== 'lineup') throw new BadRequestException(`This is a "${lead.role}" lead — can't link a line-up to it`);
    const lineup = await this.prisma.lineup.findUnique({ where: { id: lineupId } });
    if (!lineup) throw new NotFoundException('Line-up not found');
    const already = await this.prisma.lead.findUnique({ where: { lineupId } });
    if (already && already.id !== id) throw new BadRequestException('That line-up is already linked to another lead');
    return this.prisma.lead.update({ where: { id }, data: { lineupId, stage: 'Signed up' }, include: LEAD_INCLUDE });
  }

  /** Sends the real role-appropriate onboarding link — the send itself is
   * the primary action here (not a side effect tacked onto something else),
   * so unlike most other notification call sites in this codebase, an email
   * failure is NOT silently caught: Resend is the guaranteed-delivered
   * channel, so a real failure (bad address, etc.) should surface to staff.
   * WhatsApp stays best-effort (`.catch(() => {})`) — same pre-approved,
   * role-neutral 'lead_onboarding_invite' campaign for every role, only the
   * email CTA link and copy vary by role via the `onboardingPath` token. */
  async sendOnboardingLink(id: string, channels: { email?: boolean; whatsapp?: boolean }, staffId?: string) {
    const lead = await this.requireInScope(id, staffId);
    if (!channels.email && !channels.whatsapp) throw new BadRequestException('Pick at least one channel');

    const name = lead.contactPerson?.trim() || lead.name;
    const sent: string[] = [];

    if (channels.email) {
      if (!lead.email?.trim()) throw new BadRequestException('This lead has no email on file');
      await this.email.sendTemplate(lead.email, 'lead_onboarding_invite', {
        name, brand: lead.name, onboardingPath: ONBOARDING_PATH[lead.role as LeadRole] ?? ONBOARDING_PATH.organizer,
      });
      sent.push('Email');
    }
    if (channels.whatsapp) {
      if (!lead.contact?.trim()) throw new BadRequestException('This lead has no phone/contact on file');
      await this.wa.sendLeadOnboardingInvite(lead.contact, name, lead.name).catch(() => {});
      sent.push('WhatsApp');
    }

    await this.prisma.leadActivity.create({ data: { leadId: id, text: `Onboarding link sent via ${sent.join(' and ')}` } });
    return { ok: true, sent };
  }

  /** Auto-captured draft leads (see captureDraft) gone quiet for 30+ minutes
   * with no real application ever landing — e.g. someone verified OTP to
   * start an organizer application and never touched the form, or filled
   * part of it and left. Reuses the same 'lead_onboarding_invite' WhatsApp
   * template the manual "Send onboarding link" admin action already sends
   * (LeadsService.sendOnboardingLink) — same already-approved AiSensy
   * campaign, no new template needed. Only ever fires once per lead
   * (autoNudgeSentAt gate) and only for still-untouched drafts (`stage:
   * 'New'`) — a lead staff has already started working is left alone.
   *
   * Scoped to organizer only — the approved WhatsApp template's copy is
   * organizer-specific text (no per-role text/link the way the email
   * version has via onboardingPath). Venue was considered too (venues can
   * self-host/collaborate on events, so they're organizer-adjacent) but
   * the actual template wording says something specific to becoming an
   * organizer, which would be factually wrong to send someone who applied
   * to list their venue, not to run events — so venue stays out too.
   * Promoter/venue/lineup drafts still land in the Kanban for staff to
   * work manually — just no automated WhatsApp until a role-correct
   * template exists for them, which also isn't needed yet since ad spend
   * is organizer-only right now. */
  async dueAutoNudges() {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    return this.prisma.lead.findMany({
      where: {
        role: 'organizer',
        source: { in: [...DRAFT_SOURCES] },
        stage: 'New',
        autoNudgeSentAt: null,
        updatedAt: { lte: cutoff },
        contact: { not: null },
      },
    });
  }

  async sendAutoNudges() {
    const due = await this.dueAutoNudges();
    let sent = 0;
    for (const lead of due) {
      try {
        await this.wa.sendLeadOnboardingInvite(lead.contact!, lead.contactPerson?.trim() || lead.name, lead.name);
        await this.prisma.lead.update({ where: { id: lead.id }, data: { autoNudgeSentAt: new Date() } });
        await this.prisma.leadActivity.create({ data: { leadId: lead.id, text: 'Automated onboarding reminder sent via WhatsApp' } });
        sent++;
      } catch {
        // leave autoNudgeSentAt unset — picked up again on the next tick
        // rather than silently lost for a transient send failure.
      }
    }
    return { sent };
  }

  /** Follow-ups due today or overdue, still in an active (non-terminal) stage. */
  async dueFollowUps() {
    return this.prisma.lead.findMany({
      where: {
        followUpAt: { lte: new Date() },
        followUpDone: false,
        stage: { notIn: ['Signed up', 'Declined'] },
      },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
  }
}
