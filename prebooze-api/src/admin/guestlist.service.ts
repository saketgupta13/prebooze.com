import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';

interface Companion {
  name: string;
  phone: string;
}

@Injectable()
export class GuestListService {
  constructor(private prisma: PrismaService, private wa: WhatsappService) {}

  /** Public pass fetch for VipPass.tsx (GET /vip/pass/:id) — no auth, same
   * as PromoterService.getPass. venue/organizer included for the pass
   * page's "hosted by"/location display; unlike a promoter pass, there's
   * no cutoff to show, so tiers aren't needed here. */
  async getPass(id: string) {
    const entry = await this.prisma.guestListEntry.findUnique({ where: { id }, include: { event: { include: { venue: true, organizer: true } } } });
    if (!entry) throw new NotFoundException('Pass not found');
    return entry;
  }

  async list(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const entries = await this.prisma.guestListEntry.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } });
    const totalHeads = entries.reduce((a, g) => a + 1 + g.plusOnes, 0);
    const arrived = entries.filter((g) => g.arrived).reduce((a, g) => a + 1 + g.plusOnes, 0);
    return { entries, namesCount: entries.length, totalHeads, arrived };
  }

  async add(eventId: string, addedBy: string, body: { name?: string; phone?: string; plusOnes?: number; companions?: Companion[] }) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (!body.name?.trim()) throw new BadRequestException('Guest name is required');
    if (!body.phone?.trim()) throw new BadRequestException('WhatsApp number is required for the main guest');

    const plusOnes = Math.max(0, Math.min(6, body.plusOnes ?? 0));
    const companions = (body.companions ?? []).slice(0, plusOnes);
    for (let i = 0; i < plusOnes; i++) {
      if (!companions[i]?.name?.trim()) throw new BadRequestException(`Name is required for plus-one ${i + 1}`);
      if (!companions[i]?.phone?.trim()) throw new BadRequestException(`WhatsApp number is required for plus-one ${i + 1}`);
    }

    const entry = await this.prisma.guestListEntry.create({
      data: {
        eventId,
        name: body.name.trim(),
        phone: body.phone.trim(),
        plusOnes,
        companions: companions.map((c) => ({ name: c.name.trim(), phone: c.phone.trim() })),
        addedBy,
      },
    });

    // Real gap this closed: an organizer adding someone to their own guest
    // list previously sent nothing at all — the VIP/companion had no way to
    // know they were invited and nothing to show at the gate. Reuses the
    // same guest_pass WhatsApp template promoter passes already send
    // (real, Meta-approved template — the [name, eventTitle, url] param
    // shape already fits; a VIP-specific template would need its own
    // approval, so the distinct "you're invited" feel lives on the pass
    // page itself instead). Every named person gets their own message —
    // the main guest and each companion — all pointing at the same shared
    // /vip/:id pass, since the whole party still arrives together and
    // shows one QR at the door; this just means everyone has that link on
    // their own phone rather than only whoever holds the main guest's.
    const passUrl = `${process.env.WEB_APP_URL ?? ''}/vip/${entry.id}`;
    this.wa.send(entry.phone, 'guest_pass', [entry.name, event.title, passUrl]).catch(() => {});
    for (const c of companions) {
      this.wa.send(c.phone.trim(), 'guest_pass', [c.name.trim(), event.title, passUrl]).catch(() => {});
    }

    return entry;
  }

  async toggleArrived(id: string) {
    const entry = await this.prisma.guestListEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Guest list entry not found');
    return this.prisma.guestListEntry.update({ where: { id }, data: { arrived: !entry.arrived } });
  }

  async remove(id: string) {
    const entry = await this.prisma.guestListEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Guest list entry not found');
    await this.prisma.guestListEntry.delete({ where: { id } });
    return { ok: true };
  }
}
