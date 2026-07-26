import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../notifications/email';
import { TEMPLATE_DEFS, renderTemplate } from '../notifications/email-templates';

@Injectable()
export class EmailTemplatesAdminService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  /** Every known (fixed, code-triggered) template id merged with whatever
   * admin override exists, plus every custom (admin-created, id prefixed
   * "custom_") template — those have no code default, the DB row is the
   * whole thing, so `customized` is always true for them. */
  async list() {
    const overrides = await this.prisma.emailTemplate.findMany();
    const byId = new Map(overrides.map((o) => [o.id, o]));
    const fixed = TEMPLATE_DEFS.map((def) => {
      const o = byId.get(def.id);
      return {
        id: def.id,
        name: def.name,
        category: def.category,
        trigger: def.trigger,
        tokens: def.tokens,
        hasCta: Boolean(def.cta),
        ctaLabel: def.cta?.label,
        subject: o?.subject ?? def.defaultSubject,
        bodyHtml: o?.bodyHtml ?? def.defaultBody,
        defaultSubject: def.defaultSubject,
        defaultBody: def.defaultBody,
        customized: Boolean(o),
        custom: false,
        updatedAt: o?.updatedAt,
        updatedBy: o?.updatedBy,
      };
    });
    const custom = overrides
      .filter((o) => !TEMPLATE_DEFS.some((def) => def.id === o.id))
      .map((o) => ({
        id: o.id,
        name: o.name ?? o.id,
        category: o.category ?? 'Custom',
        trigger: 'Manual — sent from admin, not tied to an automatic trigger',
        tokens: [] as string[],
        hasCta: false,
        ctaLabel: undefined,
        subject: o.subject,
        bodyHtml: o.bodyHtml,
        defaultSubject: o.subject,
        defaultBody: o.bodyHtml,
        customized: true,
        custom: true,
        updatedAt: o.updatedAt,
        updatedBy: o.updatedBy,
      }));
    return [...fixed, ...custom];
  }

  /** New, freestanding template with no code trigger — id is a generated
   * "custom_<slug>" key, collision-checked against both the fixed set and
   * any other custom template already created. */
  async create(input: { name?: string; subject?: string; bodyHtml?: string }, updatedBy: string) {
    if (!input.name?.trim() || !input.subject?.trim() || !input.bodyHtml?.trim()) {
      throw new BadRequestException('name, subject and bodyHtml are required');
    }
    const base = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '') || 'template';
    let id = `custom_${base}`;
    let n = 1;
    const taken = async (candidate: string) =>
      TEMPLATE_DEFS.some((d) => d.id === candidate) || Boolean(await this.prisma.emailTemplate.findUnique({ where: { id: candidate } }));
    while (await taken(id)) id = `custom_${base}_${++n}`;

    return this.prisma.emailTemplate.create({
      data: { id, name: input.name.trim(), category: 'Custom', subject: input.subject, bodyHtml: input.bodyHtml, updatedBy },
    });
  }

  /** Renders a real preview using sample data for every token the template
   * declares — same rendering path a real send uses, so what admin sees is
   * exactly what a recipient would get. */
  async preview(id: string) {
    const [override, settings] = await Promise.all([
      this.prisma.emailTemplate.findUnique({ where: { id } }),
      this.prisma.platformSettings.findUnique({ where: { id: 'main' } }),
    ]);
    const def = TEMPLATE_DEFS.find((t) => t.id === id);
    if (!def && !override) throw new NotFoundException('Unknown template');
    const sample = Object.fromEntries((def?.tokens ?? []).map((t) => [t, SAMPLE_VALUES[t] ?? `{${t}}`]));
    return renderTemplate(id, sample, override, settings?.logoUrl);
  }

  async update(id: string, patch: { subject?: string; bodyHtml?: string }, updatedBy: string) {
    const def = TEMPLATE_DEFS.find((t) => t.id === id);
    const existing = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!def && !existing) throw new NotFoundException('Unknown template');
    if (!patch.subject?.trim() || !patch.bodyHtml?.trim()) throw new BadRequestException('subject and bodyHtml are required');
    return this.prisma.emailTemplate.upsert({
      where: { id },
      update: { subject: patch.subject, bodyHtml: patch.bodyHtml, updatedBy },
      create: { id, subject: patch.subject, bodyHtml: patch.bodyHtml, updatedBy },
    });
  }

  /** For a fixed template: deletes the override row, reverting to the code
   * default. For a custom template: deletes it outright — there's no
   * default to fall back to, this is the only way it ever "goes back" to
   * anything, i.e. gone. */
  async reset(id: string) {
    await this.prisma.emailTemplate.deleteMany({ where: { id } });
    return { ok: true };
  }

  /** Manual one-off send — the only way a custom template ever reaches an
   * inbox, since it has no automatic trigger. Fixed templates can be sent
   * this way too (handy for testing a customization for real). */
  async sendNow(id: string, to: string) {
    if (!to?.trim()) throw new BadRequestException('to is required');
    const def = TEMPLATE_DEFS.find((t) => t.id === id);
    const override = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!def && !override) throw new NotFoundException('Unknown template');
    const sample = Object.fromEntries((def?.tokens ?? []).map((t) => [t, SAMPLE_VALUES[t] ?? '']));
    await this.email.sendTemplate(to, id, sample);
    return { ok: true };
  }
}

const SAMPLE_VALUES: Record<string, string> = {
  name: 'Priya', eventTitle: 'Indie Night Live', bookingId: '#TKT-48213', qty: '2', total: '₹900',
  amount: '₹900', refundNote: 'to your original payment method — usually 5–7 business days to reflect.',
  eventUrl: 'https://prebooze.com/events/indie-night-live', friendName: 'Rohan', ticketId: 'HT-4821',
  ticketSubject: 'Refund not received', roleLabel: 'organizer', reasonBlock: '<p style="background:rgba(255,107,94,.08);border:1px solid rgba(255,107,94,.25);border-radius:8px;padding:10px 12px;">Business documents didn\'t match the applicant name — please resubmit with matching ID.</p>',
  role: 'organizer', itemLabel: 'organizer (livewire)', roleName: 'Finance', tempPassword: 'Xk9-pQ2r-fA7z',
  jobTitle: 'Senior React Engineer', ownerName: 'Owner', revenue: '₹3,40,000', bookings: '312', payoutsDue: '₹1,20,000',
  periodLabel: '14–20 Jul', invoiceNumber: 'INV-2026-000123', description: '2× General — Indie Night Live',
};
