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

/** Apple rejection 2026-11-07 (Guideline 3.1.1) on Submission 0be68a74: "The
 * app includes an account registration feature for businesses and
 * organizations" — the OTP screen let a phone number the platform had NEVER
 * seen before create a brand-new account right here, inside a business-tool
 * app, before ever being told to apply on the website. Functionally harmless
 * (the real organizer application/business details only ever lived on web —
 * see NotOrganizerScreen below, which every brand-new account already
 * landed on) but Apple doesn't look at where the harm is: it treats ANY
 * account-creation capability in an app like this as "registration."
 *
 * Fix: PhoneEntryScreen now checks requestOtp's `existingName` — present
 * only for a phone the platform already has a row for, from ANY app
 * (guest/venue/organizer/etc. all share one User table). A truly brand-new
 * number never reaches the OTP screen at all; it lands here instead, and
 * the app never calls verifyOtp (the one call that can create a User row)
 * for it. An already-known phone — whatever its role — still logs in
 * exactly as before; this only closes the one path that was creating new
 * accounts from zero. */
export function NoAccountScreen({ onBack }: { onBack: () => void }) {
  return (
    <StatusShell icon="🎪">
      <H1 style={styles.h1}>No account found</H1>
      <Muted style={styles.body}>
        This app is for logging into an existing organizer account. To apply as a new organizer, set up your account on prebooze.com first — then come back here to log in.
      </Muted>
      <Button label="Set up on prebooze.com" onPress={() => Linking.openURL(ORGANIZER_ONBOARDING_URL)} style={styles.btn} />
      <Button label="Back" variant="ghost" onPress={onBack} style={styles.btn} />
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
