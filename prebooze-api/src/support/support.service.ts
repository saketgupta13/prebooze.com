import { BadRequestException, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { StaffAlertsService } from '../notifications/staff-alerts';

@Injectable()
export class SupportService {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsappService,
    private email: EmailService,
    private staffAlerts: StaffAlertsService,
  ) {}

  async tickets(userId: string) {
    return this.prisma.helpTicket.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  /** "role recorded" (BACKEND.md) is captured server-side from the caller's
   * actual User.role at submission time — not trusted from the client, even
   * though the frontend's HelpCenter.tsx already bakes a role label into the
   * `topic` string client-side (e.g. "Organizer · Payouts & withdrawals").
   * That string is kept as-is for display; `role` is the reliable column an
   * admin queue would actually filter/sort by. */
  async raise(userId: string, body: { topic?: string; subject?: string; message?: string }) {
    if (!body.subject?.trim() || !body.message?.trim()) throw new BadRequestException('Subject and message are required');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const id = 'HT-' + randomInt(1000, 9999);
    const ticket = await this.prisma.helpTicket.create({
      data: { id, userId, role: user.role ?? 'guest', topic: body.topic ?? '', subject: body.subject.trim(), message: body.message.trim() },
    });

    await this.wa.send(user.phone, 'help_ticket', [id, ticket.subject, ticket.topic]).catch(() => {});
    await this.email.sendTemplate(user.email, 'help_ticket', {
      name: user.name, ticketId: id, ticketSubject: ticket.subject,
    }).catch(() => {});
    return ticket;
  }

  /** Public Contact-us form (Contact.tsx) — the only support entry point
   * that doesn't require a login, so it's the one place HelpTicket.userId
   * is genuinely null and name/email are captured directly from the form
   * instead of read off a User row. No dedicated admin queue UI exists yet
   * for HelpTicket (see the `raise()` comment above — same real gap), so
   * this leans on the same real staff-alert fan-out other real-time admin
   * notifications already use, plus a real confirmation email back to the
   * submitter, rather than leaving the message undelivered anywhere. */
  async contact(body: { name?: string; email?: string; role?: string; message?: string }) {
    const name = body.name?.trim();
    const email = body.email?.trim();
    if (!name || !email || !body.message?.trim()) throw new BadRequestException('Name, email and message are required');

    const id = 'HT-' + randomInt(1000, 9999);
    const ticket = await this.prisma.helpTicket.create({
      data: {
        id, name, email,
        role: body.role?.trim() || 'guest',
        topic: 'Contact form',
        subject: `Contact form — ${name}`,
        message: body.message.trim(),
      },
    });

    await this.staffAlerts.alert(`New contact form message from ${name} (${email}): ${body.message.trim().slice(0, 140)}`);
    await this.email.sendTemplate(email, 'contact_form_received', { name, ticketId: id }).catch(() => {});
    return ticket;
  }
}
