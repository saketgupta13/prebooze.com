import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { money } from '../notifications/email-templates';
import { REFERRAL_REFEREE_WELCOME } from './referral.constants';
import { missingProfileFields } from '../auth/profile-completeness';

@Injectable()
export class ReferralsService {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsappService,
    private email: EmailService,
  ) {}

  async mine(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      include: { referee: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      code: user.referralCode,
      referrals: referrals.map((r) => ({
        code: r.code,
        referrerPhone: user.phone,
        refereePhone: r.referee.phone,
        refereeName: r.referee.name || undefined,
        status: r.status,
        createdAt: r.createdAt,
      })),
    };
  }

  /** Claims a referral code for the *caller* (the referee). One claim per
   * phone, ever — enforced by Referral.refereeId being @unique — and the
   * frontend only surfaces this to brand-new signups (see ReferralLanding.tsx),
   * though the guard here is data integrity, not a "new account" check. */
  async claim(userId: string, code: string) {
    const referrer = await this.prisma.user.findUnique({ where: { referralCode: code.toUpperCase() } });
    if (!referrer) throw new BadRequestException('Invalid referral code');
    if (referrer.id === userId) throw new BadRequestException("You can't refer yourself");
    // A referral link is only "on" once its owner has actually finished
    // their own profile — same completeness definition the reward nudge and
    // claimProfileCompletionReward already use. Caller (AppContext's
    // loginWithOtp) already swallows a claim() failure silently, same as
    // the "already used a code" case just above, so a friend referred by an
    // incomplete profile just quietly gets no welcome credit rather than a
    // visible error.
    if (missingProfileFields(referrer).length > 0) {
      throw new BadRequestException("This referral link isn't active yet — its owner needs to finish their profile first");
    }

    const existing = await this.prisma.referral.findUnique({ where: { refereeId: userId } });
    if (existing) throw new BadRequestException('This number has already used a referral code');

    const referral = await this.prisma.referral.create({
      data: { code: code.toUpperCase(), referrerId: referrer.id, refereeId: userId, status: 'joined' },
    });

    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
    const welcome = settings?.referralReferee ?? REFERRAL_REFEREE_WELCOME;
    await this.prisma.walletTx.create({
      data: { userId, type: 'referral_welcome', amount: welcome, note: "Welcome credit — joined via a friend's referral link" },
    });

    const referee = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.wa.send(referee.phone, 'referral_welcome', [String(welcome)]).catch(() => {});
    await this.email.sendTemplate(referee.email, 'referral_welcome', {
      name: referee.name, amount: money(welcome),
    }).catch(() => {});

    return referral;
  }
}
