import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw, Undo2 } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { ApiError } from '../../api/client';
import { Badge, Card, H1, IconButton, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import type { OrgBookingDetail } from '../../types';
import type { BookingsStackParamList } from '../../navigation/types';

const fmtMoney = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
const STATUS_LABEL: Record<OrgBookingDetail['status'], string> = {
  confirmed: 'Confirmed', refund_requested: 'Refund req.', refunded: 'Refunded', cancelled: 'Cancelled',
};
const REFUND_METHOD_LABEL: Record<string, string> = { wallet: 'Prebooze wallet', source: 'original payment method' };

/** Organizer-scoped single-booking detail — RN counterpart of prebooze-web's
 * organizer/BookingDetail.tsx (same fee breakdown / guest list / refund
 * state / promoter attribution), minus a rendered QR (no QR library in this
 * app yet — booking ID + guest headcount stand in for now) and minus every
 * admin-only mutation action. See BookingsStack.tsx for how this nests. */
export default function BookingDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BookingsStackParamList>>();
  const route = useRoute<RouteProp<BookingsStackParamList, 'BookingDetail'>>();
  const { id } = route.params;
  const [booking, setBooking] = useState<OrgBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      organizer
        .bookingDetail(id)
        .then((b) => { if (!cancelled) setBooking(b); })
        .catch((e) => { if (!cancelled) setErr(e instanceof ApiError ? e.message : 'Failed to load booking'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [id]),
  );

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title} numberOfLines={1}>{booking?.id ?? 'Booking'}</H1>
        {booking && <Badge label={STATUS_LABEL[booking.status]} tone={booking.checkedIn ? 'success' : booking.status === 'confirmed' ? undefined : 'danger'} />}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {!!err && <Muted style={{ color: colors.danger, marginBottom: spacing.m }}>{err}</Muted>}
        {loading && !booking && <Muted style={styles.centerNote}>Loading…</Muted>}
        {!loading && !booking && !err && <Muted style={styles.centerNote}>Booking not found</Muted>}

        {booking && (
          <>
            <Card style={styles.card}>
              <Txt style={styles.sectionTitle}>Guest</Txt>
              <Muted style={styles.tiny}>{booking.user.name || booking.mainGuest} · {booking.whatsapp}{booking.user.email ? ` · ${booking.user.email}` : ''}</Muted>
            </Card>

            <Card style={styles.card}>
              <Txt style={styles.sectionTitle}>Event</Txt>
              <Txt style={styles.tiny}>
                {booking.event.title}{booking.event.venue?.name ? ` · ${booking.event.venue.name}` : ''}{booking.event.venue?.city ? ` · ${booking.event.venue.city}` : ''}
              </Txt>
              {!!booking.event.date && <Muted style={styles.tiny}>{fmtDate(booking.event.date)} · {fmtTime(booking.event.date)}</Muted>}
              <Muted style={styles.tiny}>{booking.qty} × {booking.tierName} · paid via {booking.paymentMethod ? `manual (${booking.paymentMethod})` : 'online payment'}</Muted>
            </Card>

            <Card style={styles.card}>
              <Txt style={styles.sectionTitle}>Fee breakdown</Txt>
              <Row label="Subtotal" value={fmtMoney(booking.subtotal)} />
              <Row label="Booking fee" value={fmtMoney(booking.fee)} />
              {booking.discount > 0 && <Row label={`Discount${booking.couponCode ? ` (${booking.couponCode})` : ''}`} value={`−${fmtMoney(booking.discount)}`} danger />}
              {booking.walletCreditUsed > 0 && <Row label="Wallet credit used" value={`−${fmtMoney(booking.walletCreditUsed)}`} danger />}
              <View style={styles.totalRow}>
                <Txt style={styles.bold}>Paid</Txt>
                <Txt style={[styles.bold, { color: colors.accent }]}>{fmtMoney(booking.total)}</Txt>
              </View>
            </Card>

            <Card style={styles.card}>
              <Txt style={styles.sectionTitle}>
                Guests on this booking ({booking.guests.length}) · {booking.guests.filter((g) => g.checkedIn).length} checked in
              </Txt>
              {booking.guests.map((g, i) => (
                <View key={i} style={styles.guestRow}>
                  <Muted style={styles.tiny}>{i + 1}.</Muted>
                  <Txt style={[styles.tiny, { flex: 1, fontFamily: i === 0 ? fontFamily.bold : fontFamily.regular }]}>
                    {g.name}{i === 0 ? ' (main)' : ''}
                  </Txt>
                  <Badge label={g.checkedIn ? 'Checked in' : 'Not checked in'} tone={g.checkedIn ? 'success' : undefined} />
                </View>
              ))}
            </Card>

            <Card style={styles.card}>
              <Txt style={styles.sectionTitle}>Timeline</Txt>
              <Row label="Booked" value={fmtDateTime(booking.createdAt)} />
              {!!booking.checkedInAt && <Row label="QR first scanned" value={fmtDateTime(booking.checkedInAt)} />}
              {booking.status === 'refunded' && !!booking.refundedTo && <Row label="Refunded to" value={REFUND_METHOD_LABEL[booking.refundedTo] ?? booking.refundedTo} />}
            </Card>

            {booking.promoter && (
              <Card style={styles.card}>
                <Txt style={styles.sectionTitle}>Promoter attribution</Txt>
                <Txt style={styles.tiny}>{booking.promoter.name}</Txt>
                <Muted style={styles.tiny}>Commission earned: {fmtMoney(booking.promoterCommission)}</Muted>
              </Card>
            )}

            <Card style={styles.card}>
              <Txt style={styles.sectionTitle}>Group entry</Txt>
              <Muted style={styles.tiny}>Booking ID {booking.id} covers the whole group — {booking.guests.length} guest{booking.guests.length > 1 ? 's' : ''}. Scan the guest's own ticket QR at the gate.</Muted>
            </Card>

            {booking.status === 'refund_requested' && (
              <Card style={[styles.card, { borderColor: colors.danger }]}>
                <View style={styles.iconRow}><Undo2 size={14} color={colors.danger} /><Txt style={[styles.bold, { color: colors.danger }]}>Refund requested — "can't attend"</Txt></View>
                <Muted style={styles.tiny}>Awaiting admin review — refund approvals happen on the Prebooze admin side, not here.</Muted>
              </Card>
            )}

            {booking.refundGatewayState === 'INITIATED' && (
              <Card style={[styles.card, { borderColor: colors.accent }]}>
                <View style={styles.iconRow}><RefreshCw size={14} color={colors.accent} /><Txt style={[styles.bold, { color: colors.accent }]}>Refund in progress on the gateway</Txt></View>
                <Muted style={styles.tiny}>{fmtMoney(booking.refundGatewayAmount ?? booking.total)} is being processed by the payment gateway right now.</Muted>
              </Card>
            )}

            {booking.refundGatewayState === 'COMPLETED' && !booking.refundFailedAt && (
              <Card style={[styles.card, { borderColor: colors.success }]}>
                <View style={styles.iconRow}><CheckCircle2 size={14} color={colors.success} /><Txt style={[styles.bold, { color: colors.success }]}>Refund completed</Txt></View>
                <Muted style={styles.tiny}>{fmtMoney(booking.refundGatewayAmount ?? booking.total)} confirmed by the gateway — the guest has been paid back.</Muted>
              </Card>
            )}

            {!!booking.refundFailedAt && booking.refundGatewayState !== 'INITIATED' && (
              <Card style={[styles.card, { borderColor: colors.danger }]}>
                <View style={styles.iconRow}><AlertTriangle size={14} color={colors.danger} /><Txt style={[styles.bold, { color: colors.danger }]}>Refund to original payment method failed</Txt></View>
                <Muted style={styles.tiny}>The payout to the guest's card/UPI/bank hasn't gone through yet (failed {fmtDateTime(booking.refundFailedAt)}). This is being retried on the admin side.</Muted>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.row}>
      <Muted style={styles.tiny}>{label}</Muted>
      <Txt style={[styles.tiny, danger && { color: colors.danger }]}>{value}</Txt>
    </View>
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
  bold: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, marginTop: 2, borderTopWidth: 1, borderTopColor: colors.border },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing.s, paddingVertical: 6 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
