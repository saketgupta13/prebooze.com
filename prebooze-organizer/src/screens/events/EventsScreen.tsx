import { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { ApiError } from '../../api/client';
import { Badge, Button, Card, Muted, Screen, Txt } from '../../components/ui';
import CategoryIcon from '../../components/CategoryIcon';
import Poster from '../../components/Poster';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { eventCity, eventPath, SITE_ORIGIN } from '../../lib/urls';
import { isEventOver } from '../../lib/events';
import type { EventsStackParamList } from '../../navigation/types';
import type { Event, EventStatus } from '../../types';

const TABS: { key: 'all' | EventStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'pending', label: 'Pending' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'draft', label: 'Drafts' },
];

// Real bug (2026-09-17): 'approved' always said "Approved · Live" even for
// events long over — an approved event's actual live/ended state depends
// on whether it's already happened, not just its moderation status, so the
// label is computed per-event now instead of being a static lookup.
const STATUS_BADGE = (e: Event): { label: string; tone: 'success' | 'default' | 'danger' } => {
  switch (e.status) {
    case 'approved':
      return isEventOver(e) ? { label: 'Approved · Ended', tone: 'default' } : { label: 'Approved · Live', tone: 'success' };
    case 'pending':
      return { label: 'Pending review', tone: 'default' };
    case 'rejected':
      return { label: 'Rejected', tone: 'danger' };
    case 'draft':
      return { label: 'Draft', tone: 'default' };
  }
};

const fmtDate = (isoStr: string) => new Date(isoStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** Faithful port of prebooze-web/src/pages/organizer/MyEvents.tsx (GET
 * /organizer/events, same status/upcoming-past filters). "Feature" (the
 * home-page paid placement) is dropped entirely — Marketing/Billing is out
 * of scope for this app (App Store IAP policy, see the original build
 * brief), unlike web where it's one tap from this same card. A 2-column
 * poster grid replaces web's 4-column desktop one; everything else —
 * status badge, sold/capacity line, Edit, view-as-guest — is the same. */
export default function EventsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<EventsStackParamList>>();
  const [tab, setTab] = useState<'all' | EventStatus>('all');
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // useFocusEffect, not mount-only — this screen stays mounted at the root
  // of EventsStack, so returning here after creating/editing an event in
  // the wizard needs a refetch to show it (organizer feedback 2026-09-15).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      organizer
        .events()
        .then((evs) => { if (!cancelled) setEvents(evs); })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load events'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  const byStatus = tab === 'all' ? events : events.filter((e) => e.status === tab);
  const list = byStatus
    .filter((e) => (scope === 'upcoming' ? !isEventOver(e) : isEventOver(e)))
    .sort((a, b) => (scope === 'upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));

  return (
    <Screen>
      <View style={styles.header}>
        <Txt style={styles.h1}>My events</Txt>
        <Button label="+ Create event" onPress={() => navigation.navigate('EventWizard')} style={styles.createBtn} />
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map((t) => {
            const count = t.key === 'all' ? events.length : events.filter((e) => e.status === t.key).length;
            return (
              <Txt
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tabLabel, tab === t.key && styles.tabLabelOn]}
              >
                {t.label} ({count})
              </Txt>
            );
          })}
        </ScrollView>
        <View style={styles.scopeRow}>
          <Txt onPress={() => setScope('upcoming')} style={[styles.tabLabel, scope === 'upcoming' && styles.tabLabelOn]}>Upcoming</Txt>
          <Txt onPress={() => setScope('past')} style={[styles.tabLabel, scope === 'past' && styles.tabLabelOn]}>Past</Txt>
        </View>

        {loading && <Muted style={styles.centerNote}>Loading…</Muted>}
        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}
        {!loading && !err && list.length === 0 && (
          <Muted style={styles.centerNote}>No {scope} events{tab !== 'all' ? ` in ${tab}` : ''}.</Muted>
        )}

        <View style={styles.grid}>
          {list.map((e) => {
            const sold = e.tiers.reduce((a, t) => a + t.sold, 0);
            const cap = e.tiers.reduce((a, t) => a + t.quantity, 0);
            const badge = STATUS_BADGE(e);
            const city = eventCity(e);
            return (
              <View key={e.id} style={styles.cardWrap}>
                <View style={styles.posterWrap}>
                  <Poster hue={e.posterHue} icon={<CategoryIcon name={e.category} size={36} color={colors.muted2} />} imageUrl={e.posterUrl} alt={e.title} />
                  <View style={styles.posterBadge}>
                    <Badge label={badge.label} tone={badge.tone === 'default' ? undefined : badge.tone} />
                  </View>
                </View>
                <Card style={styles.cardBody}>
                  <Txt style={styles.bold} numberOfLines={2}>{e.title}</Txt>
                  <Muted style={styles.tiny} numberOfLines={2}>
                    {e.status === 'rejected'
                      ? `reason: ${e.rejectionReason ?? 'guideline issue'}`
                      : e.status === 'draft'
                      ? 'draft · last edited recently'
                      : e.status === 'pending'
                      ? `${fmtDate(e.date)} · submitted for review`
                      : `${fmtDate(e.date)} · ${sold.toLocaleString()}/${cap.toLocaleString()} sold`}
                  </Muted>
                  <View style={styles.cardActions}>
                    <Button
                      label="Edit"
                      variant="ghost"
                      onPress={() => navigation.navigate('EventWizard', { eventId: e.id })}
                      style={styles.smallBtn}
                    />
                    {e.status === 'approved' && (
                      <Button
                        label="View"
                        variant="ghost"
                        onPress={() => Linking.openURL(`${SITE_ORIGIN}${eventPath(city ?? 'Hyderabad', e.slug)}`)}
                        style={styles.smallBtn}
                      />
                    )}
                  </View>
                </Card>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Matches Dashboard's H1 top offset (content padding spacing.l + H1's
  // own marginTop spacing.s = 24) and font size exactly (organizer
  // feedback 2026-09-15: "same top space and font size like dashboard" on
  // every screen).
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.l, paddingTop: spacing.l + spacing.s, paddingBottom: spacing.l, gap: spacing.s },
  h1: { fontFamily: fontFamily.extrabold, fontSize: fontSize.display },
  createBtn: { height: 40, paddingHorizontal: spacing.m },
  contentScroll: { flex: 1 },
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl },
  tabRow: { gap: spacing.l, marginBottom: spacing.s, alignItems: 'flex-start' },
  scopeRow: { flexDirection: 'row', gap: spacing.l, marginBottom: spacing.l },
  tabLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.s, color: colors.muted, paddingVertical: spacing.s },
  tabLabelOn: { color: colors.text },
  centerNote: { textAlign: 'center', padding: spacing.l },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m },
  cardWrap: { width: '47%' },
  posterWrap: { position: 'relative' },
  posterBadge: { position: 'absolute', top: 8, left: 8, zIndex: 2 },
  cardBody: { padding: spacing.s, marginTop: spacing.s },
  bold: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  tiny: { fontSize: 11, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 6, marginTop: spacing.s },
  smallBtn: { flex: 1, height: 34, paddingHorizontal: spacing.s },
});
