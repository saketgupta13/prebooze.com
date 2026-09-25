import { apiFetch } from './client';

/** Minimal slice of prebooze-web's PlatformInfo — only the fields the
 * offline-booking price preview needs (matching Checkout.tsx's real
 * booking-fee/GST math server-side, see prepareOfflineBooking). Public,
 * unauthenticated endpoint (GET /settings), same as web's platform.settings(). */
export interface PlatformFeeInfo {
  bookingFee: number;
  gstPct: number;
}

const FALLBACK: PlatformFeeInfo = { bookingFee: 1.5, gstPct: 0 };

export const platform = {
  feeInfo: () =>
    apiFetch<Partial<PlatformFeeInfo>>('/settings').then((live) => ({
      bookingFee: live.bookingFee ?? FALLBACK.bookingFee,
      gstPct: live.gstPct ?? FALLBACK.gstPct,
    })),
};
