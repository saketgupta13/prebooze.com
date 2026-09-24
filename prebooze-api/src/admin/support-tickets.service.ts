import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../notifications/email';
import { resolveContactEmail } from '../support/resolve-contact-email';

/** Admin queue for HelpTicket — didn't exist at all before this (raise()
 * created real rows, but nothing on the admin side could ever see or reply
 * to one; found via a real user-reported ticket that got no visible
 * response anywhere). Mirrors the shape of the guest-facing SupportService
 * but write access is staff-only and every reply is attributed to the
 * staff member who sent it. */
@Injectable()
export class AdminSupportTicketsService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async list(status?: string) {
    return this.prisma.helpTicket.findMany({
      where: status && status !== 'all' ? { status } : undefined,
      include: { user: { select: { name: true, phone: true } }, _count: { select: { replies: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const ticket = await this.prisma.helpTicket.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        replies: { orderBy: { createdAt: 'asc' }, include: { fromStaff: { select: { name: true } } } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async reply(id: string, staffId: string, message: string) {
    if (!message?.trim()) throw new BadRequestException('Message is required');
    const ticket = await this.prisma.helpTicket.findUnique({ where: { id }, include: { user: true } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const reply = await this.prisma.helpTicketReply.create({ data: { ticketId: id, fromStaffId: staffId, message: message.trim() } });

    // Same role-aware resolution as SupportService.raise() — see
    // resolveContactEmail's own comment.
    const to = await resolveContactEmail(this.prisma, ticket.userId, ticket.user?.role ?? ticket.role, ticket.user?.email || ticket.email);
    const name = ticket.user?.name || ticket.name || 'there';
    await this.email.sendTemplate(to, 'help_ticket_reply', {
      name, ticketId: id, ticketSubject: ticket.subject, replyMessage: message.trim(),
    }).catch(() => {});

    return reply;
  }

  async setStatus(id: string, status: string) {
    if (!['open', 'resolved'].includes(status)) throw new BadRequestException('Invalid status');
    const ticket = await this.prisma.helpTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return this.prisma.helpTicket.update({ where: { id }, data: { status } });
  }
}
