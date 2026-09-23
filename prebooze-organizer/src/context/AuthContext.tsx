import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import { auth } from '../api/auth';
import { orgTeam } from '../api/organizer';
import { clearToken, loadToken, setToken as persistToken } from '../api/client';
import { registerPushTokenForCurrentDevice, unregisterPushToken } from '../lib/push';
import type { OrgTeamAccess, User } from '../types';

/** Mirrors OrganizerLayout.tsx's owner-vs-team-vs-pending-vs-onboarding
 * gate exactly — this app is organizer-only, so "guest"/other roles just
 * fall through to `not_organizer`. */
export type OrgAccessState =
  | { kind: 'loading' }
  | { kind: 'owner' }
  | { kind: 'team'; access: OrgTeamAccess }
  | { kind: 'pending' }
  | { kind: 'rejected'; reason?: string }
  | { kind: 'not_organizer' };

interface AuthContextValue {
  user: User | null;
  accessState: OrgAccessState;
  bootLoading: boolean;
  requestOtp: (phone: string) => ReturnType<typeof auth.requestOtp>;
  verifyOtp: (requestId: string, code: string, name?: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [teamAccess, setTeamAccess] = useState<OrgTeamAccess | null>(null);
  const [teamAccessLoaded, setTeamAccessLoaded] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  // Tracks this device's currently-registered Expo push token (if any) so
  // logout can unregister the exact row it created, without a second fetch.
  const pushTokenRef = useRef<string | null>(null);

  const loadTeamAccess = useCallback(async () => {
    try {
      const access = await orgTeam.mine();
      setTeamAccess(access);
    } catch {
      setTeamAccess(null);
    } finally {
      setTeamAccessLoaded(true);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await auth.me();
    setUser(me);
    if (!me.isOrganizer) await loadTeamAccess();
  }, [loadTeamAccess]);

  useEffect(() => {
    (async () => {
      // Real bug found live (2026-09-23): a fresh install with no stored
      // token resolved this whole check synchronously — SplashOverlay
      // never got a real frame to paint before RootNavigator swapped
      // straight to the login screen, so the splash appeared to not show
      // at all. A token-holding relaunch already takes real network time
      // via refreshUser() below and doesn't need this, but Promise.all
      // still enforces the floor uniformly rather than special-casing the
      // no-token branch, so it applies no matter which path boot takes.
      const minSplash = new Promise((r) => setTimeout(r, 900));
      const token = await loadToken();
      if (!token) {
        await minSplash;
        setBootLoading(false);
        return;
      }
      try {
        await Promise.all([refreshUser(), minSplash]);
        // A relaunch with permission already granted from a prior session
        // (e.g. after an app update, or the token simply rotating) — best
        // effort, never blocks boot on a failed/slow registration.
        registerPushTokenForCurrentDevice().then((t) => { pushTokenRef.current = t; });
      } catch {
        await clearToken();
        setUser(null);
      } finally {
        setBootLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 30s poll while an application is pending, same as PendingReview.tsx's
  // web behavior — approval should unlock the console without a manual
  // reopen of the app.
  useEffect(() => {
    if (!user || user.isOrganizer) return;
    if (user.pendingRole !== 'organizer' || user.roleStatus !== 'pending') return;
    const id = setInterval(() => {
      auth.me().then(setUser).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [user]);

  const requestOtp = useCallback((phone: string) => auth.requestOtp(phone), []);

  const verifyOtp = useCallback(async (requestId: string, code: string, name?: string) => {
    const res = await auth.verifyOtp(requestId, code, name);
    await persistToken(res.token);
    setUser(res.user);
    if (!res.user.isOrganizer) await loadTeamAccess();
    // Trigger the OS push-permission dialog right after first login, same
    // spot the build prompt calls for — never before the user has a reason
    // to trust the app. Awaited (not fire-and-forget) so the immediately
    // following registration call sees the real just-answered permission
    // status instead of racing the OS dialog.
    await Notifications.requestPermissionsAsync().catch(() => ({}));
    registerPushTokenForCurrentDevice().then((t) => { pushTokenRef.current = t; });
    return res.user;
  }, [loadTeamAccess]);

  const logout = useCallback(async () => {
    // No confirmation dialog on web (Settings.tsx) — match that.
    const pushToken = pushTokenRef.current;
    pushTokenRef.current = null;
    // Must happen *before* clearToken() — apiFetch's Authorization header
    // comes from an in-memory cache that clearToken() wipes synchronously,
    // so unregistering after that point would silently 401 and leave the
    // row behind (a signed-out device would then keep getting this
    // account's pushes until Expo's own dead-token cleanup catches it).
    await unregisterPushToken(pushToken);
    await clearToken();
    setUser(null);
    setTeamAccess(null);
    setTeamAccessLoaded(false);
    auth.logout().catch(() => {});
  }, []);

  const accessState: OrgAccessState = useMemo(() => {
    if (bootLoading) return { kind: 'loading' };
    if (!user) return { kind: 'not_organizer' };
    if (user.isOrganizer) return { kind: 'owner' };
    if (teamAccess) return { kind: 'team', access: teamAccess };
    if (!teamAccessLoaded) return { kind: 'loading' };
    if (user.pendingRole === 'organizer' && user.roleStatus === 'pending') return { kind: 'pending' };
    if (user.pendingRole === 'organizer' && user.roleStatus === 'rejected') return { kind: 'rejected', reason: user.roleRejectionReason };
    return { kind: 'not_organizer' };
  }, [bootLoading, user, teamAccess, teamAccessLoaded]);

  const value: AuthContextValue = { user, accessState, bootLoading, requestOtp, verifyOtp, logout, refreshUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
