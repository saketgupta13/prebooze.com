import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, BadgeCheck, Megaphone, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { ApiError } from '../../api/client';
import { Card, H1, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { fmtMoney } from '../../lib/format';
import type { MoreStackParamList } from '../../navigation/types';
import type { OrgPromoterRosterEntry } from '../../types';

/** Faithful port of prebooze-web/src/pages/organizer/OrganizerPromoters.tsx
 * — everyone allowed to promote at least one of this organizer's events,
 * their profile + full bank details (the organizer is the one who actually
 * wires the money, no split-payment rail exists) + what's owed. Real
 * transfers happen outside Prebooze; per-event status/"mark received"
 * history lives on the Payouts screen instead, same as web. */
export default function PromotersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [rows, setRows] = useState<OrgPromoterRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      organizer
        .promoters()
        .then((rs) => { if (!cancelled) setRows(rs); })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load promoters'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Promoters</H1>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        <Muted style={styles.subhead}>
          Everyone you've allowed to promote your events — their profile, bank details for paying them out, and what you owe.
          Real transfers happen outside Prebooze; for per-event status and settlement history, see Payouts.
        </Muted>

        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        {loading && <Muted style={styles.centerNote}>Loading…</Muted>}
        {!loading && rows.length === 0 && (
          <Card style={styles.emptyCard}>
            <Megaphone size={22} color={colors.muted} />
            <Muted style={[styles.centerNote, { paddingTop: spacing.s }]}>
              No promoters yet. Add some from an event's Promoters step when creating or editing an event.
            </Muted>
          </Card>
        )}

        {rows.map((p) => {
          const isOpen = expanded === p.promoterId;
          const hasBank = !!p.bankAccountNumber;
          return (
            <Card key={p.promoterId} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.nameRow}>
                    <Txt style={styles.bold} numberOfLines={1}>{p.promoterName}</Txt>
                    {p.verified && <BadgeCheck size={14} color={colors.accent} />}
                  </View>
                  <Muted style={styles.tiny}>{p.city}{p.contact ? ` · ${p.contact}` : ''}</Muted>
                  {!!p.bio && <Muted style={[styles.tiny, { marginTop: 2 }]} numberOfLines={2}>{p.bio}</Muted>}
                </View>
                <View style={styles.owedCol}>
                  <Txt style={styles.owed}>{fmtMoney(p.totalOwed)}</Txt>
                  <Muted style={styles.tiny}>
                    {p.eventCount} event{p.eventCount !== 1 ? 's' : ''}
                    {p.pendingEvents > 0 && <Txt style={{ color: colors.danger }}> · {p.pendingEvents} unpaid</Txt>}
                  </Muted>
                </View>
              </View>

              <View style={styles.hr} />

              <View style={styles.bankRow}>
                <Muted style={styles.tiny}>
                  {p.bankLast4 ? `${p.bankName ? p.bankName + ' · ' : ''}•••• ${p.bankLast4}` : 'no bank details on file yet'}
                </Muted>
                {hasBank && (
                  <Pressable onPress={() => setExpanded(isOpen ? null : p.promoterId)}>
                    <Txt style={styles.toggleLink}>{isOpen ? 'Hide' : 'Show full details'}</Txt>
                  </Pressable>
                )}
              </View>

              {isOpen && hasBank && (
                <View style={styles.bankBox}>
                  <BankRow label="Account holder" value={p.accountHolderName ?? '—'} />
                  <BankRow label="Account number" value={p.bankAccountNumber ?? '—'} />
                  <BankRow label="IFSC" value={p.ifsc ?? '—'} />
                  <BankRow label="Bank" value={p.bankName ?? '—'} />
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

function BankRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.bankLine}>
      <Muted style={styles.tiny}>{label}</Muted>
      <Txt style={[styles.bold, styles.tiny]}>{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.l, paddingTop: spacing.l + spacing.s, paddingBottom: spacing.l },
  title: { flex: 1, fontSize: fontSize.display },
  contentScroll: { flex: 1 },
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl },
  subhead: { fontSize: fontSize.s, marginBottom: spacing.m },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  centerNote: { textAlign: 'center' },
  emptyCard: { alignItems: 'center', padding: spacing.xl },
  card: { padding: spacing.l, marginBottom: spacing.m },
  cardHead: { flexDirection: 'row', gap: spacing.m },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bold: { fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5 },
  owedCol: { alignItems: 'flex-end' },
  owed: { fontFamily: fontFamily.extrabold, fontSize: fontSize.l },
  hr: { borderTopWidth: 1, borderTopColor: colors.borderDash, borderStyle: 'dashed', marginVertical: spacing.m },
  bankRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s },
  toggleLink: { color: colors.accent, fontFamily: fontFamily.medium, fontSize: 11.5 },
  bankBox: { marginTop: spacing.m, padding: spacing.m, borderWidth: 1, borderColor: colors.border3, borderStyle: 'dashed', borderRadius: 10, gap: 6 },
  bankLine: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s },
});
