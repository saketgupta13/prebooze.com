import { Image, Linking, StyleSheet, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Button, H1, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';

const ORGANIZER_ONBOARDING_URL = 'https://prebooze.com/organizer/onboarding';

/** Mirrors PendingReview.tsx exactly — same copy, same "unlocks
 * automatically" promise (AuthContext polls /me every 30s while pending). */
export function PendingReviewScreen() {
  const { logout } = useAuth();
  return (
    <StatusShell icon="◌">
      <H1 style={styles.h1}>Application under review</H1>
      <Muted style={styles.body}>
        Your organizer application is being reviewed manually by our team — usually within 24 hours.
        You'll get a WhatsApp message the moment a decision is made.
      </Muted>
      <Muted style={styles.tiny}>The console unlocks automatically once you're approved — no need to check back here.</Muted>
      <Button label="Log out" variant="ghost" onPress={logout} style={styles.btn} />
    </StatusShell>
  );
}

/** Mirrors RejectedReview.tsx — reapply sends them to the real web
 * onboarding flow (not rebuilt natively, per scope). */
export function RejectedReviewScreen({ reason }: { reason?: string }) {
  const { logout } = useAuth();
  return (
    <StatusShell icon="✕">
      <H1 style={styles.h1}>Application not approved</H1>
      <Muted style={styles.body}>
        Your organizer application wasn't approved this time.{reason ? ` Reason: ${reason}` : ''}
      </Muted>
      <Muted style={styles.tiny}>You're welcome to fix the issue and reapply.</Muted>
      <Button label="Reapply on prebooze.com" onPress={() => Linking.openURL(ORGANIZER_ONBOARDING_URL)} style={styles.btn} />
      <Button label="Log out" variant="ghost" onPress={logout} style={styles.btn} />
    </StatusShell>
  );
}

/** This app is organizer-only — a guest/other-role account (or one that's
 * never applied at all) gets sent to the real web onboarding wizard rather
 * than a native copy of it (not in this app's build scope). */
export function NotOrganizerScreen() {
  const { logout } = useAuth();
  return (
    <StatusShell icon="🎪">
      <H1 style={styles.h1}>This app is for organizers</H1>
      <Muted style={styles.body}>
        Set up your organizer account on prebooze.com, then come back here to manage your events, gate, and payouts.
      </Muted>
      <Button label="Set up on prebooze.com" onPress={() => Linking.openURL(ORGANIZER_ONBOARDING_URL)} style={styles.btn} />
      <Button label="Log out" variant="ghost" onPress={logout} style={styles.btn} />
    </StatusShell>
  );
}

function StatusShell({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <Screen style={styles.screen}>
      <View style={styles.visual}>
        <Image source={require('../../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.card}>
        <Txt style={styles.icon}>{icon}</Txt>
        {children}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.xl, justifyContent: 'center' },
  visual: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { height: 56, width: 56 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.xl,
    alignItems: 'center',
  },
  icon: { fontSize: 34, marginBottom: spacing.s },
  h1: { fontSize: fontSize.xxl, textAlign: 'center', marginBottom: spacing.s },
  body: { textAlign: 'center', marginBottom: spacing.s, lineHeight: 20 },
  tiny: { fontSize: fontSize.xs, textAlign: 'center', marginBottom: spacing.xl },
  btn: { width: '100%', marginTop: spacing.s },
});
