import { useApp } from '../store/AppContext';
import { fmtDate } from '../data/mock';
import { findFeatured } from '../lib/featured';
import type { Featured } from '../types';

/** "Get featured" purchase panel for organizer / promoter / line-up consoles. */
export default function PromoteCard({
  type, refId, city, label, monthly,
}: {
  type: Extract<Featured['type'], 'organizer' | 'promoter' | 'lineup'>;
  refId: string;
  city: string;
  label: string; // e.g. "your brand", "your PR profile", "your artist profile"
  monthly: number;
}) {
  const { featured, requestFeatured, toast } = useApp();
  const rec = findFeatured(featured, type, refId);

  const buy = () => {
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
    requestFeatured({ type, refId, city, billing: 'monthly', amount: monthly, expiresAt });
    toast(`Payment of ₹${monthly.toLocaleString('en-IN')} received — featured request sent for review ✓`);
  };

  return (
    <div className="card" style={{ marginBottom: 18, borderColor: rec ? 'var(--accent)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3>Get featured ⭐</h3>
          <p className="muted small" style={{ marginTop: 4, maxWidth: 440 }}>
            Feature {label} on the {city} home page and directory — you jump to the front of your slider with a
            Featured badge. Billed monthly.
          </p>
        </div>
        {rec?.status === 'active' ? (
          <span className="badge badge-accent">★ Featured · until {fmtDate(rec.expiresAt)}</span>
        ) : rec?.status === 'pending' ? (
          <span className="badge badge-pending">Featured ◌ pending review</span>
        ) : (
          <button className="btn btn-pri" onClick={buy}>Feature for ₹{monthly.toLocaleString('en-IN')}/mo →</button>
        )}
      </div>
      {rec?.status === 'pending' && (
        <div className="tiny muted-2" style={{ marginTop: 10 }}>
          Paid ✓ — an admin reviews featured placements before they go live (usually within a day).
        </div>
      )}
    </div>
  );
}
