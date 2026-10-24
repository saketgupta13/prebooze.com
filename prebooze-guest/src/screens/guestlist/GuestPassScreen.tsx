import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { guestList } from '../../api/guestlist';
import { cutoffDate, countdownLabel } from '../../lib/promoterPass';
import { Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { PromoterPass } from '../../types';

type Rt = { key: string; name: 'GuestPass'; params: RootStackParamList['GuestPass'] };

export default function GuestPassScreen() {
  const route = useRoute() as Rt;
  const [pass, setPass] = useState<PromoterPass | null>(null);
  const [rotation, setRotation] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    guestList.pass(route.params.passId).then(setPass).catch(() => setPass(null));
  }, [route.params.passId]);

  // Rotates the QR payload every minute (screenshot-proof, same reasoning
  // as web's identical pass screen) and re-renders every second so the
  // countdown stays live.
  useEffect(() => {
    const rotate = setInterval(() => setRotation((r) => r + 1), 60_000);
    const tick = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { clearInterval(rotate); clearInterval(tick); };
  }, []);

  if (!pass) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const cutoff = cutoffDate(pass.event);
  const names = [pass.name, ...(pass.companions?.map((c) => c.name) ?? [])];

  return (
    <Screen>
      <View style={styles.header}>
        <Txt style={styles.badge}>FREE-ENTRY PASS</Txt>
        <Txt style={styles.eventTitle}>{pass.event.title}</Txt>
        <Muted style={styles.eventMeta}>
          {new Date(pass.event.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {pass.event.venue?.name ?? ''}
        </Muted>
      </View>

      <View style={styles.center}>
        <View style={styles.card}>
          <View style={styles.qrBox}>
            <QRCode value={`${pass.id}-${rotation}`} size={170} backgroundColor={colors.text} color={colors.bg} />
          </View>
          <Txt style={styles.guestNames}>{names.length > 1 ? `${names[0]} + ${names.length - 1} more` : names[0]}</Txt>
          {names.length > 1 && <Muted style={styles.namesList}>{names.join(' · ')}</Muted>}
          {cutoff && (
            <View style={styles.closesRow}>
              <View style={styles.dot} />
              <Txt style={styles.closesTxt}>Closes in {countdownLabel(cutoff)}</Txt>
            </View>
          )}
        </View>

        <Muted style={styles.footerHint}>One QR for the whole group · rotates every minute · screenshot-proof{'\n'}Sent to WhatsApp {pass.phone}</Muted>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', paddingTop: spacing.xl, paddingHorizontal: spacing.xl },
  badge: { color: colors.accent, fontSize: fontSize.xs, fontFamily: fontFamily.bold, backgroundColor: 'rgba(155,225,61,0.12)', paddingHorizontal: spacing.m, paddingVertical: 5, borderRadius: radius.s, marginBottom: spacing.s, overflow: 'hidden' },
  eventTitle: { fontSize: fontSize.xl, fontFamily: fontFamily.extrabold, textAlign: 'center', marginBottom: 4 },
  eventMeta: { textAlign: 'center' },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent, borderRadius: radius.l, padding: spacing.xl,
    alignItems: 'center', width: '88%',
  },
  qrBox: { backgroundColor: colors.text, padding: spacing.l, borderRadius: radius.m, marginBottom: spacing.m },
  guestNames: { fontFamily: fontFamily.bold, fontSize: fontSize.l, marginBottom: 4 },
  namesList: { fontSize: fontSize.xs, textAlign: 'center', marginBottom: spacing.m },
  closesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,192,74,0.12)', borderWidth: 1, borderColor: colors.warning, borderRadius: radius.m, paddingHorizontal: spacing.m, paddingVertical: spacing.s, marginTop: spacing.s },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning },
  closesTxt: { color: colors.warning, fontSize: fontSize.xs, fontFamily: fontFamily.bold },
  footerHint: { textAlign: 'center', fontSize: fontSize.xs, marginTop: spacing.l, lineHeight: 18 },
});
