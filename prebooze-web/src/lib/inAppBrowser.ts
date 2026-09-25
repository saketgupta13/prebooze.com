/** Detects whether the page is running inside a constrained in-app
 * browser (Google app's own embedded tab, Instagram, Facebook, LinkedIn,
 * WeChat, Line, etc.) rather than a real standalone browser (Chrome,
 * Safari, Firefox...).
 *
 * Real bug this exists for (2026-09-25): a guest opening Prebooze from a
 * link inside the Google app and trying to pay saw PhonePe's checkout
 * with no UPI-app options at all — only card/manual UPI-ID entry. This
 * isn't a bug in our own PhonePe integration (we already do a real
 * full-page redirect, not an iframe) — it's PhonePe's own hosted checkout
 * page detecting it can't reliably resolve Android's UPI app-intent
 * links inside these WebViews (they don't support the same intent/app-
 * link resolution a real browser does), so it hides the broken options
 * rather than show a UPI app that won't actually open. This is a known,
 * widely-reported limitation across every Indian payment gateway
 * (Razorpay/Paytm/PhonePe alike), not something fixable from our side of
 * the integration — the real fix is keeping guests out of these
 * browsers before they ever reach checkout.
 *
 * UA tokens below are the well-known fingerprints for each in-app
 * browser; `; wv` is the generic Android WebView marker every one of
 * them carries in addition to their own specific token. */
export function isInAppBrowser(ua: string = navigator.userAgent): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|LinkedInApp|GSA\/|; ?wv\)/i.test(ua);
}

/** A short, human label for the banner copy — "the Google app" reads much
 * better to a guest than "GSA" or a generic "in-app browser". Falls back
 * to a generic phrase for anything matched only by the generic WebView
 * marker (an in-app browser we don't specifically recognize). */
export function inAppBrowserName(ua: string = navigator.userAgent): string {
  if (/GSA\//i.test(ua)) return 'the Google app';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/LinkedInApp/i.test(ua)) return 'LinkedIn';
  if (/Line\//i.test(ua)) return 'Line';
  if (/MicroMessenger/i.test(ua)) return 'WeChat';
  return 'this app';
}
