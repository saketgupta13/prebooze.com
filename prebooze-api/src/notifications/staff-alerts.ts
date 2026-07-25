import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from './whatsapp';

/** Settings > Notifications > "WhatsApp alerts" (refund requests, KYC
 * submissions, payout failures) — a platform-wide on/off switch, fanned out
 * to every Staff row that has a phone number set. Uses the same AiSensy
 * campaign-template mechanism as OTP; a "staff_alert" campaign needs to be
 * created/approved on the AiSensy dashboard before sends go live for real
 * (see WhatsappService — same external, non-code blocker documented for OTP). */
@Injectable()
export class StaffAlertsService {
  private readonly log = new Logger('StaffAlerts');

  constructor(
    private prisma: PrismaService,
    private wa: WhatsappService,
  ) {}

  async alert(text: string) {
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
    if (!settings?.whatsappAlerts) return;

    const staff = await this.prisma.staff.findMany({ where: { phone: { not: null } } });
    for (const s of staff) {
      if (!s.phone) continue;
      await this.wa.send(s.phone, 'staff_alert', [text]).catch((err) => {
        this.log.warn(`Staff alert to ${s.name} failed: ${(err as Error).message}`);
      });
    }
  }
}
