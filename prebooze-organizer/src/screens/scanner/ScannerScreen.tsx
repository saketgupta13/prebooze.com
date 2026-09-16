import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { Check, Gift, Keyboard, Martini, Megaphone, RefreshCw, Ticket, X, Zap } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { bookings } from '../../api/bookings';
import { promoter } from '../../api/promoter';
import { ApiError } from '../../api/client';
import { Badge, Button, Card, H1, H2, Input, Muted, Screen, Txt } from '../../components/ui';
import SearchableSelect from '../../components/SearchableSelect';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import { isPassValid } from '../../lib/promoterPass';
import type { Booking, Event, OrgAttendee, OrgGuestListEntry, OrgPromoterGuest } from '../../types';

// Matches Bookings.tsx's isEventOver — an event is "over" once its end
// time (date + durationHrs) has passed, not just its start time.
const isEventOver = (e: { date: string; durationHrs: number }) => new Date(e.date).getTime() + e.durationHrs * 3600_000 < Date.now();

type ScanState =
  | { mode: 'idle' }
  | { mode: 'checked-in'; booking: Booking }
  | { mode: 'valid-booking'; row: OrgAttendee }
  | { mode: 'valid-promoter'; row: OrgPromoterGuest }
  | { mode: 'valid-guestlist'; row: OrgGuestListEntry }
  | { mode: 'invalid'; reason: string };

interface PaidMatch {
  main: OrgAttendee;
  matchedName: string;
  extra: number;
  disabled: boolean;
  reason?: string;
}
interface GuestListMatch {
  kind: 'promoter' | 'orgList';
  key: string;
  name: string;
  sub: string;
  disabled: boolean;
  reason?: string;
  row: OrgPromoterGuest | OrgGuestListEntry;
}

const MIN_QUERY = 2;

function paidMatches(attendees: OrgAttendee[], q: string): PaidMatch[] {
  const query = q.trim().toLowerCase();
  if (query.length < MIN_QUERY) return [];
  const byBooking = new Map<string, OrgAttendee[]>();
  for (const a of attendees) {
    if (!byBooking.has(a.bookingId)) byBooking.set(a.bookingId, []);
    byBooking.get(a.bookingId)!.push(a);
  }
  const results: PaidMatch[] = [];
  for (const rows of byBooking.values()) {
    const main = rows.find((r) => r.isMainGuest) ?? rows[0];
    const idMatch = main.bookingId.toLowerCase().includes(query);
    const nameMatch = rows.find((r) => r.name.toLowerCase().includes(query));
    if (!idMatch && !nameMatch) continue;
    const disabled = main.checkedIn || main.bookingStatus !== 'confirmed';
    const reason = main.checkedIn ? 'Already checked in' : main.bookingStatus !== 'confirmed' ? `Booking is ${main.bookingStatus}` : undefined;
    results.push({ main, matchedName: nameMatch ? nameMatch.name : main.name, extra: rows.length - 1, disabled, reason });
  }
  return results.slice(0, 8);
}

function guestListMatches(promoterGuests: OrgPromoterGuest[], orgGuests: OrgGuestListEntry[], event: Event | undefined, q: string): GuestListMatch[] {
  const query = q.trim().toLowerCase();
  if (query.length < MIN_QUERY) return [];
  const valid = event ? isPassValid(event) : false;
  const fromPromoter: GuestListMatch[] = promoterGuests
    .filter((g) => g.name.toLowerCase().includes(query))
    .map((g) => ({
      kind: 'promoter' as const,
      key: g.id,
      name: g.name,
      sub: `brought by ${g.promoterName ?? `@${g.promoterSlug}`}`,
      disabled: g.arrived || !valid,
      reason: g.arrived ? 'Already checked in' : !valid ? 'Free-entry window closed' : undefined,
      row: g,
    }));
  const fromOrgList: GuestListMatch[] = orgGuests
    .filter((g) => g.name.toLowerCase().includes(query))
    .map((g) => ({
      kind: 'orgList' as const,
      key: g.id,
      name: g.name,
      sub: g.companions.length ? `guest list · with ${g.companions.map((c) => c.name).join(', ')}` : 'guest list',
      disabled: g.arrived,
      reason: g.arrived ? 'Already checked in' : undefined,
      row: g,
    }));
  return [...fromPromoter, ...fromOrgList].slice(0, 8);
}

/** Faithful port of prebooze-web/src/pages/organizer/Scanner.tsx. Same
 * shape-based auto-detection (no mode to pick before scanning): a paid
 * booking's signed token has two "." separators, a VIP invite is
 * "vip-<entryId>", anything else is a promoter pass ("<passId>-<rotation>").
 * Camera decoding is native here (expo-camera's built-in barcode scanner)
 * instead of web's jsQR-on-canvas approach — no equivalent of jsQR's
 * dedupe-per-frame is needed since the native scanner already debounces,
 * but a scan lock still guards against a double-fire before React state
 * catches up. */
export default function ScannerScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState('');
  const [attendees, setAttendees] = useState<OrgAttendee[]>([]);
  const [promoterGuests, setPromoterGuests] = useState<OrgPromoterGuest[]>([]);
  const [orgGuestList, setOrgGuestList] = useState<OrgGuestListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<ScanState>({ mode: 'idle' });
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [useCamera, setUseCamera] = useState(true);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const scanLockRef = useRef(false);

  // Sweeping scan-line, matching the original design concept's `.scan-line`
  // animation (12%→86%→12% of the frame height, not a simple linear loop).
  // useNativeDriver:false is required here — this drives the Animated.View's
  // `top` (a layout property, interpolated as a percentage string), and only
  // transform/opacity are supported by the native driver. Using true throws
  // "Style property 'top' is not supported by native animated module".
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          // scan at, so it has no business appearing in this picker
          // (organizer feedback 2026-09-15; same real gap exists on web,
          // flagged there too).
          const live = evs.filter((e) => e.status === 'approved' && !isEventOver(e));
          setEvents(live);
          setEventId((prev) => (prev && live.some((e) => e.id === prev) ? prev : (live[0]?.id ?? '')));
          if (!live.length) setLoading(false);
        })
        .catch(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, []),
  );

  const load = () => {
    if (!eventId) return;
    setLoading(true);
    Promise.all([organizer.attendees(eventId), organizer.promoterGuests(eventId), organizer.guestList(eventId)])
      .then(([a, p, gl]) => { setAttendees(a); setPromoterGuests(p); setOrgGuestList(gl.entries); })
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [eventId]);

  const event = events.find((e) => e.id === eventId);

  const resetToIdle = () => {
    scanLockRef.current = false;
    setState({ mode: 'idle' });
  };

  const onQrScanned = async (raw: string) => {
    if (scanLockRef.current || busy || state.mode !== 'idle') return;
    scanLockRef.current = true;
    if (raw.includes('.')) {
      setBusy(true);
      try {
        const updated = await bookings.checkIn(raw);
        setState({ mode: 'checked-in', booking: updated });
        load();
      } catch (e) {
        setState({ mode: 'invalid', reason: e instanceof ApiError ? e.message : 'Check-in failed' });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (raw.startsWith('vip-')) {
      const entryId = raw.slice(4);
      const entry = orgGuestList.find((g) => g.id === entryId);
      if (!entry) return setState({ mode: 'invalid', reason: "Pass not recognized — make sure you're scanning the right event" });
      if (entry.arrived) return setState({ mode: 'invalid', reason: 'Already checked in' });
      return setState({ mode: 'valid-guestlist', row: entry });
    }
    const passId = raw.slice(0, raw.lastIndexOf('-'));
    const pg = promoterGuests.find((g) => g.id === passId);
    if (!pg) return setState({ mode: 'invalid', reason: "Pass not recognized — make sure you're scanning the right event" });
    if (pg.arrived) return setState({ mode: 'invalid', reason: 'Already checked in' });
    if (event && !isPassValid(event)) return setState({ mode: 'invalid', reason: 'Free-entry window has closed' });
    setState({ mode: 'valid-promoter', row: pg });
  };

  const confirmBooking = async (row: OrgAttendee) => {
    setBusy(true);
    try {
      await organizer.manualCheckIn(eventId, row.bookingId.replace('#', ''), 1);
      resetToIdle();
      setSearch('');
      load();
    } catch (e) {
      setState({ mode: 'invalid', reason: e instanceof ApiError ? e.message : 'Check-in failed' });
    } finally {
      setBusy(false);
    }
  };

  const confirmPromoter = async (row: OrgPromoterGuest) => {
    setBusy(true);
    try {
      await promoter.checkInGuest(row.id);
      resetToIdle();
      setSearch('');
      load();
    } catch (e) {
      setState({ mode: 'invalid', reason: e instanceof ApiError ? e.message : 'Check-in failed' });
    } finally {
      setBusy(false);
    }
  };

  const confirmGuestListEntry = async (row: OrgGuestListEntry) => {
    setBusy(true);
    try {
      await organizer.toggleGuestArrived(row.id);
      resetToIdle();
      setSearch('');
      load();
    } catch (e) {
      setState({ mode: 'invalid', reason: e instanceof ApiError ? e.message : 'Check-in failed' });
    } finally {
      setBusy(false);
    }
  };

  const checkedInTotal = attendees.filter((a) => a.checkedIn).length + promoterGuests.filter((g) => g.arrived).length;
  const total = attendees.length + promoterGuests.length;
  const paidResults = paidMatches(attendees, search);
  const guestResults = guestListMatches(promoterGuests, orgGuestList, event, search);

  if (!loading && events.length === 0) {
    return (
      <Screen>
        <View style={styles.topBar}>
          <H1 style={styles.heading}>Scanner</H1>
        </View>
        <Muted style={{ textAlign: 'center', paddingHorizontal: spacing.xl }}>No live events yet — the scanner works once an event is approved.</Muted>
      </Screen>
    );
  }

  if (state.mode === 'checked-in') {
    const b = state.booking;
    const isFree = b.subtotal === 0;
    return (
      <Screen style={styles.resultScreen}>
        <ScrollView contentContainerStyle={styles.resultContent}>
          <ConfirmTick />
          {isFree ? <Badge label="Guest list" tone="success" /> : <Badge label="Paid booking" tone="default" />}
          <H2 style={styles.resultTitle}>Checked in</H2>
          <View style={styles.kvList}>
            <KV k="Booking" v={b.id} bold />
            <KV k={`Guest${b.qty > 1 ? 's' : ''}`} v={b.guests.map((g) => g.name).join(', ')} />
            <KV k="Tickets" v={`${b.tierName} · ${b.qty}`} />
            <KV k="Total paid" v={`₹${b.total}`} bold />
            <KV k="Payment" v={b.paymentId ? 'Online' : (b.paymentMethod || '—')} />
            {!!b.promoterName && <KV k="Promoter" v={b.promoterName} icon={<Megaphone size={12} color={colors.text} />} />}
          </View>
          <View style={styles.includesBox}>
            <Muted style={styles.includesLabel}>What's included in this ticket</Muted>
            {b.coverCharge ? (
              <View style={styles.includesRow}><Martini size={15} color={colors.accent} /><Txt style={[styles.bold, { color: colors.accent }]}>₹{b.coverCharge} redeemable at the venue</Txt></View>
            ) : (
              <View style={styles.includesRow}><Ticket size={15} color={colors.text} /><Txt style={styles.bold}>Entry</Txt></View>
            )}
          </View>
          <Button label="Scan next" onPress={resetToIdle} />
        </ScrollView>
      </Screen>
    );
  }

  if (state.mode === 'valid-promoter') {
    const g = state.row;
    return (
      <Screen style={styles.resultScreen}>
        <ScrollView contentContainerStyle={styles.resultContent}>
          <ConfirmTick />
          <Badge label="Guest list" tone="success" />
          <H2 style={styles.resultTitle}>Free entry — valid</H2>
          <View style={styles.kvList}>
            <KV k="Guest" v={g.name} bold />
            <KV k="Brought by" v={g.promoterName ?? g.promoterSlug} icon={<Megaphone size={12} color={colors.text} />} />
            <KV k="Age · gender" v={`${g.age ?? '—'} · ${g.gender ?? '—'}`} />
            <KV k="Event" v={event?.title ?? '—'} />
          </View>
          <Button label={busy ? 'Checking in…' : `Check in ${g.name.split(' ')[0]}`} onPress={() => confirmPromoter(g)} loading={busy} />
          <Button label="Scan next" variant="ghost" onPress={resetToIdle} style={styles.secondaryBtn} />
        </ScrollView>
      </Screen>
    );
  }

  if (state.mode === 'valid-guestlist') {
    const g = state.row;
    const partySize = 1 + g.companions.length;
    return (
      <Screen style={styles.resultScreen}>
        <ScrollView contentContainerStyle={styles.resultContent}>
          <ConfirmTick />
          <Badge label="Guest list" tone="success" />
          <H2 style={styles.resultTitle}>Guest list — valid</H2>
          <View style={styles.kvList}>
            <KV k="Guest" v={g.name} bold />
            {g.companions.length > 0 && <KV k="With" v={g.companions.map((c) => c.name).join(', ')} />}
            <KV k="Party size" v={String(partySize)} />
            <KV k="Added by" v={g.addedBy} />
          </View>
          <Button label={busy ? 'Checking in…' : `Check in ${g.name.split(' ')[0]}`} onPress={() => confirmGuestListEntry(g)} loading={busy} />
          <Button label="Scan next" variant="ghost" onPress={resetToIdle} style={styles.secondaryBtn} />
        </ScrollView>
      </Screen>
    );
  }

  if (state.mode === 'valid-booking') {
    const row = state.row;
    const partyNames = attendees.filter((a) => a.bookingId === row.bookingId).map((a) => a.name);
    const isFree = row.subtotal === 0;
    return (
      <Screen style={styles.resultScreen}>
        <ScrollView contentContainerStyle={styles.resultContent}>
          <ConfirmTick />
          {isFree ? <Badge label="Guest list" tone="success" /> : <Badge label="Paid booking" tone="default" />}
          <H2 style={styles.resultTitle}>Valid ticket</H2>
          <View style={styles.kvList}>
            <KV k="Booking" v={row.bookingId} bold />
            <KV k="Event" v={event?.title ?? '—'} />
            <KV k={`Guest${partyNames.length > 1 ? 's' : ''}`} v={partyNames.join(', ') || row.name} />
            <KV k="Tickets" v={row.tierName} />
            <KV k="Total paid" v={`₹${row.total}`} bold />
            <KV k="Payment" v={row.paymentMethod} />
            {!!row.promoterName && <KV k="Promoter" v={row.promoterName} icon={<Megaphone size={12} color={colors.text} />} />}
          </View>
          <View style={styles.includesBox}>
            <Muted style={styles.includesLabel}>What's included in this ticket</Muted>
            {row.coverCharge ? (
              <View style={styles.includesRow}><Martini size={15} color={colors.accent} /><Txt style={[styles.bold, { color: colors.accent }]}>₹{row.coverCharge} redeemable at the venue</Txt></View>
            ) : (
              <View style={styles.includesRow}><Ticket size={15} color={colors.text} /><Txt style={styles.bold}>Entry</Txt></View>
            )}
          </View>
          <Button label={busy ? 'Checking in…' : 'Check in'} onPress={() => confirmBooking(row)} loading={busy} />
          <Button label="Scan next" variant="ghost" onPress={resetToIdle} style={styles.secondaryBtn} />
        </ScrollView>
      </Screen>
    );
  }

  if (state.mode === 'invalid') {
    return (
      <Screen style={styles.resultScreen}>
        <ScrollView contentContainerStyle={styles.resultContent}>
          <View style={[styles.tick, { backgroundColor: colors.danger }]}><X size={30} color="#fff" /></View>
          <H2 style={[styles.resultTitle, { color: colors.danger }]}>Not valid</H2>
          <Muted style={styles.invalidReason}>{state.reason}</Muted>
          <Button label="Try again" onPress={resetToIdle} />
        </ScrollView>
      </Screen>
    );
  }

  // Camera mode is a dedicated full-bleed layout matching the original
  // design concept artifact exactly (event picker + flash/flip as a
  // translucent overlay on the camera itself, corner-bracket scan frame
  // with a sweeping line, "switch to manual entry" as an overlay link) —
  // organizer feedback 2026-09-15: "match it as artifacts". No Dashboard-
  // style heading here on purpose, same as the concept: the camera fills
  // the screen instead. Manual-entry mode below keeps the regular heading
  // treatment since there's no camera to be immersive with there.
  if (useCamera) {
    const eventLabel = event?.title ?? (loading ? 'Loading…' : 'Select event');
    const scanLineY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: ['12%', '86%'] });
    return (
      <Screen>
        <View style={styles.camFull}>
          <CameraBox
            permission={permission}
            requestPermission={requestPermission}
            active={state.mode === 'idle' && !busy}
            onScan={onQrScanned}
            facing={facing}
            torch={torch}
          />
          {!!permission?.granted && (
            <>
              <View style={styles.camOverlayTop} pointerEvents="box-none">
                <SearchableSelect
                  value={eventLabel}
                  onChange={(title) => { const e = events.find((x) => x.title === title); if (e) setEventId(e.id); }}
                  options={events.map((e) => e.title)}
                  placeholder="Select event"
                  fieldStyle={styles.camEventPill}
                  fieldTextStyle={styles.camEventPillText}
                  chevronColor="#fff"
                />
                <View style={styles.camIconRow}>
                  <Pressable style={styles.camIconBtn} onPress={() => setTorch((t) => !t)}>
                    <Zap size={15} color={torch ? colors.accent : '#fff'} fill={torch ? colors.accent : 'none'} />
                  </Pressable>
                  <Pressable style={styles.camIconBtn} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}>
                    <RefreshCw size={15} color="#fff" />
                  </Pressable>
                </View>
              </View>

              <Text style={styles.camInstruction}>Scan any ticket or guest-list QR</Text>

              <View style={styles.scanFrame} pointerEvents="none">
                <View style={[styles.scanCorner, styles.cornerTL]} />
                <View style={[styles.scanCorner, styles.cornerTR]} />
                <View style={[styles.scanCorner, styles.cornerBL]} />
                <View style={[styles.scanCorner, styles.cornerBR]} />
                <Animated.View style={[styles.scanLine, { top: scanLineY }]} />
              </View>
            </>
          )}

          <View style={styles.camBottomOverlay} pointerEvents="box-none">
            <Pressable style={styles.camManualLink} onPress={() => setUseCamera(false)}>
              <Keyboard size={13} color={colors.accent} />
              <Text style={styles.camManualLinkText}>Switch to manual entry</Text>
            </Pressable>
            <View style={styles.footerRow}>
              <Check size={12} color="rgba(255,255,255,.75)" />
              <Text style={styles.camFooterText}>{checkedInTotal} checked in · {total} total</Text>
            </View>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <H1 style={styles.heading}>Scanner</H1>
        <SearchableSelect
          value={event?.title ?? ''}
          onChange={(title) => { const e = events.find((x) => x.title === title); if (e) setEventId(e.id); }}
          options={events.map((e) => e.title)}
          placeholder="Select event"
        />
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.scanContent}>
        <Input placeholder="Search name, booking # or guest list" value={search} onChangeText={setSearch} autoFocus />
        {search.trim().length >= MIN_QUERY && (
          <Card style={styles.resultsCard}>
            {paidResults.length === 0 && guestResults.length === 0 ? (
              <Muted style={styles.centerNote}>No matches</Muted>
            ) : (
              <>
                {paidResults.map((r) => (
                  <Pressable
                    key={r.main.bookingId}
                    disabled={r.disabled}
                    style={[styles.matchRow, r.disabled && styles.matchRowDisabled]}
                    onPress={() => { scanLockRef.current = true; setState({ mode: 'valid-booking', row: r.main }); }}
                  >
                    <Txt style={styles.bold}>{r.main.name}{r.extra > 0 ? ` +${r.extra} more` : ''}</Txt>
                    <View style={styles.matchSubRow}>
                      {r.main.subtotal === 0 ? <Gift size={11} color={colors.muted} /> : <Ticket size={11} color={colors.muted} />}
                      <Muted style={styles.tiny}>
                        {r.main.subtotal === 0 ? 'Guest list' : 'Paid'} ·{' '}
                        {r.matchedName !== r.main.name ? `matched "${r.matchedName}" · ` : ''}
                        {r.main.bookingId} · {r.main.tierName}
                        {r.reason ? ` · ${r.reason}` : ''}
                      </Muted>
                    </View>
                  </Pressable>
                ))}
                {guestResults.map((r) => (
                  <Pressable
                    key={r.key}
                    disabled={r.disabled}
                    style={[styles.matchRow, r.disabled && styles.matchRowDisabled]}
                    onPress={() => { scanLockRef.current = true; setState(r.kind === 'promoter' ? { mode: 'valid-promoter', row: r.row as OrgPromoterGuest } : { mode: 'valid-guestlist', row: r.row as OrgGuestListEntry }); }}
                  >
                    <Txt style={styles.bold}>{r.name}</Txt>
                    <View style={styles.matchSubRow}>
                      <Gift size={11} color={colors.muted} />
                      <Muted style={styles.tiny}>Guest list · {r.sub}{r.reason ? ` · ${r.reason}` : ''}</Muted>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </Card>
        )}
        <Button label="Switch to camera scan" variant="ghost" onPress={() => setUseCamera(true)} style={styles.switchBtn} />

        <View style={styles.footerRow}>
          {loading ? <Muted style={styles.tiny}>Loading…</Muted> : (
            <View style={styles.footerRow}>
              <Check size={13} color={colors.muted} />
              <Muted style={styles.tiny}>{checkedInTotal} checked in · {total} total</Muted>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function ConfirmTick() {
  return <View style={styles.tick}><Check size={30} color={colors.onAccent} /></View>;
}

function KV({ k, v, bold, icon }: { k: string; v: string; bold?: boolean; icon?: ReactNode }) {
  return (
    <View style={styles.kvRow}>
      <Muted style={styles.kvKey}>{k}</Muted>
      <View style={styles.kvValWrap}>
        {icon}
        <Txt style={[styles.kvVal, bold && styles.bold]} numberOfLines={2}>{v}</Txt>
      </View>
    </View>
  );
}

function CameraBox({
  permission, requestPermission, active, onScan, facing, torch,
}: {
  permission: ReturnType<typeof useCameraPermissions>[0];
  requestPermission: () => void;
  active: boolean;
  onScan: (data: string) => void;
  facing: CameraType;
  torch: boolean;
}) {
  if (!permission) return <View style={[StyleSheet.absoluteFill, styles.camFallbackBg]} />;
  if (!permission.granted) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.camFallbackBg, styles.camFallback]}>
        <Muted style={styles.camFallbackText}>
          {permission.canAskAgain
            ? "Couldn't access the camera — allow camera access, or use manual entry below."
            : 'Camera access denied — enable it in Settings, or use manual entry below.'}
        </Muted>
        {permission.canAskAgain && <Button label="Grant camera access" onPress={requestPermission} />}
      </View>
    );
  }
  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      facing={facing}
      enableTorch={torch}
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={active ? ({ data }) => onScan(data) : undefined}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Matches Dashboard's H1 top offset/font size exactly (organizer feedback
  // 2026-09-15: "same top space and font size like dashboard").
  topBar: { paddingHorizontal: spacing.l, paddingTop: spacing.l, paddingBottom: spacing.s },
  heading: { marginTop: spacing.s, marginBottom: spacing.l },
  // See EventWizardScreen's contentScroll comment — without flex:1 a short
  // content ScrollView can leave Yoga's leftover vertical space to stretch
  // an earlier sibling instead of trailing blank space below.
  contentScroll: { flex: 1 },
  scanContent: { padding: spacing.l, paddingTop: 0 },
  switchBtn: { marginTop: spacing.m },

  // Full-bleed immersive camera layout, matching the "Prebooze App Concept"
  // design artifact — event picker + flash/flip float as a translucent
  // overlay on the camera itself rather than a separate header bar.
  camFull: { flex: 1, position: 'relative', backgroundColor: '#000' },
  camFallbackBg: { backgroundColor: '#0a0a0a' },
  camFallback: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.m },
  camFallbackText: { textAlign: 'center' },
  camOverlayTop: {
    position: 'absolute', top: spacing.l, left: spacing.l, right: spacing.l,
    flexDirection: 'row', alignItems: 'center', gap: spacing.s,
  },
  camEventPill: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', borderColor: 'rgba(255,255,255,0.25)',
    paddingVertical: spacing.s, paddingHorizontal: spacing.m,
  },
  camEventPillText: { color: '#fff', fontSize: fontSize.s },
  camIconRow: { flexDirection: 'row', gap: spacing.s },
  camIconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  camInstruction: {
    position: 'absolute', top: '20%', alignSelf: 'center',
    color: '#fff', fontSize: fontSize.s, fontFamily: fontFamily.medium,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 },
  },
  scanFrame: {
    position: 'absolute', top: '30%', left: '15%', right: '15%', aspectRatio: 1, overflow: 'hidden',
  },
  scanCorner: { position: 'absolute', width: 28, height: 28, borderColor: colors.accent },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: colors.accent },
  camBottomOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: spacing.l, paddingBottom: spacing.xl, paddingTop: spacing.xl,
    alignItems: 'center', gap: spacing.s,
  },
  camManualLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.s, paddingHorizontal: spacing.l },
  camManualLinkText: { color: colors.accent, fontFamily: fontFamily.medium, fontSize: fontSize.s },
  camFooterText: { color: 'rgba(255,255,255,.75)', fontSize: 11.5 },
  resultsCard: { marginTop: spacing.s, padding: spacing.xs },
  centerNote: { textAlign: 'center', padding: spacing.l },
  matchRow: { padding: spacing.m, borderRadius: radius.s },
  matchRowDisabled: { opacity: 0.5 },
  matchSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  bold: { fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: spacing.l },
  footerNote: { textAlign: 'center', fontSize: 11, marginTop: spacing.s },
  resultScreen: { flex: 1 },
  resultContent: { padding: spacing.xxl, alignItems: 'center' },
  tick: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.m },
  resultTitle: { marginTop: 2, marginBottom: spacing.m },
  invalidReason: { textAlign: 'center', marginBottom: spacing.xl, paddingHorizontal: spacing.l },
  kvList: { width: '100%', marginVertical: spacing.m },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.borderDash, borderStyle: 'dashed' },
  kvKey: { fontSize: fontSize.s },
  kvValWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, justifyContent: 'flex-end' },
  kvVal: { fontSize: fontSize.s, textAlign: 'right' },
  includesBox: { width: '100%', marginVertical: spacing.m, paddingTop: spacing.m, borderTopWidth: 1, borderTopColor: colors.borderDash, borderStyle: 'dashed', alignItems: 'center' },
  includesLabel: { fontSize: 11.5, marginBottom: spacing.s },
  includesRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secondaryBtn: { marginTop: spacing.m, backgroundColor: 'transparent', height: 'auto', paddingVertical: spacing.s },
});
