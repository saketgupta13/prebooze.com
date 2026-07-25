import { useEffect, useState } from 'react';
import { promoter } from '../../api';
import SubscriptionPlans from '../../components/SubscriptionPlans';

export default function PromoterSubscription() {
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);

  useEffect(() => {
    promoter.usage().then(setUsage).catch(() => {});
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Subscription</h1>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Your plan sets how many guests you can add to lists each month. Upgrade any time — changes apply once payment
        is confirmed.
      </p>
      <SubscriptionPlans api={promoter.subscription} usage={usage} />
    </div>
  );
}
