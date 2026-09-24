import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../notifications/email';
import { StaffAlertsService } from '../notifications/staff-alerts';
import { resolveContactEmail } from './resolve-contact-email';

@Injectable()
export class SupportService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private staffAlerts: StaffAlertsService,
  ) {}

  async tickets(userId: string) {
    return this.prisma.helpTicket.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  /** One ticket's full thread — real, previously non-existent (a ticket was
   * a static single message with no way to see or add a reply). Scoped to
   * the caller's own ticket, same "resource ownership, not just auth"
   * pattern as every other userId-scoped GET in this codebase. */
  async ticket(userId: string, id: string) {
    const ticket = await this.prisma.helpTicket.findUnique({
      where: { id },
      include: { replies: { orderBy: { createdAt: 'asc' }, include: { fromStaff: { select: { name: true } } } } },
    });
    if (!ticket || ticket.userId !== userId) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  /** A guest follow-up on their own open ticket — closed tickets can't be
   * replied to from this side; reopening (if ever wanted) is a staff action
   * via the admin console, not implicit on a guest message. Notifies staff
   * the same way a new Contact-us message does, so a guest reply doesn't
   * sit unseen until someone happens to check the queue. */
  async reply(userId: string, id: string, message: string) {
    if (!message?.trim()) throw new BadRequestException('Message is required');
    const ticket = await this.prisma.helpTicket.findUnique({ where: { id } });
    if (!ticket || ticket.userId !== userId) throw new NotFoundException('Ticket not found');
    if (ticket.status !== 'open') throw new ForbiddenException('This ticket is resolved — raise a new one if you need more help');

    const reply = await this.prisma.helpTicketReply.create({ data: { ticketId: id, fromUserId: userId, message: message.trim() } });
    await this.staffAlerts.alert(`New reply on ticket ${id}: ${message.trim().slice(0, 140)}`).catch(() => {});
    return reply;
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

    // Email only — WhatsApp dropped for this flow (real user-reported gap:
    // no reply/thread UI existed on either end for a guest to act on a
    // WhatsApp ping anyway; email is the channel that actually carries a
    // useful "view your ticket" link). Silently no-ops when there's no
    // email on file (see EmailService.sendTemplate). For an elevated role,
    // "their email" means their own brand contact email, not the
    // account-level User.email a guest thinks of — see
    // resolveContactEmail's own comment.
    const to = await resolveContactEmail(this.prisma, userId, user.role, user.email);
    await this.email.sendTemplate(to, 'help_ticket', {
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
