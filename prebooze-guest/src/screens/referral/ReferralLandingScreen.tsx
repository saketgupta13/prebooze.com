import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Gift, Ticket } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { setPendingReferral } from '../../lib/pendingReferral';
import { Button, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = { key: string; name: 'ReferralLanding'; params: RootStackParamList['ReferralLanding'] };

/** Public /r/:code landing — real bug this closes: the app is a verified
 * Android App Links handler for prebooze.com (see linking.ts), but /r
 * itself was never in the intent filter, so a referral link tapped with
 * the app installed opened a browser instead of the app, defeating the
 * whole point of a native referral loop. Mirrors web's ReferralLanding.tsx:
 * save the code, then either prompt signup (new guest) or just say so
 * (already signed in — rewards are for new accounts only). The code is
 * actually applied (ReferralsService.claim) right after a successful OTP
 * verify in AuthContext, same lifecycle as web's pb_pending_ref. */
export default function ReferralLandingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Rt;
  const { user } = useAuth();
  const code = route.params?.code;

  useEffect(() => {
    if (code) setPendingReferral(code);
  }, [code]);

  return (
    <Screen style={styles.center}>
      <View style={styles.card}>
        <Gift size={40} color={colors.accent} />
        <Txt style={styles.h1}>You've been invited!</Txt>
        <Muted style={styles.sub}>A friend invited you to Prebooze — your city's events, one tap away.</Muted>
        <View style={styles.pitchRow}>
          <Ticket size={14} color={colors.accent} />
          <Txt style={styles.pitch}>Sign up now and get wallet credit for your first booking.</Txt>
        </View>

        {user ? (
          <>
            <View style={styles.dashedBox}>
              <Muted style={styles.dashedTxt}>You're already signed in — referral rewards are for new accounts only.</Muted>
            </View>
            <Button label="Browse events →" onPress={() => navigation.navigate('Main', { screen: 'Home' })} style={styles.btn} />
          </>
        ) : (
          <>
            <Button label="Claim & sign up →" onPress={() => navigation.navigate('Auth', { screen: 'PhoneEntry' })} style={styles.btn} />
            <Muted style={styles.tiny}>WhatsApp OTP login · credit lands in your wallet instantly after signup</Muted>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '100%', maxWidth: 420, alignSelf: 'center', alignItems: 'center', padding: spacing.xl,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l,
  },
  h1: { fontSize: fontSize.xl, fontFamily: fontFamily.extrabold, marginTop: spacing.s, textAlign: 'center' },
  sub: { textAlign: 'center', marginTop: spacing.s },
  pitchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.m, marginBottom: spacing.l },
  pitch: { fontSize: fontSize.s, textAlign: 'center' },
  dashedBox: { borderWidth: 1.5, borderColor: colors.borderDash, borderStyle: 'dashed', borderRadius: radius.m, padding: spacing.m, marginBottom: spacing.l },
  dashedTxt: { fontSize: fontSize.s, textAlign: 'center' },
  btn: { width: '100%' },
  tiny: { fontSize: 11.5, marginTop: spacing.s, textAlign: 'center' },
});
