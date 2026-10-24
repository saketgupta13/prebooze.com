import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import { auth } from '../api/auth';
import { ApiError, clearToken, loadToken, setToken as persistToken, setUnauthorizedHandler } from '../api/client';
import { registerPushTokenForCurrentDevice, unregisterPushToken } from '../lib/push';
import { takePendingReferral } from '../lib/pendingReferral';
import { referrals } from '../api/wallet';
import { cacheUser, clearCachedUser, getCachedUser } from '../lib/userCache';
import { trackAuth, trackUserId } from '../lib/analytics';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  bootLoading: boolean;
  requestOtp: (phone: string) => ReturnType<typeof auth.requestOtp>;
  verifyOtp: (requestId: string, code: string, name?: string) => Promise<User>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const pushTokenRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      // A fresh install with no stored token resolves this synchronously —
      // without a floor, SplashOverlay never gets a real frame to paint
      // before RootNavigator swaps straight to the login screen. Same fix
      // as prebooze-organizer's AuthContext: enforce a 900ms minimum splash
      // uniformly, whichever branch boot takes.
      const minSplash = new Promise((r) => setTimeout(r, 900));
      const token = await loadToken();
      if (!token) {
        await minSplash;
        setBootLoading(false);
        return;
      }
      try {
        const [me] = await Promise.all([auth.me(), minSplash]);
        setUser(me);
        cacheUser(me);
        trackUserId(me.username || null);
        registerPushTokenForCurrentDevice().then((t) => { pushTokenRef.current = t; });
      } catch (e) {
        // Real bug found live (2026-10-17): this used to clear the token —
        // and therefore log the guest all the way out — on ANY boot
        // failure, including a plain network error with nothing wrong
        // with the session at all. A guest who loses signal at a venue
        // door (the exact moment the offline-cached ticket exists to
        // help) got logged out before ever reaching it. Only a real
        // rejection from the server (401 — session actually invalid/
        // expired) should log the guest out; anything else falls back to
        // the last-known cached profile so the app still opens, offline,
        // with the same session intact.
        if (e instanceof ApiError && e.status === 401) {
          await clearToken();
          await clearCachedUser();
        } else {
          const cached = await getCachedUser();
          if (cached) setUser(cached);
        }
      } finally {
        setBootLoading(false);
      }
    })();
  }, []);

  const requestOtp = useCallback((phone: string) => auth.requestOtp(phone), []);

  const verifyOtp = useCallback(async (requestId: string, code: string, name?: string) => {
    const { token, user: u, isNew } = await auth.verifyOtp(requestId, code, name);
    await persistToken(token);
    setUser(u);
    cacheUser(u);
    trackUserId(u.username || null);
    trackAuth(isNew);
    // Never prompts here if already denied — just asks once per real need,
    // same as the organizer app's identical OTP-verify-time prompt.
    await Notifications.requestPermissionsAsync().catch(() => ({}));
    registerPushTokenForCurrentDevice().then((t) => { pushTokenRef.current = t; });
    // Consumed exactly once, same lifecycle as web's pb_pending_ref — only
    // a brand-new signup is eligible (gated by `isNew`, not just "is there
    // a code waiting"), same as ReferralsService.claim's own self-refer/
    // already-used guards on the backend. A returning guest tapping an old
    // referral link they saved mid-session must never retroactively claim
    // a welcome credit just by logging back in.
    const pendingCode = await takePendingReferral();
    if (isNew && pendingCode) referrals.claim(pendingCode).catch(() => {});
    return u;
  }, []);

  const logout = useCallback(async () => {
    const pushToken = pushTokenRef.current;
    pushTokenRef.current = null;
    // Must happen before clearToken() — apiFetch's Authorization header
    // comes from an in-memory cache clearToken() wipes synchronously, so
    // unregistering after that point would silently 401.
    await unregisterPushToken(pushToken);
    await clearToken();
    await clearCachedUser();
    setUser(null);
    trackUserId(null);
    auth.logout().catch(() => {});
  }, []);

  // Real gap: a token going bad mid-session (expired/revoked JWT, not the
  // boot-time case the effect above already handles) was never reacted to
  // anywhere — every screen just caught its own ApiError and sat on a
  // local "couldn't load" message forever, with no path back to login.
  // apiFetch calls this exactly once per dead-token episode (see
  // client.ts's own doc comment on the dedup flag).
  useEffect(() => {
    setUnauthorizedHandler(() => { logout(); });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  /** Unlike logout() (local-only, fire-and-forget on the backend), the
   * backend call here must succeed before any local state is cleared. */
  const deleteAccount = useCallback(async () => {
    await auth.deleteAccount();
    const pushToken = pushTokenRef.current;
    pushTokenRef.current = null;
    await unregisterPushToken(pushToken);
    await clearToken();
    await clearCachedUser();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await auth.me();
    setUser(me);
    cacheUser(me);
  }, []);

  const value: AuthContextValue = useMemo(
    () => ({ user, bootLoading, requestOtp, verifyOtp, logout, deleteAccount, refreshUser }),
    [user, bootLoading, requestOtp, verifyOtp, logout, deleteAccount, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
