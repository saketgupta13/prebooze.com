import { useCallback, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, BadgeCheck, Download, Megaphone, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { ApiError } from '../../api/client';
import { Badge, Button, Card, H1, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { fmtDate, fmtMoney } from '../../lib/format';
import type { MoreStackParamList } from '../../navigation/types';
import type { OrgLedgerTx, OrgPromoterPayoutRow, PaymentProfile } from '../../types';

const STATUS_LABEL: Record<OrgPromoterPayoutRow['status'], string> = {
  pending: 'Not paid yet',
  reminder_sent: 'Promoter sent a reminder',
  received: 'Promoter confirmed received ✓',
};

// Real request→received→initiated→processed→complete pipeline (or
// rejected), 2026-09-18 — ports web's WITHDRAWAL_STATUS_LABEL/_CLS.
const WITHDRAWAL_STATUS_LABEL: Record<string, string> = {
  requested: 'Requested', received: 'Received', initiated: 'Initiated', processed: 'Processing', complete: 'Paid', rejected: 'Rejected',
};
const WITHDRAWAL_STATUS_TONE: Record<string, 'default' | 'success' | 'danger' | 'accent'> = {
  requested: 'default', received: 'accent', initiated: 'accent', processed: 'accent', complete: 'success', rejected: 'danger',
};

/** Faithful port of prebooze-web/src/pages/organizer/Payouts.tsx. Balance
 * is always the server-recomputed ledger aggregate — never trust a cached
 * number, always refetch after a withdrawal (see WithdrawScreen). CSV
 * export uses RN's `Share` API (plain-text share sheet) instead of web's
 * Blob/anchor-click download, same pattern BookingsScreen already uses. */
export default function PayoutsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<OrgLedgerTx[]>([]);
  const [defaultProfile, setDefaultProfile] = useState<PaymentProfile | null>(null);
  const [promoterPayouts, setPromoterPayouts] = useState<OrgPromoterPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  // Distinct from `err` (same reasoning as WithdrawScreen): on a failed
  // load, `ledger`/`promoterPayouts` stay at their default empty arrays,
  // which rendered as a real, misleading "No withdrawals yet." right next
  // to the error banner during the 2026-09-23 connection-pool incident —
  // gate the whole content area on this instead.
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    setErr('');
    Promise.all([organizer.payouts(), organizer.paymentProfiles(), organizer.promoterPayouts()])
      .then(([pay, profiles, pp]) => {
        if (cancelled) return;
        setBalance(pay.balance);
        setLedger(pay.ledger);
        setDefaultProfile(profiles.find((p) => p.isDefault) ?? null);
        setPromoterPayouts(pp);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof ApiError ? e.message : 'Failed to load payouts');
        setLoadFailed(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  const payoutRows = ledger.filter((t) => t.type === 'withdrawal' || t.type === 'withdrawal_reversal');
  const lifetimePaidOut = payoutRows.filter((t) => t.type === 'withdrawal' && t.withdrawalStatus === 'complete').reduce((a, t) => a + Math.abs(t.amount), 0);
  const bankLast4 = defaultProfile?.bankAccountNumber.slice(-4) ?? null;

  const exportCsv = () => {
    const csv = [
      'date,type,status,amount',
      ...payoutRows.map((t) => `${t.createdAt},${t.type},${t.type === 'withdrawal' ? (t.withdrawalStatus ?? 'requested') : 'refunded_to_balance'},${t.amount}`),
    ].join('\n');
    Share.share({ message: csv, title: 'payouts.csv' });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Payouts</H1>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        {loading && <Muted style={styles.centerNote}>Loading…</Muted>}

        {!loading && loadFailed && (
          <Card style={styles.section}>
            <View style={styles.errRow}>
              <X size={14} color={colors.danger} />
              <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
            </View>
            <Button label="Retry" variant="ghost" onPress={load} style={{ marginTop: spacing.s }} />
          </Card>
        )}

        {!loading && !loadFailed && (
        <>
        <View style={styles.kpiRow}>
          <Card style={styles.kpiCard}>
            <Muted style={styles.kpiLabel}>Available balance</Muted>
            <Txt style={[styles.kpiValue, { color: colors.accent }]}>{fmtMoney(balance)}</Txt>
            <Button label="Withdraw now" onPress={() => navigation.navigate('Withdraw')} style={{ marginTop: spacing.s }} />
          </Card>
          <Card style={styles.kpiCard}>
            <Muted style={styles.kpiLabel}>Lifetime paid out</Muted>
            <Txt style={styles.kpiValue}>{fmtMoney(lifetimePaidOut)}</Txt>
          </Card>
        </View>

        <Card style={styles.bankStrip}>
          {bankLast4 ? (
            <View style={styles.bankRow}>
              <BadgeCheck size={16} color={colors.accent} />
              <Txt style={styles.bold}>Payout to •••• {bankLast4}</Txt>
            </View>
          ) : (
            <Txt style={styles.bold}>No bank on file</Txt>
          )}
          <Muted style={styles.tiny}>processed by our team after each withdrawal request</Muted>
        </Card>

        {promoterPayouts.length > 0 && (
          <Card style={styles.section}>
            <View style={styles.sectionHead}>
              <Txt style={styles.bold}>What you owe promoters</Txt>
              <Txt style={styles.link} onPress={() => navigation.navigate('Promoters')}>Promoter profiles →</Txt>
            </View>
            <Muted style={styles.tiny}>
              Per-head payouts and revenue-share you set per event, per promoter. This is settled directly between you and each
              promoter — Prebooze doesn't move this money — the status is whatever the promoter has confirmed.
            </Muted>
            {promoterPayouts.map((p, i) => (
              <View key={`${p.promoterId}-${p.eventId}`} style={[styles.promoterRow, i < promoterPayouts.length - 1 && styles.rowBorder]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={styles.bold} numberOfLines={1}>{p.promoterName}</Txt>
                  <Muted style={styles.tiny} numberOfLines={1}>{p.eventTitle} · {fmtDate(p.eventDate)}</Muted>
                  <Muted style={styles.tiny}>
                    {[p.perHead > 0 ? `Guest list ${fmtMoney(p.perHead)}` : null, p.commission > 0 ? `Revenue share ${fmtMoney(p.commission)}` : null].filter(Boolean).join(' · ')}
                  </Muted>
                </View>
                <View style={styles.owedCol}>
                  <Txt style={styles.bold}>{fmtMoney(p.total)}</Txt>
                  <Muted style={[styles.tiny, p.status === 'received' && { color: colors.accent }]}>{STATUS_LABEL[p.status]}</Muted>
                </View>
              </View>
            ))}
          </Card>
        )}

        <View style={styles.sectionHead}>
          <Txt style={[styles.bold, styles.sectionTitle]}>Payout history</Txt>
          <Txt style={styles.link} onPress={exportCsv}><Download size={12} color={colors.accent} /> CSV</Txt>
        </View>
        <Card style={styles.section}>
          {!loading && payoutRows.length === 0 && <Muted style={styles.centerNote}>No withdrawals yet.</Muted>}
          {payoutRows.map((t, i) => (
            <View key={t.id} style={[styles.historyRow, i < payoutRows.length - 1 && styles.rowBorder]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Muted style={styles.tiny}>{fmtDate(t.createdAt)}</Muted>
                {t.type === 'withdrawal' && t.withdrawalStatus === 'complete' && !!t.withdrawalPaidUtr && (
                  <Muted style={styles.tiny} numberOfLines={1}>{t.withdrawalPaidUtr}</Muted>
                )}
                {t.type === 'withdrawal' && t.withdrawalStatus === 'rejected' && !!t.withdrawalRejectedReason && (
                  <Txt style={[styles.tiny, { color: colors.danger }]} numberOfLines={2}>{t.withdrawalRejectedReason}</Txt>
                )}
              </View>
              <Txt style={[styles.tiny, styles.bold, { color: t.type === 'withdrawal_reversal' ? colors.text : colors.danger }]}>
                {t.type === 'withdrawal_reversal' ? '+' : '-'}{fmtMoney(Math.abs(t.amount))}
              </Txt>
              {t.type === 'withdrawal_reversal' ? (
                <Badge label="Refunded to balance" tone="accent" />
              ) : (
                <Badge label={WITHDRAWAL_STATUS_LABEL[t.withdrawalStatus ?? 'requested']} tone={WITHDRAWAL_STATUS_TONE[t.withdrawalStatus ?? 'requested']} />
              )}
            </View>
          ))}
        </Card>
        </>
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
  kpiRow: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.m },
  kpiCard: { flex: 1, padding: spacing.m },
  kpiLabel: { fontSize: 11.5 },
  kpiValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xl, marginTop: 2 },
  bankStrip: { padding: spacing.l, marginBottom: spacing.m },
  bankRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bold: { fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5, marginTop: 2 },
  section: { padding: spacing.l, marginBottom: spacing.m },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s, marginBottom: spacing.s },
  sectionTitle: { fontSize: fontSize.l, marginBottom: 0 },
  link: { color: colors.accent, fontFamily: fontFamily.medium, fontSize: 11.5 },
  promoterRow: { flexDirection: 'row', gap: spacing.s, paddingVertical: spacing.m },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderDash, borderStyle: 'dashed' },
  owedCol: { alignItems: 'flex-end' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: spacing.s },
});
