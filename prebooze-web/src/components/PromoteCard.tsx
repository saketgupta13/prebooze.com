import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { fmtDate } from '../data/mock';
import { featured as featuredApi } from '../api';
import { ApiError } from '../api/client';
import type { Featured } from '../types';


/** "Get featured" purchase panel for organizer / promoter / line-up / venue
 * consoles — real Razorpay Subscription (e-mandate), same rails as the
 * paid plan tiers (SubscriptionPlans.tsx): POST /featured/subscribe hands
 * back a hosted `shortUrl`, the owner authorizes it in a new tab, and this
 * polls /featured/mine-subscription until the `subscription.activated`
 * webhook has flipped the real status. Once active it renews automatically
 * every month — no more manual "renew now" click, and no admin re-review
 * on each renewal (see FeaturedService.startPeriod). Rates come from the
 * real, admin-editable GET /featured/rates rather than a stale local
 * constant, since admin can change them at any time. */
export default function PromoteCard({
  type, refId, city, label,
}: {
  type: Extract<Featured['type'], 'organizer' | 'promoter' | 'lineup' | 'venue'>;
  refId: string;
  city: string;
  label: string; // e.g. "your brand", "your PR profile", "your artist profile"
}) {
  const [rec, setRec] = useState<Featured | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = () => {
    Promise.all([featuredApi.mine(type, refId), featuredApi.rates()])
      .then(([m]) => {
        setRec(m);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [type, refId]);


  if (loading) return null;

  return (
    <div className="card" style={{ marginBottom: 18, borderColor: rec?.status === 'active' ? 'var(--accent)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Get featured <Star size={18} /></h3>
          <p className="muted small" style={{ marginTop: 4, maxWidth: 440 }}>
            Feature {label} on the {city} home page and directory — you jump to the front of your slider with a
            Featured badge.
          </p>
        </div>
        {rec?.status === 'active' ? (
          <span className="badge badge-accent">★ Featured · until {fmtDate(rec.expiresAt)}</span>
        ) : rec?.status === 'pending' && rec.paid ? (
          <span className="badge badge-pending">Featured ◌ pending review</span>
        ) : (
          <span className="muted small">One-time purchases available in the Promoter app</span>
        )}
      </div>
      {rec?.status === 'pending' && rec.paid && (
        <div className="tiny muted-2" style={{ marginTop: 10 }}>
          Paid ✓ — an admin reviews featured placements before they go live (usually within a day).
        </div>
      )}
      {err && <div className="tiny danger-text" style={{ marginTop: 10 }}>✕ {err}</div>}
    </div>
  );
}
