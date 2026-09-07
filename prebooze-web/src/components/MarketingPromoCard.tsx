import { Link } from 'react-router-dom';
import { Rocket } from 'lucide-react';

/** Dashboard cross-sell for the paid ads product (MarketingService) — same
 * "surface it where people already look every login" reasoning as
 * PromoteCard, just a plain link-out to the Marketing tab rather than its
 * own purchase widget (that lives on Marketing.tsx/VenueMarketing.tsx
 * itself, which already has the full pick-an-event/subscribe flow). `to`
 * differs between the organizer and venue consoles; everything else is
 * identical. */
export default function MarketingPromoCard({ to }: { to: string }) {
  return (
    <div className="card" style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      <div>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Boost your event with ads <Rocket size={18} /></h3>
        <p className="muted small" style={{ marginTop: 4, maxWidth: 440 }}>
          Prebooze runs a dedicated Meta ad campaign for your event, or a rolling 30-day subscription
          covering everything you run — pay us, we handle the ads, you see the results.
        </p>
      </div>
      <Link to={to} className="btn btn-pri">Learn more →</Link>
    </div>
  );
}
