import { lineup } from '../../api';
import SubscriptionPlans from '../../components/SubscriptionPlans';

export default function LineupSubscription() {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Subscription</h1>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Upgrade your line-up plan any time — changes apply once payment is confirmed.
      </p>
      <SubscriptionPlans api={lineup.subscription} />
    </div>
  );
}
