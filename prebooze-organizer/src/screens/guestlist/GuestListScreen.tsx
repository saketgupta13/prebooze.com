import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Megaphone, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { promoter } from '../../api/promoter';
import { ApiError } from '../../api/client';
import { Badge, Button, Card, Chip, H1, IconButton, Input, Kpi, Muted, Screen, Stepper, Txt } from '../../components/ui';
import SearchableSelect from '../../components/SearchableSelect';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { countdownLabel, cutoffDate } from '../../lib/promoterPass';
import { isEventOver } from '../../lib/events';
import type { MoreStackParamList } from '../../navigation/types';
import type { Event, OrgGuestListEntry, OrgPromoterGuest } from '../../types';

/** Faithful port of prebooze-web/src/pages/organizer/OrgGuestList.tsx. Same
 * two sections: the organizer's own free-entry guest list (add/toggle-
 * arrived/remove), and — only when the event has promoter guest-listing
 * enabled — the promoter-brought guests grouped by promoter, same as web. */
export default function GuestListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState('');
  const [entries, setEntries] = useState<OrgGuestListEntry[]>([]);
  const [stats, setStats] = useState({ namesCount: 0, totalHeads: 0, arrived: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plusOnes, setPlusOnes] = useState(0);
  const [companions, setCompanions] = useState<{ name: string; phone: string }[]>([]);

  // useFocusEffect, not mount-only — refetches the event list on refocus
  // (e.g. after creating an event in the wizard) instead of going stale.
  // Keeps the current eventId selection if it's still in the refreshed
  // list, only falling back to the first live event otherwise — a plain
  // mount-effect's `setEventId(live[0].id)` would otherwise reset the
  // organizer's manual selection back to the top every time they refocus.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      organizer
        .events()
        .then((evs) => {
          if (cancelled) return;
          // Web doesn't filter by status here (a pending/draft event's
          // guest list can be prepped ahead of approval) — but a *past*
          // event's guest list is no longer actionable at the door
          // regardless of status (organizer feedback 2026-09-15; same real
          // gap exists on web, flagged there too).
          const live = evs.filter((e) => !isEventOver(e));
          setEvents(live);
          setEventId((prev) => (prev && live.some((e) => e.id === prev) ? prev : (live[0]?.id ?? '')));
          if (!live.length) setLoading(false);
        })
        .catch((e) => { if (!cancelled) { setErr(e instanceof ApiError ? e.message : 'Failed to load'); setLoading(false); } });
      return () => { cancelled = true; };
    }, []),
  );

  const loadGuestList = (id: string) => {
    if (!id) return;
    setLoading(true);
    organizer
      .guestList(id)
      .then((res) => { setEntries(res.entries); setStats(res); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load guest list'))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (eventId) loadGuestList(eventId); }, [eventId]);

  const setCompanion = (i: number, patch: Partial<{ name: string; phone: string }>) =>
    setCompanions((prev) => {
      const next = [...prev];
      while (next.length < i + 1) next.push({ name: '', phone: '' });
      next[i] = { ...next[i], ...patch };
      return next;
    });

  const add = async () => {
    setErr('');
    try {
      await organizer.addGuestListEntry(eventId, { name: name.trim(), phone: phone.trim(), plusOnes, companions: companions.slice(0, plusOnes) });
      setName('');
      setPhone('');
      setPlusOnes(0);
      setCompanions([]);
      loadGuestList(eventId);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to add guest');
    }
  };

  const toggleArrived = async (id: string) => {
    try {
      await organizer.toggleGuestArrived(id);
      loadGuestList(eventId);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to update');
    }
  };

  const remove = (entry: OrgGuestListEntry) => {
    Alert.alert('Remove from guest list?', `Remove ${entry.name} from the guest list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await organizer.removeGuestListEntry(entry.id);
            loadGuestList(eventId);
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : 'Failed to remove');
          }
        },
      },
    ]);
  };

  const event = events.find((e) => e.id === eventId);

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Guest list</H1>
        <Badge label="free entry" tone="success" />
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}
        {events.length === 0 && !loading && <Muted style={fontStyleSmall}>Create an event first — the guest list is per event.</Muted>}

        {events.length > 0 && (
          <View style={styles.eventPicker}>
            <SearchableSelect
              value={events.find((e) => e.id === eventId)?.title ?? ''}
              onChange={(title) => { const e = events.find((x) => x.title === title); if (e) setEventId(e.id); }}
              options={events.map((e) => e.title)}
              placeholder="Select event"
            />
          </View>
        )}

        {!!eventId && (
          <>
            <View style={styles.kpiGrid}>
              <Kpi label="Names on list" value={String(stats.namesCount)} />
              <Kpi label="Total heads" value={String(stats.totalHeads)} />
              <Kpi label="Arrived" value={String(stats.arrived)} tone="accent" />
            </View>

            <Card style={styles.section}>
              <Txt style={styles.fieldLabel}>Guest name</Txt>
              <Input value={name} onChangeText={setName} placeholder="e.g. DJ Nova (artist)" style={styles.fieldInput} />
              <Txt style={styles.fieldLabel}>WhatsApp number *</Txt>
              <Input value={phone} onChangeText={setPhone} placeholder="+91" keyboardType="phone-pad" style={styles.fieldInput} />
              <Txt style={styles.fieldLabel}>Plus-ones</Txt>
              <View style={styles.plusOnesRow}>
                <Stepper value={plusOnes} onChange={setPlusOnes} min={0} max={6} />
              </View>
              {plusOnes > 0 && (
                <View style={styles.companionsBlock}>
                  <Muted style={styles.tiny}>name &amp; WhatsApp number required for each plus-one (checked at the gate):</Muted>
                  {Array.from({ length: plusOnes }, (_, i) => (
                    <View key={i} style={styles.companionRow}>
                      <Input value={companions[i]?.name ?? ''} onChangeText={(v) => setCompanion(i, { name: v })} placeholder={`Plus-one ${i + 1} name *`} style={styles.companionInput} />
                      <Input value={companions[i]?.phone ?? ''} onChangeText={(v) => setCompanion(i, { phone: v })} placeholder="WhatsApp number *" keyboardType="phone-pad" style={styles.companionInput} />
                    </View>
                  ))}
                </View>
              )}
              <Button label="Add to list" onPress={add} style={{ marginTop: spacing.s }} />
            </Card>

            <Card style={styles.section}>
              {loading && <Muted style={fontStyleSmall}>Loading…</Muted>}
              {!loading && entries.length === 0 && <Muted style={fontStyleSmall}>Nobody on the list yet — add artists, press and VIPs above.</Muted>}
              {entries.map((g) => (
                <View key={g.id} style={styles.guestRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt style={styles.bold}>{g.name}{g.plusOnes > 0 ? <Muted> +{g.plusOnes}</Muted> : null}</Txt>
                    {g.companions.length > 0 && (
                      <Muted style={styles.tiny}>with {g.companions.map((c) => c.name + (c.phone ? ` (${c.phone})` : '')).join(', ')}</Muted>
                    )}
                    <Muted style={styles.tiny}>{g.phone || 'no phone'} · {1 + g.plusOnes} head{g.plusOnes ? 's' : ''} · added by {g.addedBy}</Muted>
                  </View>
                  <Chip label={g.arrived ? 'Arrived' : 'Mark arrived'} active={g.arrived} onPress={() => toggleArrived(g.id)} />
                  <IconButton tone="danger" onPress={() => remove(g)}>
                    <X size={14} color={colors.danger} />
                  </IconButton>
                </View>
              ))}
            </Card>
            <Muted style={styles.footerNote}>guest-list names show in the scanner as free entries · they don't consume ticket inventory</Muted>

            {event && <PromoterGuestsSection event={event} />}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function PromoterGuestsSection({ event }: { event: Event }) {
  const [guests, setGuests] = useState<OrgPromoterGuest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    organizer.promoterGuests(event.id).then(setGuests).finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [event.id]);

  const cfg = event.promoterConfig;
  if (!cfg?.enabled) return null;
  const cutoff = cutoffDate(event);
  const closed = cutoff ? Date.now() >= cutoff.getTime() : false;
  const byPromoter = new Map<string, OrgPromoterGuest[]>();
  guests.forEach((g) => {
    const arr = byPromoter.get(g.promoterSlug) ?? [];
    arr.push(g);
    byPromoter.set(g.promoterSlug, arr);
  });
  const arrived = guests.filter((g) => g.arrived).length;

  const checkIn = async (id: string) => {
    try {
      await promoter.checkInGuest(id);
      load();
    } catch {
      // best-effort door action — real errors surface via the promoter's own console
    }
  };

  return (
    <Card style={[styles.section, { marginTop: spacing.l }]}>
      <View style={styles.promoterHead}>
        <Txt style={styles.bold}>Promoter guests</Txt>
        <Badge label="free entry" tone="accent" />
      </View>
      <Muted style={styles.tiny}>
        {arrived}/{guests.length} arrived · cap {cfg.cap} ·{' '}
        {closed ? 'list closed' : cutoff ? `closes in ${countdownLabel(cutoff)}` : ''}
      </Muted>
      {loading && <Muted style={[fontStyleSmall, { marginTop: spacing.s }]}>Loading…</Muted>}
      {!loading && guests.length === 0 && <Muted style={[fontStyleSmall, { marginTop: spacing.s }]}>No promoter guests yet for this event.</Muted>}
      {!loading && [...byPromoter.entries()].map(([slug, list]) => (
        <View key={slug} style={{ marginTop: spacing.m }}>
          <View style={styles.promoterGroupHead}>
            <Megaphone size={13} color={colors.text} />
            <Txt style={[styles.bold, fontStyleSmall]}>{slug}</Txt>
            <Muted style={fontStyleSmall}>· {list.filter((g) => g.arrived).length}/{list.length} in</Muted>
          </View>
          {list.map((g) => (
            <View key={g.id} style={styles.promoterGuestRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt style={[styles.bold, fontStyleSmall]}>{g.name}</Txt>
                <Muted style={styles.tiny}>{g.phone} · {g.age} · {g.gender?.[0]}</Muted>
              </View>
              <Chip
                label={g.arrived ? 'Arrived' : closed ? 'No-show' : 'Check in'}
                active={g.arrived}
                onPress={g.arrived || closed ? undefined : () => checkIn(g.id)}
              />
            </View>
          ))}
        </View>
      ))}
      <Muted style={styles.footerNote}>each guest is tagged with the promoter who brought them · after the cutoff, un-arrived guests count as no-shows</Muted>
    </Card>
  );
}

const fontStyleSmall = { fontSize: fontSize.s };

const styles = StyleSheet.create({
  // Matches Dashboard's H1 top offset/font size exactly (organizer feedback
  // 2026-09-15: "same top space and font size like dashboard").
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.l, paddingTop: spacing.l + spacing.s, paddingBottom: spacing.l },
  title: { flex: 1, fontSize: fontSize.display },
  // See EventWizardScreen's contentScroll comment — without flex:1 a short
  // content ScrollView can leave Yoga's leftover vertical space to stretch
  // an earlier sibling instead of trailing blank space below.
  contentScroll: { flex: 1 },
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  eventPicker: { marginBottom: spacing.m },
  kpiGrid: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.m },
  section: { padding: spacing.l, marginBottom: spacing.m },
  fieldLabel: { fontSize: fontSize.s, marginBottom: 6, marginTop: spacing.s },
  fieldInput: { marginBottom: 0 },
  plusOnesRow: { marginTop: 4 },
  companionsBlock: { marginTop: spacing.m, paddingTop: spacing.s, borderTopWidth: 1, borderTopColor: colors.borderDash, borderStyle: 'dashed' },
  companionRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s },
  companionInput: { flex: 1 },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: spacing.m, borderBottomWidth: 1, borderBottomColor: colors.borderDash, borderStyle: 'dashed' },
  bold: { fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5 },
  footerNote: { fontSize: 11, marginTop: spacing.s },
  promoterHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: 2 },
  promoterGroupHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  promoterGuestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: spacing.s, borderBottomWidth: 1, borderBottomColor: colors.border },
});
