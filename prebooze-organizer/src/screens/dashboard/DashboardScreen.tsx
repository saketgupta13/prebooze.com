import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, Bell } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { notifications } from '../../api/notifications';
import { ApiError } from '../../api/client';
import { Bar, Card, Chip, H1, H2, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { isEventOver } from '../../lib/events';
import type { Event, OrgAttendee, OrgLedgerTx, Organizer } from '../../types';
import type { DashboardStackParamList, MainTabParamList } from '../../navigation/types';

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<DashboardStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>;

const fmtMoney = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const DAY_MS = 86400000;

/** Faithful port of prebooze-web/src/pages/organizer/Dashboard.tsx. Same
 * data sources (organizer.me/events/payouts + per-live-event attendees()),
 * same derived numbers — "Bookings" not "tickets" for the 30-day/trend
 * counts, same reasoning as web: the ledger records one `sale` entry per
 * booking, not per ticket. PromoteCard/MarketingPromoCard are web-only
 * (Marketing is out of scope here per the App Store IAP policy exclusion),
 * and the header's "+ Create event" link is omitted until Phase 2's event
 * wizard exists. */
export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const [profile, setProfile] = useState<Organizer | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [ledger, setLedger] = useState<OrgLedgerTx[]>([]);
  const [attendees, setAttendees] = useState<OrgAttendee[]>([]);
  const [liveCheckedInCount, setLiveCheckedInCount] = useState(0);
  const [topCity, setTopCity] = useState('All');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // useFocusEffect (not a mount-only useEffect) so returning to this tab
  // after creating/editing an event elsewhere — the nested-stack navigation
  // means this screen stays mounted, so a mount-only effect would never
  // re-run — picks up the change instead of showing stale KPIs (organizer
  // feedback 2026-09-15: submitting an event from the wizard didn't show up
  // in the events list until a full app restart).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      organizer
        .me()
        .then(async (me) => {
          if (cancelled) return;
          setProfile(me);
          // Real bug (2026-09-23): silently catching a failed payouts() call
          // into an empty ledger made Revenue/Bookings (30d), Total bookings
          // and the "Bookings over time" chart all show 0/empty on a real
          // fetch failure — indistinguishable from a genuinely quiet
          // account. Let it throw into the outer .catch instead, which
          // already shows a real error banner.
          const [evs, pay] = await Promise.all([organizer.events(), organizer.payouts()]);
          if (cancelled) return;
          setEvents(evs);
          setLedger(pay.ledger);
          // Approved AND not yet over — a past event has no business
          // showing as "live"/"upcoming" regardless of its approval status
          // (real bug found live 2026-09-15: past events still showed under
          // Dashboard's "Upcoming events" card; same gap on web, flagged
          // there too).
          const approvedEvents = evs.filter((e) => e.status === 'approved');
          const liveIdSet = new Set(approvedEvents.filter((e) => !isEventOver(e)).map((e) => e.id));
          // Fetch attendees for *all* approved events, not just live ones —
          // "Your customers" is an all-time KPI (sits next to "Total
          // bookings", not under the "Ticket statistics" section's "across
          // your N live events" scope), so it must not go to 0 just because
          // every event has already happened. Only the Ticket-statistics
          // "Checked in" row stays scoped to live events, tracked
          // separately via liveCheckedInCount.
          const perEvent = await Promise.all(
            approvedEvents.map((e) => organizer.attendees(e.id).catch(() => [] as OrgAttendee[]).then((rows) => ({ eventId: e.id, rows }))),
          );
          if (cancelled) return;
          setAttendees(perEvent.flatMap((p) => p.rows));
          setLiveCheckedInCount(
            perEvent.filter((p) => liveIdSet.has(p.eventId)).reduce((a, p) => a + p.rows.filter((r) => r.checkedIn).length, 0),
          );
        })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load dashboard'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  // Separate from the main load above so a refocus after reading
  // notifications (e.g. coming back from the Notifications screen) updates
  // just the badge count, not the whole dashboard.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      notifications.unreadCount().then((r) => { if (!cancelled) setUnreadCount(r.count); }).catch(() => {});
      return () => { cancelled = true; };
    }, []),
  );

  const live = events.filter((e) => e.status === 'approved' && !isEventOver(e));
  const liveIds = new Set(live.map((e) => e.id));
  const cities = ['All', ...new Set(live.map((e) => e.venue?.city).filter(Boolean) as string[])];

  const topPool = live
    .map((e) => ({ ...e, soldTotal: e.tiers.reduce((a, t) => a + t.sold, 0), city: e.venue?.city ?? '' }))
    .filter((e) => e.soldTotal > 0 && (topCity === 'All' || e.city === topCity))
    .sort((a, b) => b.soldTotal - a.soldTotal)
    .slice(0, 5);
  const maxTop = Math.max(...topPool.map((e) => e.soldTotal), 1);

  const capAll = live.reduce((a, e) => a + e.tiers.reduce((x, t) => x + t.quantity, 0), 0);
  const soldAll = live.reduce((a, e) => a + e.tiers.reduce((x, t) => x + t.sold, 0), 0);
  const checkedIn = liveCheckedInCount;
  const refundedCount = ledger.filter((t) => t.type === 'refund' && (!t.eventId || liveIds.has(t.eventId))).length;
  const uniqueCustomers = new Set(attendees.map((a) => a.whatsapp)).size;

  const cutoff30 = Date.now() - 30 * DAY_MS;
  const recent = ledger.filter((t) => new Date(t.createdAt).getTime() >= cutoff30);
  const bookings30d = recent.filter((t) => t.type === 'sale').length;
  const revenue30d = recent.filter((t) => t.type === 'sale' || t.type === 'refund').reduce((a, t) => a + t.amount, 0);

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const dayStart = Date.now() - (13 - i) * DAY_MS;
    const d = new Date(dayStart);
    d.setHours(0, 0, 0, 0);
    const dayEnd = d.getTime() + DAY_MS;
    return ledger.filter((t) => t.type === 'sale' && new Date(t.createdAt).getTime() >= d.getTime() && new Date(t.createdAt).getTime() < dayEnd).length;
  });
  const maxDay = Math.max(...last14, 1);

  const upcoming = [...live].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 4);

  const statRows: [string, number, string | undefined][] = [
    ['Sold', soldAll, undefined],
    ['Available', Math.max(0, capAll - soldAll), 'rgba(155,225,61,.35)'],
    ['Checked in', checkedIn, '#8ab4f8'],
    ['Refunded', refundedCount, colors.danger],
  ];
  const statMax = Math.max(soldAll, capAll - soldAll, 1);

  if (loading) {
    return (
      <Screen style={styles.center}>
        <Muted>Loading…</Muted>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <H1 style={styles.title}>Dashboard</H1>
          <Pressable onPress={() => navigation.navigate('Notifications')} style={styles.bellButton}>
            <Bell size={20} color={colors.onAccent} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Txt style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Txt>
              </View>
            )}
          </Pressable>
        </View>
        {!!err && (
          <Card style={styles.errCard}>
            <Txt style={{ color: colors.danger }}>{err}</Txt>
          </Card>
        )}

        <View style={styles.kpiGrid}>
          <Kpi label="Bookings (30d)" value={bookings30d.toLocaleString()} />
          <Kpi label="Revenue (30d)" value={fmtMoney(revenue30d)} />
          <Kpi label="Live events" value={String(live.length)} />
        </View>
        <View style={styles.kpiGrid}>
          <Kpi label="Customers" value={uniqueCustomers.toLocaleString()} />
          <Kpi label="Events" value={String(events.length)} />
          <Kpi label="Total bookings" value={ledger.filter((t) => t.type === 'sale').length.toLocaleString()} />
        </View>

        <Card style={styles.section}>
          <View style={styles.sectionHead}>
            <H2>Top selling events</H2>
          </View>
          <View style={styles.chipRow}>
            {cities.map((c) => (
              <Chip key={c} label={c} active={topCity === c} onPress={() => setTopCity(c)} />
            ))}
          </View>
          {topPool.length ? (
            topPool.map((e) => (
              <View key={e.id} style={styles.topRow}>
                <View style={styles.topRowHead}>
                  <Txt style={[styles.bold, styles.topRowTitle]} numberOfLines={1}>{e.title}</Txt>
                  <Muted style={[fontStyleSmall, styles.topRowSold]} numberOfLines={1}>{e.soldTotal.toLocaleString()} sold · {e.city}</Muted>
                </View>
                <Bar pct={(e.soldTotal / maxTop) * 100} />
              </View>
            ))
          ) : (
            <Muted style={fontStyleSmall}>No sales in {topCity} yet.</Muted>
          )}
        </Card>

        <Card style={styles.section}>
          <H2 style={styles.sectionTitleTight}>Ticket statistics</H2>
          <Muted style={styles.statSub}>across your {live.length} live events · capacity {capAll.toLocaleString()}</Muted>
          {statRows.map(([label, v, color]) => (
            <View key={label} style={styles.statRow}>
              <View style={styles.statRowHead}>
                <Txt style={fontStyleSmall}>{label}</Txt>
                <Txt style={[fontStyleSmall, styles.bold]}>{v.toLocaleString()}</Txt>
              </View>
              <Bar pct={(v / statMax) * 100} color={color} />
            </View>
          ))}
          <Muted style={styles.statFooter}>
            sell-through {capAll ? Math.round((soldAll / capAll) * 100) : 0}%
            {soldAll ? ` · check-in rate ${Math.round((checkedIn / soldAll) * 100)}%` : ''}
          </Muted>
        </Card>

        <Card style={styles.section}>
          <H2 style={styles.sectionTitleTight}>Bookings over time</H2>
          <Muted style={styles.statFooter}>last 14 days</Muted>
          <View style={styles.chart}>
            {last14.map((v, i) => (
              <View key={i} style={[styles.chartCol, { height: `${(v / maxDay) * 100}%` }]} />
            ))}
          </View>
        </Card>

        <Card style={[styles.section, { marginBottom: spacing.xxl }]}>
          <H2 style={styles.sectionTitle}>Upcoming events</H2>
          {upcoming.length === 0 && <Muted style={fontStyleSmall}>No live events yet.</Muted>}
          {upcoming.map((e) => {
            const sold = e.tiers.reduce((a, t) => a + t.sold, 0);
            const cap = e.tiers.reduce((a, t) => a + t.quantity, 0);
            return (
              <View key={e.id} style={styles.evRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={[fontStyleSmall, styles.bold]} numberOfLines={1}>
                    {e.title} <Muted style={fontStyleSmall}>· {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Muted>
                  </Txt>
                  <View style={styles.evRowBarLine}>
                    <Bar pct={cap ? (sold / cap) * 100 : 0} />
                    <Muted style={styles.tiny}>{sold.toLocaleString()} / {cap.toLocaleString()} sold</Muted>
                  </View>
                </View>
                <Chip
                  label="Attendees"
                  onPress={() => navigation.navigate('Bookings', { eventId: e.id })}
                />
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.kpi}>
      <Muted style={styles.kpiLabel}>{label}</Muted>
      <Txt style={styles.kpiValue}>{value}</Txt>
    </Card>
  );
}

const fontStyleSmall = { fontSize: fontSize.s };

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.l },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.l, marginTop: spacing.s },
  title: {},
  bellButton: { padding: spacing.xs, backgroundColor: colors.accent, borderRadius: 999 },
  // Sits mostly OUTSIDE the green circle, just clipping its corner — the
  // previous top:2/right:2 placed it almost fully inside the icon's own
  // small padding box, covering most of the bell glyph (organizer feedback
  // 2026-09-17). Negative offsets push it out to a normal badge position.
  bellBadge: { position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: colors.bg },
  bellBadgeText: { fontSize: 9, color: '#fff', fontFamily: fontFamily.bold },
  errCard: { borderColor: colors.danger, marginBottom: spacing.m },
  kpiGrid: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.s },
  kpi: { flex: 1, padding: spacing.m },
  kpiLabel: { fontSize: 11.5, fontFamily: fontFamily.medium },
  kpiValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xxl, marginTop: 2 },
  section: { marginTop: spacing.l, padding: spacing.l },
  sectionHead: { marginBottom: spacing.s },
  sectionTitle: { marginBottom: spacing.s },
  sectionTitleTight: { marginBottom: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginBottom: spacing.m },
  topRow: { marginBottom: spacing.s },
  // Neither child had flex/shrink before, so a long title + a long "X sold
  // · City" together could overflow the card's right edge instead of
  // wrapping or truncating — title now flexes and truncates, the sold/city
  // text stays fixed-width and truncates too as a last resort.
  topRowHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, gap: spacing.s },
  topRowTitle: { flexShrink: 1 },
  topRowSold: { flexShrink: 0, maxWidth: '45%' },
  bold: { fontFamily: fontFamily.bold },
  statSub: { fontSize: 11.5, marginBottom: spacing.s },
  statRow: { marginBottom: spacing.s },
  statRowHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  statFooter: { fontSize: 11.5, marginTop: spacing.xs },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 110, marginTop: spacing.s },
  chartCol: { flex: 1, backgroundColor: 'rgba(155,225,61,0.35)', borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 2 },
  evRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: spacing.m, borderBottomWidth: 1, borderBottomColor: colors.borderDash, borderStyle: 'dashed' },
  evRowBarLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: 6 },
  tiny: { fontSize: 11 },
});
