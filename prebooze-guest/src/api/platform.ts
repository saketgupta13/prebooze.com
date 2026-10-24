/** Public platform settings — same contract as prebooze-web/src/api/index.ts's
 * `platform` export, trimmed to the fields the guest app actually reads. */
import { apiFetch } from './client';

export interface PlatformInfo {
  salesPaused: boolean;
  socials: { whatsapp: string };
  feeLabel: string;
  absorbedBy: 'Organizer' | 'Guest' | 'Split' | string;
  bookingFee: number;
  gstPct: number;
}

export const platform = {
  settings: () => apiFetch<PlatformInfo>('/settings'),
};
