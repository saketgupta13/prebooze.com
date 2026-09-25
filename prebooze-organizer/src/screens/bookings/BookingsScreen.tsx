import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type CompositeNavigationProp, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Camera, CheckCircle2, Download, Plus, Search, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { ApiError } from '../../api/client';
import { Badge, Card, Chip, H1, Input, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { isEventOver } from '../../lib/events';
import { shareCsv } from '../../lib/exportFile';
import type { OrgBooking } from '../../types';
import type { MainTabParamList, BookingsStackParamList } from '../../navigation/types';

type Nav = CompositeNavigationProp<NativeStackNavigationProp<BookingsStackParamList>, BottomTabNavigationProp<MainTabParamList>>;

const STATUS_FILTERS = ['All', 'Checked in', 'Confirmed', 'Refund requested', 'Refunded', 'Cancelled'];
const SOURCE_FILTERS = ['All sources', 'Online', 'Offline'];
const fmtMoney = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

type RowStatus = 'checked-in' | OrgBooking['status'];
const rowStatus = (b: OrgBooking): RowStatus => (b.checkedIn ? 'checked-in' : b.status);
/** Faithful port of prebooze-web/src/pages/organizer/Bookings.tsx. Same
 * event-grouped-summary-first UX, same Live/Past split, same drill-down
 * with search + status filter. Status filter/event picker use Chip rows
 * instead of a native <select> (no good mobile-first equivalent). CSV
 * export uses the OS share sheet (RN's built-in Share API) instead of a
 * browser download, since a downloaded file has nowhere obvious to land on
 * a phone — sharing lets the door team send it to WhatsApp/email/Files. */
export default function BookingsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<BookingsStackParamList, 'BookingsList'>>();
  const [bookings, setBookings] = useState<OrgBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [source, setSource] = useState('All sources');
  const [scope, setScope] = useState<'live' | 'past'>('live');
  const eventF = route.params?.eventId;

  // useFocusEffect, not mount-only — refetches when this tab regains focus
  // instead of showing stale data (see EventsScreen/DashboardScreen).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      organizer
        .bookings()
        .then((b) => { if (!cancelled) setBookings(b); })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load bookings'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  const showingSummary = !eventF && !q.trim() && status === 'All';
  const scopedEvent = eventF ? bookings.find((b) => b.event.id === eventF)?.event : undefined;

  const eventsSummary = useMemo(() => {
    const m = new Map<string, { title: string; date: string; durationHrs: number; count: number; qty: number; revenue: number }>();
    for (const b of bookings) {
      const cur = m.get(b.event.id) ?? { title: b.event.title, date: b.event.date, durationHrs: b.event.durationHrs, count: 0, qty: 0, revenue: 0 };
      cur.count += 1;
      cur.qty += b.qty;
      if (b.status === 'confirmed' || b.status === 'refund_requested') cur.revenue += b.total;
      m.set(b.event.id, cur);
    }
    return [...m.entries()]
      .filter(([, v]) => isEventOver(v) === (scope === 'past'))
      .sort((a, b) => (scope === 'live' ? a[1].date.localeCompare(b[1].date) : b[1].date.localeCompare(a[1].date)));
  }, [bookings, scope]);

  const filtered = useMemo(() => {
    let l = eventF ? bookings.filter((b) => b.event.id === eventF) : bookings;
    if (status !== 'All') {
      const want: RowStatus = status === 'Checked in' ? 'checked-in' : status === 'Confirmed' ? 'confirmed' : status === 'Refund requested' ? 'refund_requested' : status === 'Refunded' ? 'refunded' : 'cancelled';
      l = l.filter((b) => rowStatus(b) === want);
    }
    if (source !== 'All sources') {
      const want = source === 'Online' ? 'online' : 'offline';
      l = l.filter((b) => b.bookingSource === want);
    }
    if (q.trim()) {
      const s = q.toLowerCase();
      l = l.filter((b) => (b.mainGuest + b.whatsapp + b.id).toLowerCase().includes(s));
    }
    return l;
  }, [bookings, eventF, status, source, q]);

  const exportCsv = () => {
    const csv = [
      'id,guest,phone,tier,qty,amount,event,status',
      ...filtered.map((b) => `${b.id},"${b.mainGuest}",${b.whatsapp},"${b.tierName}",${b.qty},${b.total},"${b.event.title}",${b.bookingSource}${b.offlinePaymentMode ? `:${b.offlinePaymentMode}` : ''},${rowStatus(b)}`),
    ].join('\n');
    shareCsv('bookings.csv', csv);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <H1 style={styles.heading}>Bookings</H1>
        <Txt style={styles.breadcrumb} numberOfLines={1}>
          Events / {eventF ? (scopedEvent?.title ?? 'Bookings') : 'All events'} / Bookings
        </Txt>
        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        <View style={styles.searchWrap}>
          <Search size={14} color={colors.muted} style={styles.searchIcon} />
          <Input placeholder="Search booking # / name / phone" value={q} onChangeText={setQ} style={styles.searchInput} />
        </View>

        {!showingSummary && (
          <View style={styles.chipRow}>
            {STATUS_FILTERS.map((s) => (
              <Chip key={s} label={s} active={status === s} onPress={() => setStatus(s)} />
            ))}
          </View>
        )}
        {!showingSummary && (
          <View style={styles.chipRow}>
            {SOURCE_FILTERS.map((s) => (
              <Chip key={s} label={s} active={source === s} onPress={() => setSource(s)} />
            ))}
          </View>
        )}

        <View style={styles.actionsRow}>
          {eventF && (
            <Pressable style={styles.ghostBtn} onPress={() => navigation.setParams({ eventId: undefined })}>
              <ArrowLeft size={13} color={colors.text} />
              <Txt style={styles.ghostBtnLabel}>All events</Txt>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          {!showingSummary && (
            <Pressable style={styles.ghostBtn} onPress={exportCsv}>
              <Download size={15} color={colors.text} />
              <Txt style={styles.ghostBtnLabel}>Export CSV</Txt>
            </Pressable>
          )}
          <Pressable style={styles.ghostBtn} onPress={() => navigation.navigate('OfflineBooking')}>
            <Plus size={15} color={colors.text} />
            <Txt style={styles.ghostBtnLabel}>Offline booking</Txt>
          </Pressable>
          <Pressable style={styles.priBtn} onPress={() => navigation.navigate('Scan')}>
            <Camera size={15} color={colors.onAccent} />
            <Txt style={styles.priBtnLabel}>Scan QR</Txt>
          </Pressable>
        </View>

        {showingSummary ? (
          <Card style={styles.listCard}>
            <View style={styles.tabs}>
              <Pressable onPress={() => setScope('live')} style={styles.tabBtn}>
                <Txt style={[styles.tabLabel, scope === 'live' && styles.tabLabelOn]}>Live</Txt>
                {scope === 'live' && <View style={styles.tabUnderline} />}
              </Pressable>
              <Pressable onPress={() => setScope('past')} style={styles.tabBtn}>
                <Txt style={[styles.tabLabel, scope === 'past' && styles.tabLabelOn]}>Past</Txt>
                {scope === 'past' && <View style={styles.tabUnderline} />}
              </Pressable>
            </View>
            {loading && <Muted style={styles.centerNote}>Loading…</Muted>}
            {!loading && eventsSummary.map(([id, v]) => (
              <Pressable key={id} style={styles.summaryRow} onPress={() => navigation.setParams({ eventId: id })}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={styles.bold} numberOfLines={1}>{v.title}</Txt>
                  <Muted style={styles.tiny}>{fmtDate(v.date)} · {v.count} · {v.qty} tix</Muted>
                </View>
                <Txt style={[styles.bold, { color: colors.accent }]}>{fmtMoney(v.revenue)}</Txt>
              </Pressable>
            ))}
            {!loading && eventsSummary.length === 0 && <Muted style={styles.centerNote}>No {scope} events with bookings.</Muted>}
          </Card>
        ) : (
          <Card style={styles.listCard}>
            {loading && <Muted style={styles.centerNote}>Loading…</Muted>}
            {!loading && filtered.map((b) => {
              const s = rowStatus(b);
              return (
                <Pressable key={b.id} style={styles.bookingRow} onPress={() => navigation.navigate('BookingDetail', { id: b.id })}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt style={styles.bold} numberOfLines={1}>{b.id}</Txt>
                    <Muted style={styles.tiny}>{b.mainGuest} · {b.whatsapp}</Muted>
                    <Muted style={styles.tiny}>{b.event.title}</Muted>
                    <Txt style={styles.tiny}>{b.qty} · {fmtMoney(b.total)}</Txt>
                    <Muted style={[styles.tiny, b.bookingSource === 'offline' && { color: colors.accent }]}>
                      {b.bookingSource === 'offline' ? (b.offlinePaymentMode === 'self_collected' ? 'Offline · cash' : 'Offline · link') : 'Online'}
                    </Muted>
                  </View>
                  {s === 'checked-in' && <StatusBadge label="Checked in" tone="success" icon />}
                  {s === 'confirmed' && <StatusBadge label="Confirmed" tone="default" />}
                  {s === 'refund_requested' && <StatusBadge label="Refund req." tone="danger" />}
                  {s === 'refunded' && <StatusBadge label="Refunded" tone="danger" />}
                  {s === 'cancelled' && <StatusBadge label="Cancelled" tone="default" />}
                </Pressable>
              );
            })}
            {!loading && filtered.length === 0 && <Muted style={styles.centerNote}>No bookings match.</Muted>}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function StatusBadge({ label, tone, icon }: { label: string; tone: 'success' | 'danger' | 'default'; icon?: boolean }) {
  return (
    <View style={styles.statusBadgeWrap}>
      <Badge label={label} tone={tone === 'default' ? undefined : tone} />
      {icon && <CheckCircle2 size={13} color={colors.success} />}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  // Matches Dashboard's H1 exactly (organizer feedback 2026-09-15: "same
  // top space and font size like dashboard" on every screen).
  heading: { marginBottom: spacing.l, marginTop: spacing.s },
  breadcrumb: { color: colors.muted, fontSize: fontSize.s, marginBottom: spacing.m },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  searchWrap: { position: 'relative', justifyContent: 'center', marginBottom: spacing.s },
  searchIcon: { position: 'absolute', left: spacing.m, zIndex: 1 },
  searchInput: { paddingLeft: 32 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginBottom: spacing.s },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: spacing.l, flexWrap: 'wrap' },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border3, borderRadius: 10, paddingHorizontal: spacing.m, paddingVertical: 8 },
  ghostBtnLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  priBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: spacing.m, paddingVertical: 8 },
  priBtnLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.s, color: colors.onAccent },
  listCard: { padding: spacing.m },
  tabs: { flexDirection: 'row', gap: spacing.s, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.s },
  tabBtn: { paddingHorizontal: spacing.m, paddingVertical: spacing.s },
  tabLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.m, color: colors.muted },
  tabLabelOn: { color: colors.text },
  tabUnderline: { height: 2.5, backgroundColor: colors.accent, marginTop: 6, borderRadius: 2 },
  centerNote: { textAlign: 'center', padding: spacing.l },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: spacing.m, paddingHorizontal: spacing.s, borderBottomWidth: 1, borderBottomColor: colors.border },
  bookingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s, paddingVertical: spacing.m, paddingHorizontal: spacing.s, borderBottomWidth: 1, borderBottomColor: colors.border },
  bold: { fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5, color: colors.muted },
  // Was `marginLeft: -4` on the checkmark icon with no `gap` here — that
  // pulled the icon left into the Badge pill instead of spacing it,
  // overlapping the "Checked in" text (organizer feedback 2026-09-15).
  statusBadgeWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
