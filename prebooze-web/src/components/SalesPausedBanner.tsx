import { Ticket } from 'lucide-react';
import { usePlatformInfo } from '../lib/usePlatformInfo';

/** Settings → Danger zone → "Pause all ticket sales" is a real, backend-
 * enforced kill switch (BookingsService.priceHold rejects every hold/quote/
 * create while it's on) — but until now the guest site had zero awareness
 * of it, so a guest could browse, pick tickets, fill in checkout, and only
 * discover sales were paused when the final payment call failed. This just
 * surfaces it proactively; MaintenanceGate already covers the "whole site
 * down" case, so this stays quiet when that's also on to avoid double
 * messaging. */
export default function SalesPausedBanner() {
  const { salesPaused, maintenanceMode } = usePlatformInfo();
  if (!salesPaused || maintenanceMode) return null;

  return (
    <div
      style={{
        background: 'rgba(255,107,94,.12)',
        borderBottom: '1px solid rgba(255,107,94,.3)',
        color: 'var(--text)',
        textAlign: 'center',
        padding: '8px 16px',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Ticket size={14} /> Ticket sales are temporarily paused platform-wide — browsing works fine, but bookings can't be completed right now. Check back shortly.
    </div>
  );
}
