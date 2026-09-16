// Shared across Payouts/Transactions/Coupons/AbandonedCarts/Promoters —
// previously duplicated locally per-screen (Dashboard/Bookings still have
// their own copies, left as-is to avoid an unrelated diff).
export const fmtMoney = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const timeAgo = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
