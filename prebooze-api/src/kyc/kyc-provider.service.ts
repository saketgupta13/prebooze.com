import { Injectable, Logger } from '@nestjs/common';

export interface KycCheckResult {
  passed: boolean;
  score: number; // 0-100 confidence
  reason?: string;
}

/** Guest automatic ID+selfie check — provider-agnostic, same pattern as
 * WhatsappService. With no KYC_VENDOR_API_KEY configured we run a dev stub
 * (basic file sanity checks only); a real vendor (AadhaarKYC.io / Sandbox.co.in
 * — see BACKEND.md) plugs in here once one is chosen and contracted.
 *
 * Elevated roles (organizer/promoter/lineup/venue) never call this — those
 * are manual-only by design, reviewed by the team in the admin panel. */
@Injectable()
export class KycProviderService {
  private readonly log = new Logger('KycProvider');

  get live(): boolean {
    return Boolean(process.env.KYC_VENDOR_API_KEY);
  }

  async checkGuest(idDoc: Express.Multer.File, selfie: Express.Multer.File): Promise<KycCheckResult> {
    if (!this.live) {
      // dev stub: sanity-check the uploads look like real files, no vendor call
      const looksReal = (f: Express.Multer.File) => f.size > 1024 && f.mimetype.startsWith('image/');
      const passed = looksReal(idDoc) && looksReal(selfie);
      this.log.log(`[dev] guest KYC check -> ${passed ? 'PASS' : 'FAIL'}`);
      return { passed, score: passed ? 92 : 20, reason: passed ? undefined : 'File too small or not an image' };
    }
    // Real vendor call (OCR + face-match) goes here once KYC_VENDOR_API_KEY is set.
    throw new Error('Live KYC vendor not yet integrated');
  }
}
