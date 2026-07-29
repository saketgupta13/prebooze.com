import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async wallet(userId: string) {
    const txs = await this.prisma.walletTx.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    const balance = txs.reduce((a, t) => a + t.amount, 0);
    return { balance, txs };
  }

  async payMethods(userId: string) {
    return this.prisma.payMethod.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  /** Auto-saves the method a real Razorpay payment actually used — called
   * right after any successful checkout (guest booking, role subscription
   * charge, Featured payment), for every role, not just guests manually
   * adding a card in Settings. Matched by matchKey (real last4+network for
   * cards, the real VPA for UPI — never anything typed client-side): a
   * repeat payment with the same method increments usedCount on the
   * existing row via the real DB unique index instead of inserting a
   * duplicate. netbanking/wallet have no stable, recognizable "saved
   * method" identity, so those are left alone — matches what the
   * "Pay with" list already only ever showed for card/UPI. */
  async saveUsedMethod(userId: string, payment: { method: string; card?: { last4: string; network: string; type: string }; vpa?: string }) {
    let type: string;
    let label: string;
    let matchKey: string;
    if (payment.method === 'card' && payment.card) {
      type = 'card';
      label = `${payment.card.network} •••• ${payment.card.last4}`;
      matchKey = `card:${payment.card.last4}:${payment.card.network}`;
    } else if (payment.method === 'upi' && payment.vpa) {
      type = 'upi';
      label = payment.vpa;
      matchKey = `upi:${payment.vpa}`;
    } else {
      return;
    }
    const existingCount = await this.prisma.payMethod.count({ where: { userId } });
    await this.prisma.payMethod.upsert({
      where: { userId_matchKey: { userId, matchKey } },
      create: { userId, type, label, matchKey, isDefault: existingCount === 0 },
      update: { usedCount: { increment: 1 } },
    });
  }

  /** Note: this deliberately has no `cvv`/`cvvToken` field anywhere in its
   * input type — CVV is verified client-side against the card network at
   * charge time and must never reach our server, let alone be stored. */
  async addPayMethod(userId: string, m: { type: 'upi' | 'card'; label: string; holder?: string; expiry?: string }) {
    const existing = await this.prisma.payMethod.count({ where: { userId } });
    return this.prisma.payMethod.create({
      data: { userId, ...m, isDefault: existing === 0 }, // first saved method becomes default automatically
    });
  }

  async removePayMethod(userId: string, id: string) {
    const method = await this.prisma.payMethod.findUnique({ where: { id } });
    if (!method) throw new NotFoundException();
    if (method.userId !== userId) throw new ForbiddenException();
    await this.prisma.payMethod.delete({ where: { id } });
    return { ok: true };
  }

  async setDefaultPayMethod(userId: string, id: string) {
    const method = await this.prisma.payMethod.findUnique({ where: { id } });
    if (!method) throw new NotFoundException();
    if (method.userId !== userId) throw new ForbiddenException();
    await this.prisma.$transaction([
      this.prisma.payMethod.updateMany({ where: { userId }, data: { isDefault: false } }),
      this.prisma.payMethod.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return { ok: true };
  }

  async setAutoRenew(userId: string, on: boolean) {
    if (typeof on !== 'boolean') throw new BadRequestException('`on` must be a boolean');
    await this.prisma.user.update({ where: { id: userId }, data: { autoRenew: on } });
    return { ok: true };
  }
}
