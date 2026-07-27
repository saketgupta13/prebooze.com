import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomInt } from 'crypto';
import type Redis from 'ioredis';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { REDIS } from '../redis.provider';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { referralCodeFor } from '../referrals/referral.constants';

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
    dob: u.dob,
    gender: u.gender,
    profession: u.profession,
    languages: u.languages,
    bio: u.bio,
    socials: u.socials,
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
    isPromoter: u.role === 'promoter' || undefined,
    promoterBrand: u.promoterBrand ?? undefined,
    promoterUsername: u.promoterUsername ?? undefined,
    promoterPlan: u.promoterPlan ?? undefined,
    isVenue: u.role === 'venue' || undefined,
    venueName: u.venueName ?? undefined,
    venueId: u.venueId ?? undefined,
    attendanceVisibility: u.attendanceVisibility,
    autoRenew: u.autoRenew,
    // null = never applied for a role; 'pending' | 'approved' | 'rejected' otherwise.
    // Pair with orgBrand/promoterBrand/lineupName/venueName (set immediately on
    // submit) to know *which* role is pending — the elevated role flags above
    // only flip true once an admin approves.
    roleStatus: u.roleStatus ?? undefined,
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
      existing ?? (await this.prisma.user.create({ data: { phone: rec.phone, referralCode: referralCodeFor(rec.phone) } }));

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
   * set here, by design: identity and role trust must not be self-declared. */
  async updateMe(userId: string, patch: Record<string, unknown>) {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new UnauthorizedException();

    const data: Record<string, unknown> = {};
    const allowed = [
      'name', 'username', 'email', 'city', 'dob', 'gender', 'profession', 'languages',
      'bio', 'socials', 'interests', 'attendanceVisibility', 'autoRenew',
    ];
    for (const k of allowed) if (k in patch) data[k] = patch[k];

    const user = await this.prisma.user.update({ where: { id: userId }, data });

    // Guest signup is phone/OTP-first (see requestOtp/verifyOtp above) — a
    // brand-new user has no email at all, so "welcome on signup" has no
    // recipient yet. The real first opportunity is whenever they add an
    // email to their profile for the first time, here.
    if (!current.email && user.email) {
      await this.email.sendTemplate(user.email, 'welcome', { name: user.name }).catch(() => {});
    }

    return toApiUser(user);
  }
}
