import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Download, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { ApiError, API_URL, getToken } from '../../api/client';
import { downloadAndSharePdf } from '../../lib/exportFile';
import { Badge, Card, H1, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import type { Invoice } from '../../types';
import type { MoreStackParamList } from '../../navigation/types';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtMoney = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** Real invoice history for Featured-event payments — a read-only carve-out
 * from web's OrganizerBilling.tsx, which also has a "Feature this event"
 * purchase widget (PromoteCard) that stays out of RN entirely (App Store
 * IAP policy, same reasoning as Marketing.tsx). This screen only ever
 * shows past invoices + a real PDF download, nothing that spends money. */
export default function BillingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      organizer
        .invoices()
        .then((inv) => { if (!cancelled) setInvoices(inv); })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load invoices'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  const download = async (inv: Invoice) => {
    setDownloadingId(inv.id);
    setErr('');
    try {
      const token = getToken();
      await downloadAndSharePdf(`${API_URL}/organizer/invoices/${inv.id}/pdf`, `${inv.number}.pdf`, token ? `Bearer ${token}` : '');
    } catch {
      setErr('Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Featured & billing</H1>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Muted style={styles.subhead}>Real invoices for every Featured placement you've paid for — download or share the PDF.</Muted>
        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        <Card style={styles.listCard}>
          {loading && <Muted style={styles.centerNote}>Loading…</Muted>}
          {!loading && invoices.length === 0 && <Muted style={styles.centerNote}>No invoices yet — they show up here once you feature your brand from the web console.</Muted>}
          {invoices.map((inv, i) => (
            <View key={inv.id} style={[styles.row, i < invoices.length - 1 && styles.rowBorder]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={styles.bold} numberOfLines={1}>{inv.number} · {fmtMoney(inv.total)}</Txt>
                <Muted style={styles.tiny} numberOfLines={1}>{inv.description} · {fmtDate(inv.issuedAt)}</Muted>
              </View>
              <Badge label={inv.status === 'issued' ? 'Issued' : 'Void'} tone={inv.status === 'issued' ? 'success' : undefined} />
              <IconButton onPress={() => download(inv)} disabled={downloadingId === inv.id} style={styles.downloadBtn}>
                {downloadingId === inv.id ? <ActivityIndicator size="small" color={colors.text} /> : <Download size={14} color={colors.text} />}
              </IconButton>
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
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl },
  subhead: { fontSize: fontSize.s, marginBottom: spacing.m },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  listCard: { padding: spacing.m },
  centerNote: { textAlign: 'center', padding: spacing.l },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: spacing.m },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  bold: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  tiny: { fontSize: 11.5, marginTop: 2 },
  downloadBtn: { width: 36, height: 36, paddingHorizontal: 0, alignItems: 'center', justifyContent: 'center' },
});
