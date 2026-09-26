import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Download, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { ApiError } from '../../api/client';
import { Badge, Card, H1, IconButton, Muted, Screen, Txt } from '../../components/ui';
import SearchableSelect from '../../components/SearchableSelect';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { fmtDate, fmtMoney } from '../../lib/format';
import { shareCsv } from '../../lib/exportFile';
import { goBackOrHome } from '../../lib/navBack';
import type { MoreStackParamList } from '../../navigation/types';
import type { OrgLedgerTx } from '../../types';

/** Faithful port of prebooze-web/src/pages/organizer/Transactions.tsx —
 * same source as Payouts (organizer.payouts().ledger), filtered to
 * sale/refund only; withdrawals live on the Payouts screen instead. */
export default function TransactionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [ledger, setLedger] = useState<OrgLedgerTx[]>([]);
  const [eventFilter, setEventFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      organizer
        .payouts()
        .then((pay) => { if (!cancelled) setLedger(pay.ledger.filter((t) => t.type !== 'withdrawal')); })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load transactions'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  const eventOptions = [...new Map(ledger.filter((t) => t.eventId).map((t) => [t.eventId!, t.eventTitle ?? '—'])).entries()]
    .map(([id, title]) => ({ id, title, count: ledger.filter((t) => t.eventId === id).length }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const filtered = eventFilter ? ledger.filter((t) => t.eventId === eventFilter) : ledger;
  const filterLabel = eventFilter ? eventOptions.find((o) => o.id === eventFilter)?.title ?? '' : '';

  const exportCsv = () => {
    const csv = ['date,type,event,amount', ...filtered.map((t) => `${t.createdAt},${t.type},"${t.eventTitle ?? ''}",${t.amount}`)].join('\n');
    shareCsv('transactions.csv', csv);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => goBackOrHome(navigation, 'More', 'MoreHome')}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Transactions</H1>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        <Muted style={styles.subhead}>Every sale and refund that builds your balance. Withdrawals are on the Payouts page.</Muted>

        {eventOptions.length > 0 && (
          <View style={styles.filterWrap}>
            <SearchableSelect
              value={eventFilter ? `${filterLabel} (${eventOptions.find((o) => o.id === eventFilter)?.count ?? 0})` : `All events (${ledger.length})`}
              onChange={(label) => {
                if (label.startsWith('All events')) return setEventFilter('');
                // Options are rendered as "Title (N)" for the count — strip the
                // trailing " (N)" before matching, since matching the raw label
                // against the bare title (the real bug found live 2026-09-15)
                // never matched anything and silently made the filter a no-op.
                const title = label.replace(/\s\(\d+\)$/, '');
                const o = eventOptions.find((x) => x.title === title);
                setEventFilter(o?.id ?? '');
              }}
              options={[`All events (${ledger.length})`, ...eventOptions.map((o) => `${o.title} (${o.count})`)]}
              placeholder="All events"
            />
          </View>
        )}

        <View style={styles.sectionHead}>
          <Txt style={styles.bold}>{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</Txt>
          <Txt style={styles.link} onPress={exportCsv}><Download size={12} color={colors.accent} /> Export CSV</Txt>
        </View>

        <Card style={styles.listCard}>
          {loading && <Muted style={styles.centerNote}>Loading…</Muted>}
          {!loading && filtered.length === 0 && (
            <Muted style={styles.centerNote}>{eventFilter ? 'No transactions for this event' : 'No transactions yet'}</Muted>
          )}
          {filtered.map((t, i) => (
            <View key={t.id} style={[styles.row, i < filtered.length - 1 && styles.rowBorder]}>
              <Muted style={styles.tiny}>{fmtDate(t.createdAt)}</Muted>
              <Txt style={[styles.tiny, styles.bold, { flex: 1 }]} numberOfLines={1}>{t.eventTitle ?? '—'}</Txt>
              <Txt style={[styles.tiny, styles.bold, { color: t.amount < 0 ? colors.danger : colors.text }]}>
                {t.amount < 0 ? '-' : ''}{fmtMoney(Math.abs(t.amount))}
              </Txt>
              <Badge label={t.type === 'sale' ? 'Sale' : 'Refund'} tone={t.type === 'sale' ? 'success' : 'danger'} />
            </View>
          ))}
        </Card>
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
  subhead: { fontSize: fontSize.s, marginBottom: spacing.m },
  filterWrap: { marginBottom: spacing.m },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s, marginBottom: spacing.s },
  bold: { fontFamily: fontFamily.bold },
  link: { color: colors.accent, fontFamily: fontFamily.medium, fontSize: 11.5 },
  listCard: { padding: spacing.l },
  centerNote: { textAlign: 'center' },
  tiny: { fontSize: 11.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: spacing.s },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderDash, borderStyle: 'dashed' },
});
