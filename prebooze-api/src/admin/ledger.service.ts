import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class LedgerService {
  constructor(private prisma: PrismaService) {}

  async list(kind?: 'income' | 'expense') {
    const entries = await this.prisma.ledgerEntry.findMany({ where: kind ? { kind } : undefined, orderBy: { createdAt: 'desc' } });
    const totalIncome = await this.sum('income');
    const totalExpense = await this.sum('expense');
    return { entries, totalIncome, totalExpense, net: totalIncome - totalExpense };
  }

  private async sum(kind: 'income' | 'expense') {
    const agg = await this.prisma.ledgerEntry.aggregate({ where: { kind }, _sum: { amount: true } });
    return agg._sum.amount ?? 0;
  }

  async addEntry(body: { kind?: 'income' | 'expense'; category?: string; amount?: number; note?: string }) {
    if (body.kind !== 'income' && body.kind !== 'expense') throw new BadRequestException('kind must be "income" or "expense"');
    if (!body.category?.trim()) throw new BadRequestException('category is required');
    if (!Number.isFinite(body.amount) || (body.amount ?? 0) <= 0) throw new BadRequestException('amount must be a positive number');
    // manual entries are never auto-posted, regardless of what the client sends
    return this.prisma.ledgerEntry.create({
      data: { kind: body.kind, category: body.category.trim(), amount: Math.round(body.amount!), note: body.note, auto: false },
    });
  }

  async removeEntry(id: string) {
    const entry = await this.prisma.ledgerEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Ledger entry not found');
    if (entry.auto) throw new ForbiddenException('Auto-posted entries reflect real activity and can\'t be removed manually');
    await this.prisma.ledgerEntry.delete({ where: { id } });
    return { ok: true };
  }

  async listCategories() {
    const rows = await this.prisma.ledgerCategory.findMany({ orderBy: { name: 'asc' } });
    return {
      income: rows.filter((r) => r.kind === 'income').map((r) => r.name),
      expense: rows.filter((r) => r.kind === 'expense').map((r) => r.name),
    };
  }

  async addCategory(kind: 'income' | 'expense', name: string) {
    if (kind !== 'income' && kind !== 'expense') throw new BadRequestException('kind must be "income" or "expense"');
    if (!name?.trim()) throw new BadRequestException('name is required');
    const existing = await this.prisma.ledgerCategory.findUnique({ where: { kind_name: { kind, name: name.trim() } } });
    if (existing) return existing;
    return this.prisma.ledgerCategory.create({ data: { kind, name: name.trim() } });
  }
}
