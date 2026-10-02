import { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Eye, Users, MousePointerClick, Percent, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { ApiError } from '../../api/client';
import { Badge, Button, Card, H1, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { SITE_ORIGIN } from '../../lib/urls';
import type { MoreStackParamList } from '../../navigation/types';
import type { MarketingOrder } from '../../types';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtMoney = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const STATUS_LABEL: Record<MarketingOrder['status'], string> = {
  pending: 'awaiting campaign setup', active: 'running', rejected: 'declined', expired: 'ended',
};
const STATUS_TONE: Record<MarketingOrder['status'], 'default' | 'success' | 'danger' | 'accent'> = {
  pending: 'accent', active: 'success', rejected: 'danger', expired: 'default',
};

/** Real gap closed 2026-10-02: a faithful read-only port of
 * prebooze-web/src/pages/organizer/Marketing.tsx's "Billing history"
 * section — order status, pending-setup explanation, live non-monetary ad
 * performance (impressions/reach/clicks/CTR, never spend) and the Meta
 * campaign ID once live. Buying ads itself stays web-only (App Store IAP
 * policy, same reasoning as BillingScreen.tsx's own Featured purchase
 * carve-out) — "Run ads" below just deep-links to the real web page. */
export default function MarketingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [orders, setOrders] = useState<MarketingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      organizer
        .marketingOrders()
        .then((o) => { if (!cancelled) setOrders(o); })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load'); })
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
        <H1 style={styles.title}>Marketing</H1>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Muted style={styles.subhead}>
          Prebooze runs a dedicated Meta ad campaign for your event(s). Set up or pay for a new campaign from the web
          console — this is a real-time status view of what's running.
        </Muted>
        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        <Button label="Run ads for an event →" onPress={() => Linking.openURL(`${SITE_ORIGIN}/organizer/marketing`)} style={{ marginBottom: spacing.m }} />

        {loading && <Muted style={styles.centerNote}>Loading…</Muted>}
        {!loading && orders.length === 0 && <Muted style={styles.centerNote}>No marketing payments yet.</Muted>}

        {orders.map((o) => {
          const label = o.isSubscriptionPeriod
            ? `${o.periodStart && o.periodEnd ? Math.round((new Date(o.periodEnd).getTime() - new Date(o.periodStart).getTime()) / 86400000) : 30}-day plan`
            : o.eventTitle;
          return (
            <Card key={o.id} style={styles.orderCard}>
              <View style={styles.orderHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={styles.bold} numberOfLines={1}>{label}</Txt>
                  {o.isSubscriptionPeriod && o.periodStart && <Muted style={styles.tiny}>from {fmtDate(o.periodStart)}</Muted>}
                </View>
                <Badge label={STATUS_LABEL[o.status]} tone={STATUS_TONE[o.status]} />
              </View>
              <Muted style={styles.tiny}>{fmtDate(o.createdAt)}</Muted>

              {o.status === 'rejected' && o.rejectionReason && (
                <Txt style={[styles.tiny, styles.rejectBox]}>{o.rejectionReason}</Txt>
              )}
              {o.status === 'pending' && (
                <Muted style={[styles.tiny, { marginTop: 6 }]}>
                  Payment received — our team is setting up the real Meta ad campaign now. This usually takes a few hours;
                  you'll see it switch to "running" here once it's live.
                </Muted>
              )}
              {o.status === 'active' && o.adPerformance && (
                <View style={styles.adPerfRow}>
                  <View style={styles.adPerfItem}><Eye size={13} color={colors.muted} /><Muted style={styles.tiny}>{o.adPerformance.impressions.toLocaleString('en-IN')} impressions</Muted></View>
                  <View style={styles.adPerfItem}><Users size={13} color={colors.muted} /><Muted style={styles.tiny}>{o.adPerformance.reach.toLocaleString('en-IN')} reach</Muted></View>
                  <View style={styles.adPerfItem}><MousePointerClick size={13} color={colors.muted} /><Muted style={styles.tiny}>{o.adPerformance.clicks.toLocaleString('en-IN')} clicks</Muted></View>
                  <View style={styles.adPerfItem}><Percent size={13} color={colors.muted} /><Muted style={styles.tiny}>{o.adPerformance.ctr}% CTR</Muted></View>
                </View>
              )}
              {o.status === 'active' && o.metaCampaignId && (
                <Muted style={[styles.tiny, { marginTop: 4 }]}>Campaign ID: {o.metaCampaignId}</Muted>
              )}

              <View style={styles.breakupRow}>
                <Muted style={styles.tiny}>
                  {fmtMoney(o.amount)} campaign fee{o.gstAmount > 0 ? ` + ${fmtMoney(o.gstAmount)} GST` : ''} = <Txt style={[styles.tiny, styles.bold]}>{fmtMoney(o.total)}</Txt>
                </Muted>
              </View>
            </Card>
          );
        })}
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
  centerNote: { textAlign: 'center', padding: spacing.l },
  orderCard: { padding: spacing.m, marginBottom: spacing.m, gap: 2 },
  orderHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  bold: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  tiny: { fontSize: 11.5 },
  rejectBox: { marginTop: 8, color: colors.danger, backgroundColor: 'rgba(255,92,73,.08)', borderWidth: 1, borderColor: 'rgba(255,92,73,.2)', borderRadius: 8, padding: 8 },
  adPerfRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m, marginTop: 8 },
  adPerfItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  breakupRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderDash, borderStyle: 'dashed' },
});
