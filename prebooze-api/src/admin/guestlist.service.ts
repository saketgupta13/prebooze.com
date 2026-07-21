import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

interface Companion {
  name: string;
  phone: string;
}

@Injectable()
export class GuestListService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.guestListEntry.create({
      data: {
        eventId,
        name: body.name.trim(),
        phone: body.phone.trim(),
        plusOnes,
        companions: companions.map((c) => ({ name: c.name.trim(), phone: c.phone.trim() })),
        addedBy,
      },
    });
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
