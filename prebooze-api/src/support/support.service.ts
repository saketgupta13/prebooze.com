import { BadRequestException, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';

@Injectable()
export class SupportService {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsappService,
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
    return ticket;
  }
}
