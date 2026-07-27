/** Loads the real Razorpay Checkout.js widget script once and caches it on
 * `window.Razorpay` — same script Checkout.tsx uses for ticket payments,
 * shared here so Featured purchases (PromoteCard) use the identical real
 * widget instead of duplicating the loader. */
export function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve();
    const existing = document.getElementById('razorpay-checkout-js') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load the payment widget — check your connection')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment widget — check your connection'));
    document.body.appendChild(script);
  });
}

export type RazorpayInstance = { open: () => void; on: (evt: string, cb: (e: unknown) => void) => void };
export function getRazorpay(): new (opts: Record<string, unknown>) => RazorpayInstance {
  return (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => RazorpayInstance }).Razorpay;
}
