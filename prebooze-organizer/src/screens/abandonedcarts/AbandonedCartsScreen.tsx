import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, MessageCircle, Phone, RefreshCw, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { ApiError } from '../../api/client';
import { Card, H1, IconButton, Kpi, Muted, Screen, Txt } from '../../components/ui';
import SearchableSelect from '../../components/SearchableSelect';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { fmtMoney, timeAgo } from '../../lib/format';
import { isEventOver } from '../../lib/events';
import { goBackOrHome } from '../../lib/navBack';
import type { MoreStackParamList } from '../../navigation/types';
import type { CartRecord, Event } from '../../types';

/** Faithful port of prebooze-web/src/pages/organizer/OrgAbandonedCarts.tsx
 * — same lazy "abandoned" computation (most-recent active cart per
 * user+event, past the checkout hold TTL), same reminder-nudge-only
 * action. The transaction-history section web/the design artifact both
 * show on this same screen was dropped here — organizer feedback
 * 2026-09-15: redundant with the dedicated Transactions screen (More >
 * Transactions), which already covers it with real filtering/export.
 * Live/Past tabs (organizer feedback 2026-09-15) split carts by whether
 * their event has actually ended — an abandoned cart for a live/upcoming
 * event is still actionable (a reminder can still convert it before the
 * event happens), one for a past event no longer is. */
export default function AbandonedCartsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const route = useRoute<RouteProp<MoreStackParamList, 'AbandonedCarts'>>();
  const highlightCartId = route.params?.cartId;
  const [events, setEvents] = useState<Event[]>([]);
  const [carts, setCarts] = useState<CartRecord[]>([]);
  const [scope, setScope] = useState<'live' | 'past'>('live');
  const [eventFilter, setEventFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const load = () =>
    Promise.all([organizer.events(), organizer.abandonedCarts()])
      .then(([evs, cs]) => { setEvents(evs); setCarts(cs); });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load()
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const remind = async (cart: CartRecord) => {
    setRemindingId(cart.id);
    try {
      await organizer.remindCart(cart.id);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to send reminder');
    } finally {
      setRemindingId(null);
    }
  };

  // Deep-linked from a cart notification — land on whichever tab (Live/
  // Past) actually contains that cart, and clear any event filter that
  // might otherwise hide it, instead of leaving the organizer to hunt for
  // a cart the notification named specifically.
  useEffect(() => {
    if (!highlightCartId) return;
    const cart = carts.find((c) => c.id === highlightCartId);
    const ev = cart ? events.find((e) => e.id === cart.eventId) : undefined;
    if (ev) {
      setScope(isEventOver(ev) ? 'past' : 'live');
      setEventFilter('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightCartId, carts.length, events.length]);

  const eventById = new Map(events.map((e) => [e.id, e]));
  const scopedEvents = events.filter((e) => (scope === 'live' ? !isEventOver(e) : isEventOver(e)));
  const scopedCarts = carts.filter((c) => {
    const ev = eventById.get(c.eventId);
    if (!ev) return false;
    return scope === 'live' ? !isEventOver(ev) : isEventOver(ev);
  });
  const filteredCarts = eventFilter ? scopedCarts.filter((c) => c.eventId === eventFilter) : scopedCarts;
  const recoverable = filteredCarts.reduce((a, c) => a + c.total, 0);

  const changeScope = (s: 'live' | 'past') => {
    setScope(s);
    setEventFilter('');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => goBackOrHome(navigation, 'More', 'MoreHome')}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Abandoned carts</H1>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        <View style={styles.scopeRow}>
          <Txt onPress={() => changeScope('live')} style={[styles.tabLabel, scope === 'live' && styles.tabLabelOn]}>Live</Txt>
          <Txt onPress={() => changeScope('past')} style={[styles.tabLabel, scope === 'past' && styles.tabLabelOn]}>Past</Txt>
        </View>

        {scopedEvents.length > 0 && (
          <View style={styles.filterWrap}>
            <SearchableSelect
              value={scopedEvents.find((e) => e.id === eventFilter)?.title ?? 'All events'}
              onChange={(title) => {
                if (title === 'All events') return setEventFilter('');
                const e = scopedEvents.find((x) => x.title === title);
                setEventFilter(e?.id ?? '');
              }}
              options={['All events', ...scopedEvents.map((e) => e.title)]}
              placeholder="All events"
            />
          </View>
        )}

        <View style={styles.kpiGrid}>
          <Kpi label="Abandoned carts" value={String(filteredCarts.length)} />
          <Kpi label={scope === 'live' ? 'Recoverable' : 'Missed revenue'} value={fmtMoney(recoverable)} tone="accent" />
        </View>

        {/* Scope-aware, matching web's own addition (relayed 2026-09-15):
         * a Past cart genuinely can't convert anymore, so the copy here
         * shouldn't imply a nudge might still work. */}
        <Muted style={styles.tiny}>
          {scope === 'live'
            ? "These guests reached checkout but didn't pay before their hold lapsed — you already have their WhatsApp. A nudge often brings them back."
            : "These guests reached checkout for an event that's already happened — they can no longer be recovered, kept here for the record."}
        </Muted>

        {loading && <Muted style={styles.centerNote}>Loading…</Muted>}
        {!loading && filteredCarts.length === 0 && (
          <Card style={styles.listCard}>
            <Muted style={styles.centerNote}>
              {scope === 'live'
                ? "No abandoned carts right now — nice. They'll appear here when a guest leaves checkout without paying."
                : 'No abandoned carts from past events.'}
            </Muted>
          </Card>
        )}
        {filteredCarts.map((c) => (
          <Card key={c.id} style={[styles.cartCard, c.id === highlightCartId && styles.cartCardHighlight]}>
            <Txt style={styles.bold} numberOfLines={1}>{c.userName} · {c.userPhone}</Txt>
            <Muted style={styles.tiny} numberOfLines={1}>{c.eventTitle} · {c.tierSummary} · {fmtMoney(c.total)}</Muted>
            <Muted style={styles.tiny}>Left {timeAgo(c.createdAt)}</Muted>
            {/* Action buttons only make sense for a Live cart — the event
             * for a Past one has already happened, so there's nothing left
             * to call or remind about; matches the "kept for record" copy
             * above instead of offering a dead-end action. */}
            {scope === 'live' && (
              <View style={styles.cartBtnCol}>
                <Pressable style={styles.callBtn} onPress={() => Linking.openURL(`tel:${c.userPhone.replace(/\s/g, '')}`)}>
                  <Phone size={13} color={colors.text} />
                  <Txt style={styles.remindLabel}>Call now</Txt>
                </Pressable>
                <Pressable
                  style={[styles.remindBtn, remindingId === c.id && styles.btnDisabled]}
                  disabled={remindingId === c.id}
                  onPress={() => remind(c)}
                >
                  {c.remindedAt ? <RefreshCw size={13} color={colors.onAccent} /> : <MessageCircle size={13} color={colors.onAccent} />}
                  <Txt style={styles.remindLabelPrimary}>
                    {remindingId === c.id ? 'Sending…' : c.remindedAt ? `Reminded ${timeAgo(c.remindedAt)} · remind again` : 'Send reminder'}
                  </Txt>
                </Pressable>
              </View>
            )}
          </Card>
        ))}
        {scope === 'live' && <Muted style={styles.footerNote}>recovery nudges are reminder + deep link only (no discount)</Muted>}
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
  // Matches EventsScreen's Upcoming/Past scopeRow exactly.
  scopeRow: { flexDirection: 'row', gap: spacing.l, marginBottom: spacing.m },
  tabLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.s, color: colors.muted, paddingVertical: spacing.s },
  tabLabelOn: { color: colors.text },
  filterWrap: { marginBottom: spacing.m },
  kpiGrid: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.m },
  tiny: { fontSize: 11.5, marginTop: 2 },
  listCard: { padding: spacing.l, marginTop: spacing.m },
  centerNote: { textAlign: 'center' },
  bold: { fontFamily: fontFamily.bold },
  cartCard: { padding: spacing.l, marginTop: spacing.m },
  cartCardHighlight: { borderWidth: 1.5, borderColor: colors.accent },
  cartBtnCol: { gap: spacing.s, marginTop: spacing.m },
  // Matches the "Prebooze App Concept" design artifact's Abandoned carts
  // card exactly: two full-width stacked buttons — "Call now" (ghost,
  // phone icon) above "Send reminder"/"Reminded Xh ago" (primary) —
  // instead of a single inline reminder button with no way to actually
  // call the guest (organizer feedback 2026-09-15: "no call now button as
  // per our artifacts").
  callBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surface2, borderColor: colors.border3, borderWidth: 1.5, borderRadius: 10, paddingVertical: 11 },
  remindBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 11 },
  btnDisabled: { opacity: 0.5 },
  remindLabel: { fontSize: 12.5, fontFamily: fontFamily.bold },
  remindLabelPrimary: { fontSize: 12.5, fontFamily: fontFamily.bold, color: colors.onAccent },
  footerNote: { fontSize: 11, marginTop: spacing.s },
});
