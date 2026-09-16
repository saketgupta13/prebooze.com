import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, BadgeCheck, Lock, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { ApiError } from '../../api/client';
import { Button, Card, Chip, H1, IconButton, Input, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { fmtMoney } from '../../lib/format';
import type { MoreStackParamList } from '../../navigation/types';

/** Faithful port of prebooze-web/src/pages/organizer/Withdraw.tsx — server
 * always recomputes both the payment-profile gate and the real balance
 * before accepting a withdrawal, so the client-side `valid` check here is
 * just UX, never trusted as the source of truth. */
export default function WithdrawScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [balance, setBalance] = useState(0);
  const [bankLast4, setBankLast4] = useState<string | null>(null);
  const [hasDefaultProfile, setHasDefaultProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([organizer.payouts(), organizer.paymentProfiles()])
        .then(([pay, profiles]) => {
          if (cancelled) return;
          setBalance(pay.balance);
          setAmount(String(pay.balance));
          const def = profiles.find((p) => p.isDefault);
          setHasDefaultProfile(!!def);
          setBankLast4(def ? def.bankAccountNumber.slice(-4) : null);
        })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  const amt = +amount || 0;
  const valid = amt > 0 && amt <= balance;

  const submit = async () => {
    setSubmitting(true);
    setErr('');
    try {
      await organizer.withdraw(amt);
      navigation.goBack();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to submit withdrawal');
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Withdraw</H1>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        {loading && <Muted style={styles.centerNote}>Loading…</Muted>}
        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        {!loading && (
          <Card style={styles.card}>
            <Muted style={styles.kpiLabel}>Available balance</Muted>
            <Txt style={[styles.balance, { color: colors.accent }]}>{fmtMoney(balance)}</Txt>

            {!hasDefaultProfile ? (
              <>
                <Muted style={{ marginTop: spacing.m }}>
                  Add a payment profile before withdrawing — tell us where the money should go.
                </Muted>
                <Button label="Add a payment profile →" variant="ghost" onPress={() => {}} style={{ marginTop: spacing.m }} disabled />
                <Muted style={styles.tiny}>Payment profiles land in Settings (Phase 4) — not available in this app build yet.</Muted>
              </>
            ) : (
              <>
                <View style={styles.bankRow}>
                  <BadgeCheck size={14} color={colors.accent} />
                  <Muted>Payout account: •••• {bankLast4}</Muted>
                </View>

                <Txt style={styles.fieldLabel}>Amount</Txt>
                <Input
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  style={styles.fieldGap}
                />
                <View style={styles.chipRow}>
                  <Chip label="25%" onPress={() => setAmount(String(Math.floor(balance * 0.25)))} />
                  <Chip label="50%" onPress={() => setAmount(String(Math.floor(balance * 0.5)))} />
                  <Chip label="All" onPress={() => setAmount(String(balance))} />
                </View>

                {amt > balance && (
                  <View style={styles.errRow}>
                    <X size={14} color={colors.danger} />
                    <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>More than your available balance</Txt>
                  </View>
                )}

                {!confirming ? (
                  <Button label={`Withdraw ${fmtMoney(amt)} →`} disabled={!valid} onPress={() => setConfirming(true)} style={{ marginTop: spacing.m }} />
                ) : (
                  <View style={styles.confirmBlock}>
                    <Txt>
                      Request a withdrawal of <Txt style={styles.bold}>{fmtMoney(amt)}</Txt> to •••• {bankLast4}? Our team processes it from here.
                    </Txt>
                    <View style={styles.confirmActions}>
                      <Button label="Back" variant="ghost" onPress={() => setConfirming(false)} style={styles.flex1} disabled={submitting} />
                      <Button label={submitting ? 'Submitting…' : 'Confirm ✓'} onPress={submit} loading={submitting} style={styles.flex1} />
                    </View>
                  </View>
                )}

                <View style={styles.footerNote}>
                  <Lock size={11} color={colors.muted} />
                  <Muted style={styles.tiny}>payouts settle only to the account on file for your organizer profile</Muted>
                </View>
              </>
            )}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.l, paddingTop: spacing.l + spacing.s, paddingBottom: spacing.l },
  title: { flex: 1, fontSize: fontSize.display },
  contentScroll: { flex: 1 },
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  centerNote: { textAlign: 'center' },
  card: { padding: spacing.l },
  kpiLabel: { fontSize: 11.5 },
  balance: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xxl, marginTop: 2 },
  bankRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.l },
  bold: { fontFamily: fontFamily.bold },
  tiny: { fontSize: 11, marginTop: 4 },
  fieldLabel: { fontSize: fontSize.s, marginBottom: 6, marginTop: spacing.l },
  fieldGap: { marginBottom: 0 },
  chipRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s },
  confirmBlock: { marginTop: spacing.m, padding: spacing.m, backgroundColor: colors.surface2, borderRadius: 10, borderWidth: 1, borderColor: colors.border3 },
  confirmActions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.m },
  flex1: { flex: 1 },
  footerNote: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.l },
});
