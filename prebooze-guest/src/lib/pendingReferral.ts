/** A referral code tapped from a /r/:code link before the guest has signed
 * up — same SecureStore-as-localStorage pattern as cartTracker.ts. Stored
 * on the referral landing screen, consumed once (and cleared either way)
 * right after a successful OTP verify in AuthContext, same lifecycle as
 * web's pb_pending_ref (AppContext.tsx). */
import * as SecureStore from 'expo-secure-store';

const KEY = 'pb_pending_ref';

export async function setPendingReferral(code: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, code);
  } catch {
    // best-effort — a failed write just means no welcome credit this time
  }
}

export async function takePendingReferral(): Promise<string | null> {
  try {
    const code = await SecureStore.getItemAsync(KEY);
    if (code) await SecureStore.deleteItemAsync(KEY);
    return code;
  } catch {
    return null;
  }
}
