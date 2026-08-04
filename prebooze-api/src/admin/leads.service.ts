import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export const LEAD_SOURCES = ['Instagram', 'WhatsApp', 'Phone call', 'Referral / walk-in', 'Website inquiry', 'Other social', 'Other'] as const;
export const LEAD_STAGES = ['New', 'Contacted', 'Interested', 'Negotiating', 'Signed up', 'Declined'] as const;

interface CreateLeadBody {
  name: string;
  source: string;
  contact?: string;
  city?: string;
  eventType?: string;
  assignedToId?: string;
  followUpAt?: string;
}

interface UpdateLeadBody {
  name?: string;
  source?: string;
  contact?: string;
  city?: string;
  eventType?: string;
  stage?: string;
  assignedToId?: string | null;
  followUpAt?: string | null;
}

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

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
