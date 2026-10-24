import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { ArrowLeft, Gift, Link2, MessageCircle, Ticket, UserPlus } from 'lucide-react-native';
import { referrals, wallet } from '../../api/wallet';
import { absoluteUrl } from '../../lib/urls';
import { Button, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Referral } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Same config web's ReferEarn.tsx uses (data/mock.ts REFERRAL_CONFIG) —
// ₹100 each way, one reward per referred phone, self-referrals blocked.
const REFERRER_REWARD = 100;
const REFEREE_REWARD = 100;

const mask = (phone: string) => phone.slice(0, 7) + '••••' + phone.slice(-2);

const STEPS: { icon: typeof Link2; title: string; desc: string }[] = [
  { icon: Link2, title: 'Share your link', desc: 'Send it to friends on WhatsApp — one tap.' },
  { icon: UserPlus, title: `Friend joins, gets ₹${REFEREE_REWARD}`, desc: 'Their welcome credit lands in their wallet instantly.' },
  { icon: Ticket, title: `They book, you earn ₹${REFERRER_REWARD}`, desc: 'When they pay for their first ticket, your reward hits your wallet.' },
];

/** Mirrors web's ReferEarn.tsx: full link + WhatsApp share + copy, KPIs
 * tied to the real wallet balance, "how it works" explainer, and the full
 * per-referral list with masked phone/status badges. */
export default function ReferEarnScreen() {
  const navigation = useNavigation<Nav>();
  const [data, setData] = useState<{ code: string; referrals: Referral[] } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    referrals.mine().then(setData).catch(() => setData({ code: '', referrals: [] }));
    wallet.balance().then((w) => setBalance(w.balance)).catch(() => setBalance(0));
  }, []);

  const invited = data?.referrals.length ?? 0;
  const qualified = data?.referrals.filter((r) => r.status === 'qualified').length ?? 0;
  const earned = qualified * REFERRER_REWARD;
  const link = data?.code ? absoluteUrl(`/r/${data.code}`) : '';

  const waShare = () => {
    if (!link) return;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`Join me on Prebooze 🎟️ — sign up with my link and get ₹${REFEREE_REWARD} off your first event: ${link}`)}`).catch(() => {});
  };
  const copyLink = async () => {
    const ok = await Clipboard.setStringAsync(link).then(() => true).catch(() => false);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <Txt style={styles.title}>Refer & earn</Txt>
      </View>

      {!data && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />}

      {data && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.iconWrap}>
            <Gift size={28} color={colors.accent} />
          </View>
          <Txt style={styles.h1}>Give ₹{REFEREE_REWARD}, get ₹{REFERRER_REWARD}</Txt>
          <Muted style={styles.sub}>
            Your friend gets ₹{REFEREE_REWARD} wallet credit on signup — you earn ₹{REFERRER_REWARD} when they make their first booking.
          </Muted>

          <View style={styles.linkBox}>
            <Txt style={styles.linkTxt}>{link || '—'}</Txt>
          </View>

          <View style={styles.shareBtnRow}>
            <Pressable style={styles.waBtn} onPress={waShare}>
              <MessageCircle size={15} color="#fff" />
              <Txt style={styles.waBtnTxt}>Share on WhatsApp</Txt>
            </Pressable>
            <Pressable style={styles.copyBtn} onPress={copyLink}>
              <Link2 size={15} color={colors.text} />
              <Txt style={styles.copyBtnTxt}>{copied ? 'Copied ✓' : 'Copy link'}</Txt>
            </Pressable>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.stat}>
              <Txt style={styles.statVal}>{invited}</Txt>
              <Muted style={styles.statLabel}>Friends joined</Muted>
            </View>
            <View style={styles.stat}>
              <Txt style={[styles.statVal, { color: colors.accent }]}>{qualified}</Txt>
              <Muted style={styles.statLabel}>Booked (qualified)</Muted>
            </View>
            <View style={styles.stat}>
              <Txt style={[styles.statVal, { color: colors.accent }]}>₹{earned}</Txt>
              <Muted style={styles.statLabel}>Credits earned</Muted>
            </View>
            <Pressable style={styles.stat} onPress={() => navigation.navigate('Wallet')}>
              <Txt style={styles.statVal}>₹{balance ?? 0}</Txt>
              <Muted style={styles.statLabel}>Wallet balance</Muted>
              <Txt style={styles.walletLink}>View wallet →</Txt>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Txt style={styles.cardTitle}>How it works</Txt>
            {STEPS.map((s, i) => (
              <View key={s.title} style={styles.stepRow}>
                <View style={styles.stepNum}><Txt style={styles.stepNumTxt}>{i + 1}</Txt></View>
                <View style={{ flex: 1 }}>
                  <View style={styles.stepTitleRow}>
                    <s.icon size={14} color={colors.text} />
                    <Txt style={styles.stepTitle}>{s.title}</Txt>
                  </View>
                  <Muted style={styles.stepDesc}>{s.desc}</Muted>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Txt style={styles.cardTitle}>Your referrals ({invited})</Txt>
            {invited === 0 ? (
              <Muted style={styles.emptyTxt}>Nobody yet — share your link and your friends show up here.</Muted>
            ) : (
              data.referrals.map((r) => (
                <View key={r.refereePhone} style={styles.refRow}>
                  <View style={{ flex: 1 }}>
                    <Txt style={styles.refName}>{r.refereeName || mask(r.refereePhone)}</Txt>
                    <Muted style={styles.refDate}>joined {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Muted>
                  </View>
                  {r.status === 'qualified' ? (
                    <View style={styles.badgeOk}><Txt style={styles.badgeOkTxt}>Booked ✓ · +₹{REFERRER_REWARD}</Txt></View>
                  ) : (
                    <View style={styles.badgePending}><Txt style={styles.badgePendingTxt}>Joined · waiting</Txt></View>
                  )}
                </View>
              ))
            )}
          </View>

          <Muted style={styles.footnote}>one reward per referred phone · self-referrals blocked · credits are spend-only at checkout</Muted>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingTop: spacing.s, marginBottom: spacing.m },
  title: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  content: { padding: spacing.l, alignItems: 'center', paddingBottom: spacing.xxl },
  iconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(155,225,61,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.l },
  h1: { fontSize: fontSize.xl, fontFamily: fontFamily.extrabold, marginBottom: spacing.s, textAlign: 'center' },
  sub: { textAlign: 'center', marginBottom: spacing.l, paddingHorizontal: spacing.l },
  linkBox: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accent, borderRadius: radius.m, padding: spacing.m, width: '100%', marginBottom: spacing.m },
  linkTxt: { fontSize: fontSize.s, textAlign: 'center' },
  shareBtnRow: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.l, flexWrap: 'wrap', justifyContent: 'center' },
  waBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.whatsapp, borderRadius: radius.m, paddingHorizontal: spacing.m, paddingVertical: spacing.s },
  waBtnTxt: { color: '#fff', fontFamily: fontFamily.bold, fontSize: fontSize.s },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border2, borderRadius: radius.m, paddingHorizontal: spacing.m, paddingVertical: spacing.s },
  copyBtnTxt: { color: colors.text, fontFamily: fontFamily.bold, fontSize: fontSize.s },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginBottom: spacing.l, gap: spacing.s },
  stat: {
    flexBasis: '47%', flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, paddingVertical: spacing.l, paddingHorizontal: spacing.s,
  },
  statLabel: { fontSize: fontSize.xs, textAlign: 'center', marginTop: 4 },
  statVal: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xl },
  walletLink: { color: colors.accent, fontSize: fontSize.xs, fontFamily: fontFamily.bold, marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, padding: spacing.l, width: '100%', marginBottom: spacing.m },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.m, marginBottom: spacing.m },
  stepRow: { flexDirection: 'row', gap: spacing.m, marginBottom: spacing.m },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  stepNumTxt: { color: colors.onAccent, fontFamily: fontFamily.extrabold, fontSize: fontSize.s },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  stepDesc: { fontSize: fontSize.xs, marginTop: 2 },
  emptyTxt: { fontSize: fontSize.s },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: spacing.s, borderTopWidth: 1, borderTopColor: colors.border },
  refName: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  refDate: { fontSize: fontSize.xs },
  badgeOk: { backgroundColor: 'rgba(155,225,61,0.15)', borderRadius: radius.s, paddingHorizontal: 8, paddingVertical: 4 },
  badgeOkTxt: { color: colors.accent, fontSize: fontSize.xs, fontFamily: fontFamily.bold },
  badgePending: { backgroundColor: colors.surface2, borderRadius: radius.s, paddingHorizontal: 8, paddingVertical: 4 },
  badgePendingTxt: { color: colors.muted, fontSize: fontSize.xs, fontFamily: fontFamily.bold },
  footnote: { fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.s },
});
