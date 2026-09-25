import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { ApiError } from '../../api/client';
import { Card, H1, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import type { MarketingAnalytics } from '../../types';
import type { EventsStackParamList } from '../../navigation/types';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const STAGE_LABEL: Record<string, string> = {
  event_viewed: 'Viewed event', book_clicked: 'Clicked book', otp_requested: 'Requested OTP', otp_verified: 'Verified OTP',
  checkout_viewed: 'Reached checkout', payment_widget_opened: 'Opened payment', payment_submitted: 'Submitted payment', booking_completed: 'Booked',
};

/** Faithful port of prebooze-web/src/pages/organizer/MarketingAnalytics.tsx
 * — read-only funnel/traffic performance for one event, no revenue/
 * commission/ad-spend figures. Deliberately the ONE piece of Marketing
 * ported to RN: unlike campaign purchase (out of scope here — App Store
 * IAP policy, see DashboardScreen.tsx), this has no purchase action, just
 * a report. Unlocks only once the event has a real active/completed
 * MarketingOrder (bought via web — RN never offers that purchase flow) or
 * falls inside an active subscription period, enforced server-side (403
 * otherwise, same "locked" state web shows). */
export default function MarketingAnalyticsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<EventsStackParamList>>();
  const route = useRoute<RouteProp<EventsStackParamList, 'MarketingAnalytics'>>();
  const { eventId, eventTitle } = route.params;
  const [data, setData] = useState<MarketingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    organizer
      .marketingAnalytics(eventId)
      .then(setData)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 403) setLocked(true);
        else setErr(e instanceof ApiError ? e.message : 'Failed to load analytics');
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title} numberOfLines={1}>{eventTitle}</H1>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {loading && <Muted style={styles.centerNote}>Loading…</Muted>}

        {!loading && locked && (
          <Card style={styles.card}>
            <Txt style={styles.sectionTitle}>No active marketing campaign for this event</Txt>
            <Muted style={styles.tiny}>
              Performance analytics unlock once you've paid for a dedicated ad campaign on this event — pay per event, or
              have an active 30-day subscription running while it's on sale. Set up marketing from the web console.
            </Muted>
          </Card>
        )}

        {!loading && !locked && !!err && <Muted style={{ color: colors.danger }}>{err}</Muted>}

        {!loading && !locked && data && (
          <>
            <Card style={styles.card}>
              <Txt style={styles.sectionTitle}>Funnel</Txt>
              {data.stages.map((s, i) => {
                const prev = i > 0 ? data.stages[i - 1].sessions : s.sessions;
                const pct = prev ? Math.round((s.sessions / prev) * 100) : 100;
                return (
                  <View key={s.type} style={styles.row}>
                    <Txt style={styles.tiny}>{STAGE_LABEL[s.type] ?? s.type}</Txt>
                    <Muted style={styles.tiny}>{s.sessions}{i > 0 ? ` (${pct}%)` : ''}</Muted>
                  </View>
                );
              })}
            </Card>

            {data.daily.length > 0 && (
              <Card style={styles.card}>
                <Txt style={styles.sectionTitle}>Daily trend</Txt>
                {data.daily.map((d) => (
                  <View key={d.date} style={styles.row}>
                    <Muted style={styles.tiny}>{fmtDate(d.date)}</Muted>
                    <Txt style={styles.tiny}>{d.viewed} viewed · {d.completed} booked</Txt>
                  </View>
                ))}
              </Card>
            )}

            <RankedList title="Traffic sources" rows={data.trafficSources} />
            <RankedList title="Ad platforms" rows={data.adPlatforms} />
            <RankedList title="Campaigns" rows={data.campaigns} />
            <RankedList title="Devices" rows={data.devices} />
            <RankedList title="Cities" rows={data.geographies} />
            <RankedList title="New vs returning" rows={data.visitorType} />

            {data.paymentFailures.length > 0 && (
              <Card style={styles.card}>
                <Txt style={styles.sectionTitle}>Payment drop-offs</Txt>
                {data.paymentFailures.map((f) => (
                  <View key={f.reason} style={styles.row}>
                    <Muted style={styles.tiny}>{f.reason}</Muted>
                    <Txt style={styles.tiny}>{f.count}</Txt>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function RankedList({ title, rows }: { title: string; rows: { label: string; sessions: number }[] }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.sessions));
  return (
    <Card style={styles.card}>
      <Txt style={styles.sectionTitle}>{title}</Txt>
      {rows.slice(0, 8).map((r) => (
        <View key={r.label} style={styles.barRow}>
          <Txt style={[styles.tiny, { width: 110 }]} numberOfLines={1}>{r.label}</Txt>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(r.sessions / max) * 100}%` }]} />
          </View>
          <Muted style={[styles.tiny, { width: 30, textAlign: 'right' }]}>{r.sessions}</Muted>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.l, paddingTop: spacing.l + spacing.s, paddingBottom: spacing.l },
  title: { flex: 1, fontSize: fontSize.display },
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl, gap: spacing.m },
  centerNote: { textAlign: 'center', padding: spacing.l },
  card: { padding: spacing.m, gap: 6 },
  sectionTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.m, marginBottom: 2 },
  tiny: { fontSize: 12.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surface2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent },
});
