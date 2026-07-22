import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ReferralsAdminService {
  constructor(private prisma: PrismaService) {}

  async rates() {
    const s = await this.prisma.platformSettings.upsert({ where: { id: 'main' }, update: {}, create: { id: 'main' } });
    return { referee: s.referralReferee, referrer: s.referralReferrer };
  }

  async updateRates(body: { referee?: number; referrer?: number }) {
    const data: { referralReferee?: number; referralReferrer?: number } = {};
    if (body.referee !== undefined) data.referralReferee = body.referee;
    if (body.referrer !== undefined) data.referralReferrer = body.referrer;
    const s = await this.prisma.platformSettings.upsert({ where: { id: 'main' }, update: data, create: { id: 'main', ...data } });
    return { referee: s.referralReferee, referrer: s.referralReferrer };
  }

  /** Platform-wide, across every referrer — distinct from ReferralsService.mine()
   * which is scoped to one user. */
  async analytics() {
    const rates = await this.rates();
    const referrals = await this.prisma.referral.findMany({
      include: {
        referrer: { select: { name: true, phone: true } },
        referee: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const qualified = referrals.filter((r) => r.status === 'qualified');
    const conversion = referrals.length ? Math.round((qualified.length / referrals.length) * 100) : 0;
    const creditsIssued = referrals.length * rates.referee + qualified.length * rates.referrer;

    const byReferrer = new Map<string, { name: string; joined: number; qualified: number }>();
    for (const r of referrals) {
      const cur = byReferrer.get(r.referrerId) ?? { name: r.referrer.name || r.referrer.phone, joined: 0, qualified: 0 };
      cur.joined += 1;
      if (r.status === 'qualified') cur.qualified += 1;
      byReferrer.set(r.referrerId, cur);
    }
    const topReferrers = [...byReferrer.values()].sort((a, b) => b.qualified - a.qualified || b.joined - a.joined).slice(0, 5);

    return {
      rates,
      totalReferrals: referrals.length,
      qualified: qualified.length,
      conversion,
      creditsIssued,
      topReferrers,
      referrals: referrals.map((r) => ({
        code: r.code,
        referrer: r.referrer.name || r.referrer.phone,
        referrerPhone: r.referrer.phone,
        referee: r.referee.name || r.referee.phone,
        refereePhone: r.referee.phone,
        status: r.status,
        createdAt: r.createdAt,
      })),
    };
  }
}
