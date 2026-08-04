import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../notifications/email';
import { WhatsappService } from '../notifications/whatsapp';

export const LEAD_SOURCES = ['Instagram', 'WhatsApp', 'Phone call', 'Referral / walk-in', 'Website inquiry', 'Other social', 'Other'] as const;
export const LEAD_STAGES = ['New', 'Contacted', 'Interested', 'Negotiating', 'Signed up', 'Declined'] as const;

interface CreateLeadBody {
  name: string;
  source: string;
  contact?: string;
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

  list() {
    return this.prisma.lead.findMany({
      include: { assignedTo: { select: { id: true, name: true } }, organizer: { select: { id: true, brandName: true, username: true } }, activities: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: { assignedTo: { select: { id: true, name: true } }, organizer: { select: { id: true, brandName: true, username: true } }, activities: { orderBy: { createdAt: 'desc' } } },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  create(body: CreateLeadBody) {
    if (!body.name?.trim()) throw new BadRequestException('Name is required');
    if (!LEAD_SOURCES.includes(body.source as (typeof LEAD_SOURCES)[number])) throw new BadRequestException('Invalid source');
    return this.prisma.lead.create({
      data: {
        name: body.name.trim(),
        source: body.source,
        contact: body.contact?.trim() || null,
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

  async update(id: string, body: UpdateLeadBody) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (body.stage && !LEAD_STAGES.includes(body.stage as (typeof LEAD_STAGES)[number])) throw new BadRequestException('Invalid stage');
    if (body.source && !LEAD_SOURCES.includes(body.source as (typeof LEAD_SOURCES)[number])) throw new BadRequestException('Invalid source');
    return this.prisma.lead.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.source !== undefined ? { source: body.source } : {}),
        ...(body.contact !== undefined ? { contact: body.contact?.trim() || null } : {}),
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
      include: { assignedTo: { select: { id: true, name: true } }, organizer: { select: { id: true, brandName: true, username: true } } },
    });
  }

  async remove(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    await this.prisma.lead.delete({ where: { id } });
    return { ok: true };
  }

  async addActivity(id: string, text: string) {
    if (!text?.trim()) throw new BadRequestException('Activity text is required');
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    await this.prisma.lead.update({ where: { id }, data: { updatedAt: new Date() } });
    return this.prisma.leadActivity.create({ data: { leadId: id, text: text.trim() } });
  }

  async searchOrganizers(q: string) {
    if (!q?.trim()) return [];
    return this.prisma.organizer.findMany({
      where: {
        OR: [{ brandName: { contains: q, mode: 'insensitive' } }, { username: { contains: q, mode: 'insensitive' } }],
      },
      select: { id: true, brandName: true, username: true, city: true },
      take: 10,
    });
  }

  async linkOrganizer(id: string, organizerId: string) {
    const [lead, organizer] = await Promise.all([this.prisma.lead.findUnique({ where: { id } }), this.prisma.organizer.findUnique({ where: { id: organizerId } })]);
    if (!lead) throw new NotFoundException('Lead not found');
    if (!organizer) throw new NotFoundException('Organizer not found');
    const already = await this.prisma.lead.findUnique({ where: { organizerId } });
    if (already && already.id !== id) throw new BadRequestException('That organizer is already linked to another lead');
    return this.prisma.lead.update({
      where: { id },
      data: { organizerId, stage: 'Signed up' },
      include: { assignedTo: { select: { id: true, name: true } }, organizer: { select: { id: true, brandName: true, username: true } } },
    });
  }

  /** Sends the real organizer onboarding link — the send itself is the
   * primary action here (not a side effect tacked onto something else), so
   * unlike most other notification call sites in this codebase, an email
   * failure is NOT silently caught: Resend is the guaranteed-delivered
   * channel, so a real failure (bad address, etc.) should surface to staff.
   * WhatsApp stays best-effort (`.catch(() => {})`) since 'lead_onboarding_
   * invite' is a brand-new campaign that needs AiSensy/Meta approval first,
   * same as every other new campaign in this codebase. */
  async sendOnboardingLink(id: string, channels: { email?: boolean; whatsapp?: boolean }) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (!channels.email && !channels.whatsapp) throw new BadRequestException('Pick at least one channel');

    const name = lead.contactPerson?.trim() || lead.name;
    const sent: string[] = [];

    if (channels.email) {
      if (!lead.email?.trim()) throw new BadRequestException('This lead has no email on file');
      await this.email.sendTemplate(lead.email, 'lead_onboarding_invite', { name, brand: lead.name });
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
