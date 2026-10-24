import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookingsApi } from '../../api/bookings';
import { useAuth } from '../../context/AuthContext';
import { fmtDate } from '../../lib/bookingDisplay';
import { cacheBookings, getCachedBookings } from '../../lib/bookingsCache';
import { scheduleEventDayNotification } from '../../lib/eventDayNotification';
import { Chip, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Booking } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const isPast = (b: Booking) => (b.event ? new Date(b.event.date).getTime() + b.event.durationHrs * 3600_000 < Date.now() : false);

const STATUS_SUFFIX: Record<string, { label: string; tone: 'danger' | 'accent' }> = {
  cancelled: { label: 'cancelled', tone: 'danger' },
  refunded: { label: 'refunded', tone: 'accent' },
  refund_requested: { label: 'refund pending', tone: 'accent' },
};

/** My Bookings — mirrors web's MyBookings.tsx (Upcoming/Past tabs, tap a
 * row for the full detail+actions screen) instead of the old single mixed
 * list this screen used to render inline. */
export default function BookingsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const load = useCallback(async () => {
    try {
      const list = await bookingsApi.list();
      setBookings(list);
      cacheBookings(list);
      // Backfill: a booking made before this feature shipped, or on a
      // fresh install/reinstall where AsyncStorage's scheduled-id map was
      // wiped, would otherwise never get its event-day reminder. Already
      // idempotent per booking id — see eventDayNotification.ts.
      list.filter((b) => b.status === 'confirmed' && !isPast(b)).forEach((b) => { scheduleEventDayNotification(b).catch(() => {}); });
    } catch {
      // No signal (common at a basement/warehouse venue door) — fall back
      // to whatever was cached last time this list loaded successfully,
      // rather than leaving the guest with an empty list and no way to
      // reach their own QR ticket.
      setBookings(await getCachedBookings());
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = useMemo(() => (bookings ?? []).filter((b) => (tab === 'past' ? isPast(b) : !isPast(b))), [bookings, tab]);

  return (
    <Screen>
      <View style={styles.header}>
        <Txt style={styles.h1}>My Bookings</Txt>
      </View>

      <View style={styles.tabRow}>
        <Chip label="Upcoming" active={tab === 'upcoming'} onPress={() => setTab('upcoming')} />
        <Chip label="Past" active={tab === 'past'} onPress={() => setTab('past')} />
      </View>

      {!bookings && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />}

      <FlatList
        data={list}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          bookings ? (
            <Muted style={styles.empty}>
              No {tab} bookings yet.{' '}
              <Txt style={styles.browseLink} onPress={() => navigation.navigate('Browse', { city: user?.city })}>Browse events →</Txt>
            </Muted>
          ) : null
        }
        renderItem={({ item: b }) => {
          const suffix = STATUS_SUFFIX[b.status];
          return (
            <Pressable style={styles.row} onPress={() => navigation.navigate('BookingDetail', { bookingId: b.id })}>
              <View style={{ flex: 1 }}>
                <Txt style={styles.rowTitle} numberOfLines={1}>{b.event?.title ?? b.tierName}</Txt>
                <Muted style={styles.rowMeta}>
                  {b.event ? fmtDate(b.event.date) : ''} · {b.qty} tix
                  {!!suffix && <Txt style={[styles.rowSuffix, suffix.tone === 'danger' ? styles.danger : styles.accent]}> · {suffix.label}</Txt>}
                </Muted>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.l, paddingTop: spacing.s, paddingBottom: spacing.m },
  h1: { fontSize: fontSize.xl, fontFamily: fontFamily.extrabold },
  tabRow: { flexDirection: 'row', gap: spacing.s, paddingHorizontal: spacing.l, marginBottom: spacing.m },
  list: { paddingHorizontal: spacing.l, paddingBottom: spacing.xxl },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  browseLink: { color: colors.accent, fontFamily: fontFamily.bold },
  row: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, padding: spacing.m, marginBottom: spacing.s },
  rowTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.m, marginBottom: 4 },
  rowMeta: { fontSize: fontSize.xs },
  rowSuffix: { fontSize: fontSize.xs, fontFamily: fontFamily.medium },
  danger: { color: colors.danger },
  accent: { color: colors.accent },
});
