import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import QRCode from 'react-native-qrcode-svg';
import { ArrowLeft, Calendar, CalendarDays, CreditCard, Download, MapPin, Ticket } from 'lucide-react-native';
import { bookingsApi } from '../../api/bookings';
import { wallet } from '../../api/wallet';
import { ApiError } from '../../api/client';
import { fmtDate, fmtTime, eventLocation } from '../../lib/bookingDisplay';
import { useTicketActions } from '../../lib/useTicketActions';
import { cacheBookings, getCachedBookings } from '../../lib/bookingsCache';
import { cancelEventDayNotification } from '../../lib/eventDayNotification';
import { isEventOver } from '../../lib/eventStatus';
import { Badge, Button, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { TicketView } from '../../components/TicketView';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Booking } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = { key: string; name: 'BookingDetail'; params: RootStackParamList['BookingDetail'] };

const REFUND_LABEL: Record<string, string> = {
  refunded: 'Refunded',
  refund_requested: 'Refund pending',
  cancelled: 'Cancelled',
};

/** My Bookings' detail screen — mirrors web's MyBookings.tsx right-hand
 * detail panel feature-for-feature (price paid, status badge, guest names,
 * resend/cancel actions, refund-destination choice, QR + download/
 * calendar), adapted to a dedicated mobile screen instead of a desktop
 * side-by-side layout. Pushed from BookingsScreen's row tap. */
export default function BookingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Rt;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [offline, setOffline] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [resending, setResending] = useState(false);
  const [busy, setBusy] = useState(false);
  const { ticketRef, downloadTicket, addToCalendar } = useTicketActions(booking);

  const load = useCallback(async () => {
    try {
      const list = await bookingsApi.list();
      cacheBookings(list);
      setOffline(false);
      setBooking(list.find((b) => b.id === route.params.bookingId) ?? null);
    } catch {
      // No signal at the venue door is exactly when this QR ticket matters
      // most — fall back to the last successfully cached list instead of
      // leaving the guest stuck on a loading spinner with no way to show
      // their ticket at the gate.
      const cached = await getCachedBookings();
      setOffline(true);
      setBooking(cached.find((b) => b.id === route.params.bookingId) ?? null);
    }
  }, [route.params.bookingId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doResend = async () => {
    if (!booking) return;
    setResending(true);
    try {
      await bookingsApi.resend(booking.id);
      Alert.alert('Sent', 'Ticket resent to your WhatsApp ✓');
    } catch {
      Alert.alert('Could not resend', 'Please try again in a moment.');
    }
    setResending(false);
  };

  const doRefund = async (refundTo: 'wallet' | 'source') => {
    if (!booking) return;
    setBusy(true);
    try {
      await bookingsApi.cancel(booking.id, refundTo);
      if (refundTo === 'wallet') wallet.balance().catch(() => {});
      cancelEventDayNotification(booking.id).catch(() => {});
      await load();
      setRefunding(false);
    } catch (e) {
      Alert.alert('Could not cancel', e instanceof ApiError ? e.message : 'Please try again in a moment.');
    }
    setBusy(false);
  };

  if (!booking) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const event = booking.event;
  const confirmed = booking.status === 'confirmed';
  // Real gap found live (2026-10-18): nothing stopped cancelling a
  // booking for an event that already happened — there's nothing left to
  // refund them out of attending. Matches the backend's own new guard in
  // BookingsService.cancel (CatalogService.isEventOver), so this hides
  // the option instead of letting the guest hit a server error.
  const eventOver = !!event && isEventOver(event);

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <Txt style={styles.title}>Booking detail</Txt>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {offline && (
          <View style={styles.offlineBanner}>
            <Txt style={styles.offlineTxt}>Showing a saved copy — you're offline. The QR code below still works to scan in.</Txt>
          </View>
        )}

        <Txt style={styles.eventTitle}>{event?.title ?? booking.tierName}</Txt>

        <View style={styles.metaCol}>
          {!!event && (
            <View style={styles.metaRow}>
              <CalendarDays size={14} color={colors.muted} />
              <Muted style={styles.metaTxt}>{fmtDate(event.date)}, {fmtTime(event.date)}</Muted>
            </View>
          )}
          {!!event && (
            <View style={styles.metaRow}>
              <MapPin size={14} color={colors.muted} />
              <Muted style={styles.metaTxt}>{eventLocation(event)}</Muted>
            </View>
          )}
          <View style={styles.metaRow}>
            <Ticket size={14} color={colors.muted} />
            <Muted style={styles.metaTxt}>{booking.tierName} · {booking.id}</Muted>
          </View>
          <View style={styles.metaRow}>
            <CreditCard size={14} color={colors.muted} />
            <Muted style={styles.metaTxt}>Paid ₹{booking.total} · </Muted>
            {confirmed ? (
              <Badge label="Confirmed" tone="success" />
            ) : (
              <Badge label={REFUND_LABEL[booking.status] ?? booking.status} tone={booking.status === 'cancelled' ? 'danger' : 'accent'} />
            )}
          </View>
        </View>

        <Muted style={styles.guestsTxt}>Guests: {booking.guests.map((g) => g.name).join(' · ')}</Muted>

        <View style={styles.actionsRow}>
          {confirmed && (
            <Button
              label={resending ? 'Resending…' : 'Resend to WhatsApp'}
              variant="ghost"
              disabled={resending || offline}
              onPress={doResend}
              style={{ flex: 1 }}
            />
          )}
          {confirmed && !refunding && !offline && !eventOver && booking.offlinePaymentMode !== 'self_collected' && (
            <Pressable style={styles.cancelBtn} onPress={() => setRefunding(true)}>
              <Txt style={styles.cancelBtnTxt}>Cancel booking</Txt>
            </Pressable>
          )}
        </View>

        {confirmed && eventOver && booking.offlinePaymentMode !== 'self_collected' && (
          <Muted style={styles.selfCollectedNote}>This event has already happened — bookings can't be cancelled after the event.</Muted>
        )}

        {confirmed && booking.offlinePaymentMode === 'self_collected' && (
          <Muted style={styles.selfCollectedNote}>
            This ticket's payment was collected directly by the organizer, not through Prebooze — contact them directly for a refund or cancellation.
          </Muted>
        )}

        {confirmed && refunding && (
          <View style={styles.refundBox}>
            <Txt style={styles.refundBoxTitle}>Cancel & refund ₹{booking.total} — where should it go?</Txt>
            <Button
              label="Prebooze wallet — instant credit"
              onPress={() => doRefund('wallet')}
              disabled={busy}
              style={{ marginTop: spacing.s }}
            />
            <Button
              label="Original payment method — 5–7 business days"
              variant="ghost"
              onPress={() => doRefund('source')}
              disabled={busy}
              style={{ marginTop: spacing.s }}
            />
            <Button label="Keep my booking" variant="ghost" onPress={() => setRefunding(false)} disabled={busy} style={{ marginTop: spacing.s }} />
          </View>
        )}

        {confirmed && (
          <View style={styles.qrCard}>
            {!!booking.qrToken && (
              <View style={styles.qrWrap}>
                <View style={styles.qrBox}>
                  <QRCode value={booking.qrToken} size={160} backgroundColor={colors.text} color={colors.bg} />
                </View>
                <Muted style={styles.qrCaption}>valid for {booking.guests.length} guest{booking.guests.length > 1 ? 's' : ''}</Muted>
              </View>
            )}
            <View style={styles.actionsRow}>
              <Pressable style={styles.actionBtn} onPress={downloadTicket}>
                <Download size={15} color={colors.onAccent} />
                <Txt style={styles.actionBtnTxt}>Download ticket</Txt>
              </Pressable>
              <Pressable style={styles.actionBtnGhost} onPress={addToCalendar}>
                <Calendar size={15} color={colors.text} />
                <Txt style={styles.actionBtnGhostTxt}>Add to calendar</Txt>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      <TicketView ref={ticketRef} booking={booking} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingTop: spacing.s, paddingBottom: spacing.m, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  content: { padding: spacing.l, gap: spacing.m },
  offlineBanner: { backgroundColor: 'rgba(245,192,74,0.12)', borderWidth: 1, borderColor: 'rgba(245,192,74,0.3)', borderRadius: radius.m, padding: spacing.m },
  offlineTxt: { fontSize: fontSize.xs, color: '#f5c04a' },
  eventTitle: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  metaCol: { gap: 7 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaTxt: { fontSize: fontSize.s },
  guestsTxt: { fontSize: fontSize.xs },
  actionsRow: { flexDirection: 'row', gap: spacing.s, flexWrap: 'wrap' },
  cancelBtn: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.m, paddingHorizontal: spacing.m, paddingVertical: spacing.m, alignItems: 'center', justifyContent: 'center' },
  cancelBtnTxt: { color: colors.danger, fontFamily: fontFamily.bold, fontSize: fontSize.s },
  selfCollectedNote: { fontSize: fontSize.xs },
  refundBox: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderDash, borderRadius: radius.m, padding: spacing.m },
  refundBoxTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  qrCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, padding: spacing.l, gap: spacing.m },
  qrWrap: { alignItems: 'center' },
  qrBox: { backgroundColor: colors.text, padding: spacing.m, borderRadius: radius.m, marginBottom: spacing.s },
  qrCaption: { fontSize: fontSize.xs },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: radius.m, paddingVertical: spacing.m },
  actionBtnTxt: { color: colors.onAccent, fontFamily: fontFamily.bold, fontSize: fontSize.s },
  actionBtnGhost: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border2, borderRadius: radius.m, paddingVertical: spacing.m },
  actionBtnGhostTxt: { color: colors.text, fontFamily: fontFamily.bold, fontSize: fontSize.s },
});
