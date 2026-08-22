import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { normalizePhone } from '../auth/auth.service';
import { uniqueReferralCodeFor } from '../referrals/referral.constants';
import { leadPhoneKeySet, phoneKey } from './lead-phone-match.util';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  /** "organizers" segment (mirroring prebooze-admin's Customer.segment) means
   * any elevated role, not literally just organizers — the mock's directory
   * lumps every business account together as one non-"guests" bucket.
   * `role` only flips from null on APPROVAL though — a pending or rejected
   * role application must still count as non-guest here, otherwise every
   * organizer/venue applicant sits in the Customers list looking like a
   * regular guest (with a blank name, since they never went through guest
   * profile completion) until someone gets around to reviewing them. */
  async list(segment?: 'guests' | 'organizers') {
    const isGuest = { role: null, roleStatus: null } as const;
    const where = segment === 'guests' ? isGuest : segment === 'organizers' ? { NOT: isGuest } : {};
    let users = await this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });
    // A person can be tracked as a Lead (organizer/venue/promoter/lineup
    // prospect) before ever formally applying — role/roleStatus alone
    // don't catch that, since nothing about "being a sales lead" touches
    // either field. Someone who's a real customer AND a lead is still
    // excluded here deliberately (confirmed with the user 2026-08-11) —
    // Leads and Customers are meant to stay two clean, non-overlapping
    // lists, not "customer, but also shown as a lead."
    if (segment === 'guests' && users.length) {
      const leadPhones = await leadPhoneKeySet(this.prisma);
      if (leadPhones.size) users = users.filter((u) => !leadPhones.has(phoneKey(u.phone)));
    }
    if (!users.length) return [];

    const stats = await this.prisma.booking.groupBy({
      by: ['userId'],
      where: { userId: { in: users.map((u) => u.id) }, status: { not: 'cancelled' } },
      _count: { id: true },
      _sum: { total: true },
    });
    const statsByUser = new Map(stats.map((s) => [s.userId, s]));

    return users.map((u) => {
      const s = statsByUser.get(u.id);
      return {
        id: u.id,
        // Raw, possibly blank — admin needs to tell "never filled in a
        // name" apart from "really is named X"; a 'Guest' fallback here
        // would erase that distinction before it reaches the UI.
        name: u.name,
        phone: u.phone,
        email: u.email || undefined,
        city: u.city,
        gender: u.gender,
        verified: u.idVerified,
        bookings: s?._count.id ?? 0,
        spend: s?._sum.total ?? 0,
        status: u.blocked ? 'blocked' : u.idVerified ? 'active' : 'unverified',
        segment: u.role || u.roleStatus ? 'organizers' : 'guests',
      };
    });
  }

  /** Full profile — admin-only (see AdminCustomersController guard). Every
   * field a guest can fill in, not just the list view's summary row —
   * organizers only ever see the basic name/gender/whatsapp Booking.guests
   * already carries (OrganizerService.attendees), never a real User row. */
  async get(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Customer not found');
    const stats = await this.prisma.booking.aggregate({
      where: { userId: id, status: { not: 'cancelled' } },
      _count: { id: true },
      _sum: { total: true },
    });
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email || undefined,
      city: user.city,
      state: user.state || undefined,
      country: user.country || undefined,
      pincode: user.pincode || undefined,
      dob: user.dob || undefined,
      gender: user.gender || undefined,
      profession: user.profession || undefined,
      languages: user.languages || undefined,
      bio: user.bio || undefined,
      socialLinks: user.socialLinks as Record<string, string>,
      interests: user.interests,
      avatarUrl: user.avatarUrl || undefined,
      phoneVerified: user.phoneVerified,
      idVerified: user.idVerified,
      profilePct: user.profilePct,
      joined: user.createdAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      blocked: user.blocked,
      bookings: stats._count.id,
      spend: stats._sum.total ?? 0,
      status: user.blocked ? 'blocked' : user.idVerified ? 'active' : 'unverified',
      segment: user.role || user.roleStatus ? 'organizers' : 'guests',
    };
  }

  /** Manual onboarding — walk-ups, phone bookings, VIP guests added by
   * staff, no OTP round trip. Marks phoneVerified since staff is vouching
   * for the number directly (mirrors the mock's "becomes their WhatsApp
   * login" framing). If the phone already has an account, that account is
   * returned/updated rather than erroring — a staffer re-adding someone by
   * phone shouldn't create a duplicate. */
  async create(body: { name?: string; phone?: string; email?: string; city?: string; gender?: string; verified?: boolean }) {
    if (!body.name?.trim()) throw new BadRequestException('Customer name is required');
    if (!body.phone?.trim()) throw new BadRequestException('Phone number is required — it becomes their WhatsApp login');
    const phone = normalizePhone(body.phone);

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    const data = {
      name: body.name.trim(),
      email: body.email?.trim() ?? '',
      city: body.city?.trim() ?? '',
      gender: body.gender?.trim() ?? '',
      idVerified: body.verified ?? false,
      phoneVerified: true,
    };
    const user = existing
      ? await this.prisma.user.update({ where: { id: existing.id }, data })
      : await this.prisma.user.create({ data: { phone, referralCode: await uniqueReferralCodeFor(this.prisma, phone), ...data } });
    return user;
  }

  async setBlocked(id: string, blocked: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Customer not found');
    if (typeof blocked !== 'boolean') throw new BadRequestException('blocked must be a boolean');
    await this.prisma.user.update({ where: { id }, data: { blocked } });
    return { ok: true };
  }

  /** Admin "god mode" login-number change — the only self-serve path
   * (ChangePhoneNumber.tsx, POST /me/phone/request-change+confirm) requires
   * being logged in already, which is exactly the wall a genuinely
   * locked-out account (lost access to their old number, or an org/venue
   * changing hands) hits. Same trust level as every other admin directory
   * edit (no OTP round-trip) — staff vouching is the verification, same
   * reasoning as create() above marking phoneVerified on a staff-entered
   * number. Doesn't touch phoneVerified either way; whatever it was stays. */
  async updatePhone(id: string, rawPhone: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Customer not found');
    const phone = normalizePhone(rawPhone);
    if (phone === user.phone) return user;
    const taken = await this.prisma.user.findUnique({ where: { phone } });
    if (taken) throw new BadRequestException('That number is already registered to another account');
    return this.prisma.user.update({ where: { id }, data: { phone } });
  }

  /** Support-ticket edit of a guest's own profile fields — the same set
   * self-serve EditProfile.tsx exposes, staff correcting it on the
   * customer's behalf (a typo'd name, wrong city, missing DOB the guest
   * asked support to add). Deliberately not the login number (updatePhone
   * above, separate action) or role/verification flags (their own
   * dedicated endpoints). */
  async update(id: string, patch: {
    name?: string; email?: string; city?: string; state?: string; country?: string; pincode?: string;
    dob?: string; gender?: string; profession?: string; languages?: string; bio?: string;
  }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Customer not found');
    return this.prisma.user.update({
      where: { id },
      data: {
        name: patch.name?.trim(),
        email: patch.email?.trim(),
        city: patch.city?.trim(),
        state: patch.state?.trim(),
        country: patch.country?.trim(),
        pincode: patch.pincode?.trim(),
        dob: patch.dob?.trim(),
        gender: patch.gender,
        profession: patch.profession?.trim(),
        languages: patch.languages?.trim(),
        bio: patch.bio?.trim(),
      },
    });
  }

  /** Real hard delete — deliberately narrow, unlike every other directory
   * entity on this platform (no admin delete exists for organizers/venues/
   * etc. at all — see DirectoryService's own doc comment). A User row is
   * referenced by 15+ tables (bookings, wallet, referrals, funnel events,
   * every role's own directory row...); deleting one with any real history
   * would either violate a foreign key or silently orphan/cascade real
   * business records. Only safe for what this is actually meant to clean
   * up — a duplicate/test/spam signup with zero real activity. Anyone with
   * a booking or an elevated role gets a clear rejection pointing at
   * setBlocked instead, which already covers "stop this account from
   * doing anything" without destroying data. */
  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Customer not found');
    if (user.role || user.roleStatus) {
      throw new BadRequestException('This account has an organizer/venue/promoter/lineup role — remove that role first, or use Block instead');
    }
    const bookingCount = await this.prisma.booking.count({ where: { userId: id } });
    if (bookingCount > 0) {
      throw new BadRequestException(`This customer has ${bookingCount} real booking(s) on file — can't delete an account with booking history, use Block instead`);
    }
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch {
      throw new BadRequestException('This account still has other real data attached (e.g. wallet activity, a referral) — use Block instead');
    }
    return { ok: true };
  }
}
