import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomInt } from 'crypto';
import type Redis from 'ioredis';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { REDIS } from '../redis.provider';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { uniqueReferralCodeFor } from '../referrals/referral.constants';

const OTP_TTL_S = 300; // 5 minutes
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_OTPS_PER_HOUR = 5;

/** "+91 9990001111" — collapse whitespace, keep leading + and digits. */
export function normalizePhone(raw: string): string {
  const cleaned = raw.trim().replace(/[^\d+]/g, '');
  if (!/^\+?\d{10,15}$/.test(cleaned)) throw new BadRequestException('Invalid phone number');
  const withCc = cleaned.startsWith('+') ? cleaned : `+91${cleaned.slice(-10)}`;
  // store in the same shape the frontend uses: "+91 9990001111"
  return `${withCc.slice(0, withCc.length - 10)} ${withCc.slice(-10)}`;
}

/** Map a DB user to the exact User shape prebooze-web already consumes. */
export function toApiUser(u: User) {
  return {
    phone: u.phone,
    name: u.name,
    username: u.username,
    email: u.email,
    city: u.city,
    state: u.state ?? undefined,
    country: u.country ?? undefined,
    pincode: u.pincode ?? undefined,
    avatarUrl: u.avatarUrl ?? undefined,
    dob: u.dob,
    gender: u.gender,
    profession: u.profession,
    languages: u.languages,
    bio: u.bio,
    socials: u.socials,
    socialLinks: u.socialLinks as Record<string, string>,
    interests: u.interests,
    phoneVerified: u.phoneVerified,
    idVerified: u.idVerified,
    profilePct: u.profilePct,
    joined: u.createdAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    isOrganizer: u.role === 'organizer',
    orgBrand: u.orgBrand ?? undefined,
    orgUsername: u.orgUsername ?? undefined,
    orgLogoUrl: u.orgLogoUrl ?? undefined,
    isLineup: u.role === 'lineup' || undefined,
    lineupName: u.lineupName ?? undefined,
    lineupCategory: u.lineupCategory ?? undefined,
    lineupUsername: u.lineupUsername ?? undefined,
    lineupLogoUrl: u.lineupLogoUrl ?? undefined,
    isPromoter: u.role === 'promoter' || undefined,
    promoterBrand: u.promoterBrand ?? undefined,
    promoterUsername: u.promoterUsername ?? undefined,
    promoterPlan: u.promoterPlan ?? undefined,
    promoterLogoUrl: u.promoterLogoUrl ?? undefined,
    isVenue: u.role === 'venue' || undefined,
    venueName: u.venueName ?? undefined,
    venueId: u.venueId ?? undefined,
    venueLogoUrl: u.venueLogoUrl ?? undefined,
    attendanceVisibility: u.attendanceVisibility,
    autoRenew: u.autoRenew,
    // null = never applied for a role; 'pending' | 'approved' | 'rejected' otherwise.
    // Pair with orgBrand/promoterBrand/lineupName/venueName (set immediately on
    // submit) to know *which* role is pending — the elevated role flags above
    // only flip true once an admin approves.
    roleStatus: u.roleStatus ?? undefined,
    profileRewardClaimedAt: u.profileRewardClaimedAt?.toISOString() ?? undefined,
    profileRewardCode: u.profileRewardCode ?? undefined,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private wa: WhatsappService,
    private email: EmailService,
    @Inject(REDIS) private redis: Redis,
  ) {}

  /** Every guest now needs a username the moment their account exists — the
   * "finish your profile" step (where a username used to be collected) is
   * soft-required and can be deferred, but /u/:username, referral links, and
   * anywhere else a guest's profile is linked to can't sit on a blank value
   * in the meantime. Deterministic-ish base from the phone number (same
   * spirit as referralCodeFor), collision-checked with a numeric suffix —
   * same pattern KycService.newOrganizerRow already uses for organizer
   * usernames, just against User instead. Guests can still rename it for
   * real in the finish-profile step; this is only ever a starting point. */
  private async uniqueUsername(phone: string): Promise<string> {
    const digits = phone.replace(/\D/g, '').slice(-8) || '0';
    const base = `guest${digits}`;
    let candidate = base;
    let n = 1;
    while (await this.prisma.user.findFirst({ where: { username: candidate } })) {
      candidate = `${base}-${++n}`;
    }
    return candidate;
  }

  async requestOtp(rawPhone: string) {
    const phone = normalizePhone(rawPhone);

    const rlKey = `otp-rl:${phone}`;
    const sent = await this.redis.incr(rlKey);
    if (sent === 1) await this.redis.expire(rlKey, 3600);
    if (sent > MAX_OTPS_PER_HOUR) throw new BadRequestException('Too many OTP requests — try again later');

    const requestId = randomBytes(16).toString('hex');
    const code = String(randomInt(1000, 10000)); // 4 digits, matches the app's OTP boxes
    await this.redis.set(
      `otp:${requestId}`,
      JSON.stringify({ phone, code, attempts: 0 }),
      'EX',
      OTP_TTL_S,
    );
    try {
      await this.wa.sendOtp(phone, code);
    } catch {
      // Never let a dead WhatsApp integration lock everyone out of login —
      // surface a clean, actionable error instead of a raw 500, and drop the
      // now-undeliverable code so it can't be brute-forced.
      await this.redis.del(`otp:${requestId}`);
      throw new BadRequestException("Couldn't send your code right now — please try again shortly");
    }

    // In dev (no live WhatsApp) return the code so the flow is testable end-to-end.
    return this.wa.live ? { requestId } : { requestId, devCode: code };
  }

  async verifyOtp(requestId: string, code: string) {
    const key = `otp:${requestId}`;
    const raw = await this.redis.get(key);
    if (!raw) throw new UnauthorizedException('OTP expired — request a new one');
    const rec = JSON.parse(raw) as { phone: string; code: string; attempts: number };

    if (rec.attempts >= MAX_VERIFY_ATTEMPTS) {
      await this.redis.del(key);
      throw new UnauthorizedException('Too many attempts — request a new OTP');
    }
    if (rec.code !== code) {
      rec.attempts += 1;
      const ttl = await this.redis.ttl(key);
      await this.redis.set(key, JSON.stringify(rec), 'EX', Math.max(ttl, 1));
      throw new UnauthorizedException('Incorrect code');
    }
    await this.redis.del(key);

    const existing = await this.prisma.user.findUnique({ where: { phone: rec.phone } });
    const user =
      existing ??
      (await this.prisma.user.create({
        data: {
          phone: rec.phone,
          referralCode: await uniqueReferralCodeFor(this.prisma, rec.phone),
          username: await this.uniqueUsername(rec.phone),
        },
      }));

    // Lazily link any organizer team invites sent to this phone before this
    // login — invites are created by phone (OrgTeamService.addStaff), often
    // before the invitee has ever logged in at all, so there's no User row
    // to link at invite time. Idempotent no-op once already linked.
    await this.prisma.orgStaff.updateMany({ where: { phone: user.phone, userId: null }, data: { userId: user.id } });

    const token = await this.jwt.signAsync({ sub: user.id, phone: user.phone });
    return { token, user: toApiUser(user), isNew: !existing };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return toApiUser(user);
  }

  /** Self-serve login-number change, step 1 of 2 — same OTP mechanics as
   * requestOtp (rate limit, 4-digit code, 5 min TTL, WhatsApp delivery) but
   * scoped to the calling user and a specific new number, not anonymous
   * login. The code goes to the NEW number (proves they actually control
   * it) — Redis key is namespaced separately from login OTPs so a login
   * code can never be replayed to hijack a phone-change and vice versa. */
  async requestPhoneChange(userId: string, rawNewPhone: string) {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new UnauthorizedException();
    const newPhone = normalizePhone(rawNewPhone);
    if (newPhone === current.phone) throw new BadRequestException("That's already your number");

    const taken = await this.prisma.user.findUnique({ where: { phone: newPhone } });
    if (taken) throw new BadRequestException('That number is already registered to another account');

    const rlKey = `phone-change-rl:${userId}`;
    const sent = await this.redis.incr(rlKey);
    if (sent === 1) await this.redis.expire(rlKey, 3600);
    if (sent > MAX_OTPS_PER_HOUR) throw new BadRequestException('Too many attempts — try again later');

    const requestId = randomBytes(16).toString('hex');
    const code = String(randomInt(1000, 10000));
    await this.redis.set(
      `phone-change-otp:${requestId}`,
      JSON.stringify({ userId, newPhone, code, attempts: 0 }),
      'EX',
      OTP_TTL_S,
    );
    try {
      await this.wa.sendPhoneChangeOtp(newPhone, code);
    } catch {
      await this.redis.del(`phone-change-otp:${requestId}`);
      throw new BadRequestException("Couldn't send your code right now — please try again shortly");
    }
    return this.wa.live ? { requestId } : { requestId, devCode: code };
  }

  /** Step 2 — verifies the code sent to the new number, then flips
   * User.phone. Notifies the OLD email on file (if any) as a security
   * measure, same reasoning as any "your password changed" email: if the
   * change wasn't really them, the notice goes somewhere the attacker
   * (who only has the new phone) doesn't control. */
  async confirmPhoneChange(userId: string, requestId: string, code: string) {
    const key = `phone-change-otp:${requestId}`;
    const raw = await this.redis.get(key);
    if (!raw) throw new UnauthorizedException('Code expired — request a new one');
    const rec = JSON.parse(raw) as { userId: string; newPhone: string; code: string; attempts: number };
    if (rec.userId !== userId) throw new UnauthorizedException('This code was not requested by you');

    if (rec.attempts >= MAX_VERIFY_ATTEMPTS) {
      await this.redis.del(key);
      throw new UnauthorizedException('Too many attempts — request a new code');
    }
    if (rec.code !== code) {
      rec.attempts += 1;
      const ttl = await this.redis.ttl(key);
      await this.redis.set(key, JSON.stringify(rec), 'EX', Math.max(ttl, 1));
      throw new UnauthorizedException('Incorrect code');
    }
    await this.redis.del(key);

    const before = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!before) throw new UnauthorizedException();
    let user: User;
    try {
      user = await this.prisma.user.update({ where: { id: userId }, data: { phone: rec.newPhone } });
    } catch {
      throw new BadRequestException('That number was just taken by someone else — try again');
    }

    if (before.email) {
      await this.email.sendTemplate(before.email, 'phone_number_changed', { name: user.name, newPhone: user.phone }).catch(() => {});
    }
    return toApiUser(user);
  }

  /** Plain profile fields only. `idVerified` is granted exclusively by the
   * automatic guest KYC check (POST /kyc/guest); `role`/`roleStatus` are
   * granted exclusively by an admin approving a KycSubmission
   * (POST /admin/kyc/:id/approve) — see kyc/kyc.service.ts. Neither can be
   * set here, by design: identity and role trust must not be self-declared.
   * `profilePct` isn't client-writable either, for the same reason — it's
   * recomputed below from whatever actually got saved (mirrors the weighting
   * ProfileCompletion.tsx's live progress bar has always used client-side,
   * just now also the real, persisted number instead of whatever a caller
   * felt like sending). */
  async updateMe(userId: string, patch: Record<string, unknown>) {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new UnauthorizedException();

    const data: Record<string, unknown> = {};
    const allowed = [
      'name', 'username', 'email', 'city', 'state', 'country', 'pincode', 'dob', 'gender', 'profession', 'languages',
      'bio', 'socials', 'socialLinks', 'interests', 'attendanceVisibility', 'autoRenew', 'avatarUrl',
    ];
    for (const k of allowed) if (k in patch) data[k] = patch[k];

    // Every guest now has a username from the moment they sign up (see
    // uniqueUsername in verifyOtp) — it's used for /u/:username, so two
    // people ending up with the same one would make one of them's public
    // profile unreachable/ambiguous. Only check on an actual change, not
    // every save (most saves don't touch username at all).
    if (typeof data.username === 'string' && data.username.trim() && data.username.trim() !== current.username) {
      const taken = await this.prisma.user.findFirst({ where: { username: data.username.trim(), id: { not: userId } } });
      if (taken) throw new BadRequestException('That username is already taken');
    }

    let user = await this.prisma.user.update({ where: { id: userId }, data });

    const filledFields = ['name', 'username', 'email', 'city', 'dob', 'gender', 'profession', 'languages', 'bio']
      .filter((k) => (user[k as keyof typeof user] as string)?.trim()).length
      + (Object.values(user.socialLinks as Record<string, string>).some((v) => v?.trim()) ? 1 : 0);
    const profilePct = Math.min(100, 20 + filledFields * 7 + (user.interests.length ? 8 : 0) + (user.avatarUrl ? 8 : 0));
    if (profilePct !== user.profilePct) {
      user = await this.prisma.user.update({ where: { id: userId }, data: { profilePct } });
    }

    // Guest signup is phone/OTP-first (see requestOtp/verifyOtp above) — a
    // brand-new user has no email at all, so "welcome on signup" has no
    // recipient yet. The real first opportunity is whenever they add an
    // email to their profile for the first time, here.
    if (!current.email && user.email) {
      await this.email.sendTemplate(user.email, 'welcome', { name: user.name }).catch(() => {});
    }

    return toApiUser(user);
  }

  /** Awards a one-time 10%-off-next-booking coupon for finishing the soft-
   * required "complete your profile" step (see FinishProfile.tsx). Re-checks
   * completeness server-side rather than trusting the frontend's own
   * required-field validation — the same "never trust the client for
   * anything that grants real value" instinct as every other reward path in
   * this codebase (referral credit, wallet spend). Idempotent: a user who
   * already claimed just gets their existing code back, never a second one. */
  async claimProfileCompletionReward(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    if (user.profileRewardClaimedAt) {
      const existing = await this.prisma.coupon.findUnique({ where: { code: user.profileRewardCode ?? '' } });
      return { code: user.profileRewardCode, maxDiscount: existing?.maxDiscount ?? 100, validTill: existing?.validTill ?? null, alreadyClaimed: true };
    }

    const missing: string[] = [];
    if (!user.avatarUrl) missing.push('profile photo');
    if (!user.username.trim()) missing.push('username');
    if (!user.city.trim()) missing.push('city');
    if (!user.state?.trim()) missing.push('state');
    if (!user.country?.trim()) missing.push('country');
    if (!user.profession.trim()) missing.push('profession');
    if (!user.languages.trim()) missing.push('languages');
    if (!user.bio.trim()) missing.push('bio');
    if (!Object.values(user.socialLinks as Record<string, string>).some((v) => v?.trim())) missing.push('a social link');
    if (user.interests.length === 0) missing.push('an interest');
    if (missing.length) throw new BadRequestException(`Finish these first: ${missing.join(', ')}`);

    const code = await this.uniqueCouponCode();
    const validTill = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days
    await this.prisma.coupon.create({
      data: {
        code,
        type: 'percent',
        value: 10,
        maxDiscount: 100,
        usageLimit: 1,
        perUserLimit: 1,
        eventScope: 'all',
        validTill,
        firstTimeOnly: false,
        status: 'active',
        organizerId: null, // platform-wide — same as any other admin-issued promo, funded out of the booking fee, not the organizer's payout
      },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { profileRewardClaimedAt: new Date(), profileRewardCode: code } });

    const validTillLabel = validTill.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    await this.wa.send(user.phone, 'profile_reward', [user.name || 'there', code, validTillLabel]).catch(() => {});
    if (user.email) {
      await this.email.sendTemplate(user.email, 'profile_reward', { name: user.name, code, validTill: validTillLabel }).catch(() => {});
    }

    return { code, maxDiscount: 100, validTill, alreadyClaimed: false };
  }

  /** Coupon.code is @unique — same collision-retry shape as every other
   * "pick a free identifier" helper in this codebase (uniqueUsername above,
   * KycService.newOrganizerRow's username/id). */
  private async uniqueCouponCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const suffix = randomBytes(4).toString('hex').toUpperCase();
      const candidate = `PROFILE10-${suffix}`;
      if (!(await this.prisma.coupon.findUnique({ where: { code: candidate } }))) return candidate;
    }
    // Astronomically unlikely to ever reach this, but fall back to a longer,
    // still-unique suffix rather than looping forever.
    return `PROFILE10-${randomBytes(8).toString('hex').toUpperCase()}`;
  }
}
