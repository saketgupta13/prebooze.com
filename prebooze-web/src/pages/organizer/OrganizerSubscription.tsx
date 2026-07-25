import { organizer } from '../../api';
import SubscriptionPlans from '../../components/SubscriptionPlans';

export default function OrganizerSubscription() {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Subscription</h1>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Upgrade your organizer plan any time — changes apply once payment is confirmed.
      </p>
      <SubscriptionPlans api={organizer.subscription} />
    </div>
  );
}
