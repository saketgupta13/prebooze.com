/** GA4 tracking for the guest app — RN equivalent of prebooze-web's
 * lib/gtm.ts. Web pushes into window.dataLayer (read by GTM's web
 * container); there's no DOM/window here, so this uses Firebase Analytics
 * directly instead — Firebase Analytics *is* GA4 for apps (same backend),
 * so once this app's Firebase project is linked to the same GA4 property
 * web already reports into (Admin > Property > Firebase Links), these
 * events land in the exact same GA4 property/reports as web's, same event
 * names/params (GA4's recommended shapes, not custom ones) so they hit
 * GA4's built-in Ecommerce/engagement reports instead of needing a
 * hand-built report configured for them. Every call is best-effort — a
 * tracking failure must never affect the real feature around it. @react-
 * native-firebase/analytics v26 uses the modular (v9-style) API —
 * getAnalytics() once, then every call takes that instance as the first
 * arg, not a default-export singleton. */
import { getAnalytics, logEvent, logScreenView, setUserId } from '@react-native-firebase/analytics';

const ga = () => getAnalytics();

export function trackEvent(name: Parameters<typeof logEvent>[1], params?: Record<string, unknown>): void {
  try {
    logEvent(ga(), name as never, params);
  } catch {
    // best-effort — a tracking failure must never affect the real feature around it
  }
}

/** Same param shape as web's AppContext.tsx loginWithOtp call — fired once
 * per real OTP verify, 'sign_up' only for a genuinely new account so GA4's
 * two different conversion events don't conflate a first-time guest with a
 * returning one. */
export function trackAuth(isNew: boolean): void {
  trackEvent(isNew ? 'sign_up' : 'login', { method: 'whatsapp_otp' });
}

export function trackUserId(userId: string | null): void {
  setUserId(ga(), userId).catch(() => {});
}

/** Same GA4 recommended Ecommerce "purchase" shape as web's Checkout.tsx —
 * transaction_id/value/currency/items[], not a custom event, so it lands
 * in GA4's built-in Ecommerce reports already configured for the web
 * stream instead of needing a second, app-specific report built for it. */
export function trackPurchase(booking: {
  id: string;
  total: number;
  tierId: string;
  tierName: string;
  eventTitle?: string;
  qty: number;
  tierPrice: number;
}): void {
  trackEvent('purchase', {
    transaction_id: booking.id,
    value: booking.total,
    currency: 'INR',
    items: [
      {
        item_id: booking.tierId,
        item_name: booking.eventTitle ? `${booking.eventTitle} — ${booking.tierName}` : booking.tierName,
        price: booking.tierPrice,
        quantity: booking.qty,
      },
    ],
  });
}

/** GA4 expects a screen_view on navigation, same reasoning as web's
 * trackPageView firing page_view on every React Router route change —
 * wired once in RootNavigator's onStateChange, not per screen. */
export function trackScreenView(screenName: string): void {
  logScreenView(ga(), { screen_name: screenName, screen_class: screenName }).catch(() => {});
}
