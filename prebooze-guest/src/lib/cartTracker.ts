/** Device-local "resume checkout" tracking — same purely-client-side
 * reasoning as prebooze-web's AppContext CartRecord (localStorage there,
 * SecureStore here, same small-JSON size either way). There's no backend
 * guest-cart endpoint; organizer/venue "abandoned carts" in admin are a
 * different, unrelated feature built on real Hold rows. This is just a
 * same-device nudge: "you started checking out, want to pick up where you
 * left off" — gone the moment a booking completes or the hold expires. */
import * as SecureStore from 'expo-secure-store';

const KEY = 'pb_resume_cart';

export interface ResumeCart {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  qty: Record<string, number>;
  ticketCount: number;
  tierSummary: string;
  total: number;
  updatedAt: string;
}

export async function captureCart(c: ResumeCart): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(c));
  } catch {
    // best-effort — a failed write just means no resume banner next visit
  }
}

export async function getResumeCart(): Promise<ResumeCart | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as ResumeCart) : null;
  } catch {
    return null;
  }
}

export async function clearResumeCart(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}
