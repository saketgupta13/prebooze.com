import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Check, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { ApiError } from '../../api/client';
import { Badge, Bar, Button, Card, H1, IconButton, Input, Kpi, Muted, Screen, Stepper, Txt } from '../../components/ui';
import SearchableSelect from '../../components/SearchableSelect';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import type { MoreStackParamList } from '../../navigation/types';
import type { Event, OrgLiveMonitor } from '../../types';

// Matches Bookings.tsx's isEventOver.
const isEventOver = (e: { date: string; durationHrs: number }) => new Date(e.date).getTime() + e.durationHrs * 3600_000 < Date.now();

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
};

const REFRESH_MS = 5000;

/** Faithful port of prebooze-web/src/pages/organizer/OrgLiveMonitor.tsx.
 * Same real GET /organizer/events/:id/live, polled every 5s. Dropped (same
 * as web): the "message staff" composer — no real staff-messaging channel
 * exists. */
export default function LiveMonitorScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState('');
  const [data, setData] = useState<OrgLiveMonitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [panel, setPanel] = useState<'none' | 'checkin'>('none');
  const [ciName, setCiName] = useState('');
  const [ciCount, setCiCount] = useState(1);
  const [ciBusy, setCiBusy] = useState(false);
  const [ciMsg, setCiMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pauseBusy, setPauseBusy] = useState(false);

  // useFocusEffect, not mount-only — see GuestListScreen's identical
  // comment. Keeps the current eventId if still valid rather than always
  // resetting to the first event on refocus.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      organizer
        .events()
        .then((evs) => {
          if (cancelled) return;
          // Approved and not yet over — a past event has no gate left to
          // monitor (organizer feedback 2026-09-15; same real gap exists on
          // web, flagged there too).
          const live = evs.filter((e) => e.status === 'approved' && !isEventOver(e));
          setEvents(live);
          setEventId((prev) => (prev && live.some((e) => e.id === prev) ? prev : (live[0]?.id ?? '')));
          if (!live.length) setLoading(false);
        })
        .catch((e) => { if (!cancelled) { setErr(e instanceof ApiError ? e.message : 'Failed to load'); setLoading(false); } });
      return () => { cancelled = true; };
    }, []),
  );

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    const loadLive = () => {
      organizer.live(eventId).then(setData).catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load live data')).finally(() => setLoading(false));
    };
    loadLive();
    const t = setInterval(loadLive, REFRESH_MS);
    return () => clearInterval(t);
  }, [eventId]);

  const manualCheckIn = async () => {
    if (!ciName.trim()) return;
    setCiBusy(true);
    setCiMsg(null);
    try {
      await organizer.manualCheckIn(eventId, ciName.trim(), ciCount);
      setCiMsg({ ok: true, text: `${ciName.trim()} checked in (${ciCount})` });
      setCiName('');
      setCiCount(1);
      organizer.live(eventId).then(setData);
    } catch (e2) {
      setCiMsg({ ok: false, text: e2 instanceof ApiError ? e2.message : 'Check-in failed' });
    } finally {
      setCiBusy(false);
    }
  };

  const togglePause = async () => {
    if (!data) return;
    setPauseBusy(true);
    try {
      await organizer.setSalesPaused(eventId, !data.salesPaused);
      organizer.live(eventId).then(setData);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to update sales status');
    } finally {
      setPauseBusy(false);
    }
  };

  const maxH = data ? Math.max(...data.histogram, 1) : 1;

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Live monitor</H1>
        <Badge label="● LIVE" tone="success" />
      </View>
      <Muted style={styles.headerNote}>refreshes every 5s · works on staff phones at the gate</Muted>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        {events.length === 0 && !loading ? (
          <Muted style={fontStyleSmall}>No live events yet — the monitor works once an event is approved.</Muted>
        ) : (
          <>
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

            {data && (
              <>
                <View style={styles.kpiGrid}>
                  <Kpi label="checked in" value={String(data.checkedIn)} />
                  <Kpi label="yet to arrive" value={String(data.remaining)} />
                  <Kpi label="scan rate" value={`${data.scanRate}/min`} />
                </View>
                <View style={styles.kpiGrid}>
                  <Kpi label="rejected QRs" value={String(data.rejected)} tone="danger" />
                  <Card style={[styles.kpi2, { flex: 2 }]}>
                    <View style={styles.gateProgressHead}>
                      <Txt style={[fontStyleSmall, styles.bold]}>Gate progress</Txt>
                      <Muted style={fontStyleSmall}>{data.checkedIn}/{data.total} in</Muted>
                    </View>
                    <Bar pct={data.pct} />
                  </Card>
                </View>

                <Card style={styles.section}>
                  <Txt style={[fontStyleSmall, styles.bold, { marginBottom: spacing.s }]}>Arrivals — by 15 min</Txt>
                  <View style={styles.chart}>
                    {data.histogram.map((v, i) => (
                      <View key={i} style={[styles.chartCol, { height: `${(v / maxH) * 100}%` }]} />
                    ))}
                  </View>
                </Card>

                <Card style={styles.section}>
                  <Txt style={[fontStyleSmall, styles.bold, { marginBottom: spacing.s }]}>Gate feed</Txt>
                  {data.feed.length === 0 && <Muted style={fontStyleSmall}>No scans yet.</Muted>}
                  {data.feed.map((f, i) => (
                    <View key={f.at + '-' + i} style={[styles.feedRow, !f.ok && styles.feedRowBad]}>
                      <Txt style={[fontStyleSmall, !f.ok && { color: colors.danger }]} numberOfLines={1}>{f.text}</Txt>
                      <Muted style={styles.tiny}>{ago(f.at)}</Muted>
                    </View>
                  ))}
                </Card>

                <View style={styles.actionsRow}>
                  <Button
                    label={pauseBusy ? 'Updating…' : data.salesPaused ? 'Resume gate sales' : 'Pause gate sales'}
                    variant={data.salesPaused ? 'primary' : 'danger'}
                    disabled={pauseBusy}
                    onPress={togglePause}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Manual check-in"
                    variant={panel === 'checkin' ? 'primary' : 'ghost'}
                    onPress={() => setPanel(panel === 'checkin' ? 'none' : 'checkin')}
                    style={{ flex: 1 }}
                  />
                </View>

                {panel === 'checkin' && (
                  <Card style={styles.checkinCard}>
                    <Txt style={styles.fieldLabel}>Guest name or booking #</Txt>
                    <Input value={ciName} onChangeText={setCiName} placeholder="e.g. Sam Rivera or #TKT-88412" autoFocus />
                    <Txt style={styles.fieldLabel}>Guests</Txt>
                    <Stepper value={ciCount} onChange={setCiCount} min={1} max={10} />
                    <Button label={ciBusy ? 'Checking…' : 'Check in'} onPress={manualCheckIn} disabled={ciBusy} style={{ marginTop: spacing.m }} />
                    {ciMsg && (
                      <View style={styles.ciMsgRow}>
                        {ciMsg.ok ? <Check size={13} color={colors.accent} /> : <X size={13} color={colors.danger} />}
                        <Muted style={[styles.tiny, !ciMsg.ok && { color: colors.danger }]}>{ciMsg.text}</Muted>
                      </View>
                    )}
                  </Card>
                )}

                <Muted style={styles.footerNote}>matches a real booking by # or exact name when it can; otherwise logs it as a walk-up admission</Muted>
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const fontStyleSmall = { fontSize: fontSize.s };

const styles = StyleSheet.create({
  // Matches Dashboard's H1 top offset/font size exactly (organizer feedback
  // 2026-09-15: "same top space and font size like dashboard").
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.l, paddingTop: spacing.l + spacing.s },
  title: { flex: 1, fontSize: fontSize.display },
  headerNote: { fontSize: 11, paddingHorizontal: spacing.l, marginTop: 4, marginBottom: spacing.s },
  // See EventWizardScreen's contentScroll comment — without flex:1 a short
  // content ScrollView can leave Yoga's leftover vertical space to stretch
  // an earlier sibling instead of trailing blank space below.
  contentScroll: { flex: 1 },
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  eventPicker: { marginBottom: spacing.m },
  kpiGrid: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.s },
  kpi2: { padding: spacing.m },
  gateProgressHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  section: { padding: spacing.l, marginTop: spacing.s, marginBottom: spacing.s },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 70 },
  chartCol: { flex: 1, backgroundColor: 'rgba(155,225,61,0.35)', borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 2 },
  feedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.s, borderWidth: 1.5, borderColor: colors.border3, borderRadius: 7, paddingHorizontal: spacing.m, paddingVertical: 6, marginBottom: 5 },
  feedRowBad: { borderColor: colors.danger },
  actionsRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s },
  checkinCard: { padding: spacing.l, marginTop: spacing.m, borderColor: colors.accent },
  fieldLabel: { fontSize: fontSize.s, marginBottom: 6, marginTop: spacing.s },
  ciMsgRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.s },
  bold: { fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5 },
  footerNote: { fontSize: 11, marginTop: spacing.s },
});
