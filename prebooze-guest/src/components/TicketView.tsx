import { forwardRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors, fontFamily, fontSize, spacing } from '../theme/tokens';
import { Txt } from './ui';
import { fmtDate, fmtTime, eventLocation } from '../lib/bookingDisplay';
import type { Booking } from '../types';

/** A real, standalone downloadable ticket — not a screenshot of the live
 * confirmation screen. Mirrors web's lib/ticket.ts canvas-rendered PNG
 * feature-for-feature (header mark, E-TICKET label, title, organizer,
 * date/location/tier/guest line, cover charge, QR with centre bunny mark,
 * booking id, full guest-name list, footer) — rendered as real RN views
 * instead of hand-drawn canvas, then captured via react-native-view-shot.
 * Always rendered off-screen (see BookingConfirmedScreen) — this is never
 * shown to the guest directly, only captured. */
export const TicketView = forwardRef<View, { booking: Booking }>(function TicketView({ booking }, ref) {
  const event = booking.event;
  return (
    <View ref={ref} collapsable={false} style={styles.page}>
      <View style={styles.card}>
        <Image source={require('../../assets/icon.png')} style={styles.headerMark} />
        <Txt style={styles.eTicket}>E-TICKET</Txt>

        <Txt style={styles.title}>{event?.title ?? booking.tierName}</Txt>
        {!!event?.organizer?.brandName && <Txt style={styles.organizer}>🎪  Hosted by {event.organizer.brandName}</Txt>}
        {!!event && <Txt style={styles.meta}>📅  {fmtDate(event.date)} · {fmtTime(event.date)}</Txt>}
        {!!event && <Txt style={styles.meta}>📍  {eventLocation(event)}</Txt>}
        <Txt style={styles.meta}>🎟  {booking.tierName}</Txt>
        <Txt style={styles.meta}>👤  {booking.mainGuest} · {booking.qty} guest{booking.qty > 1 ? 's' : ''}</Txt>
        {!!booking.coverCharge && <Txt style={styles.cover}>🍹  Includes ₹{booking.coverCharge} redeemable at the venue</Txt>}

        <View style={styles.divider} />

        <View style={styles.qrFrame}>
          <QRCode value={booking.qrToken || booking.id} size={220} backgroundColor="#fff" color="#000" />
          <View style={styles.qrCenter}>
            <Image source={require('../../assets/icon.png')} style={styles.qrCenterImg} />
          </View>
        </View>
        <Txt style={styles.scanNote}>Present this QR code at the gate for entry</Txt>

        <Txt style={styles.bookingId}>{booking.id}</Txt>

        <Txt style={styles.guestsHeader}>Guests on this ticket ({booking.guests.length})</Txt>
        <Txt style={styles.guestsList}>{booking.guests.map((g, i) => `${i + 1}. ${g.name}`).join('   ')}</Txt>

        <Txt style={styles.footNote}>Scan at entry · valid for {booking.qty} guest{booking.qty > 1 ? 's' : ''} · carry a photo ID</Txt>
        <Txt style={styles.thanks}>Thanks for booking with Prebooze — see you there! 🎉</Txt>

        <View style={styles.footerDivider} />
        <Txt style={styles.terms}>Terms & conditions apply — www.prebooze.com/legal/terms</Txt>
        <Txt style={styles.domain}>www.prebooze.com</Txt>
      </View>
    </View>
  );
});

const W = 640;

const styles = StyleSheet.create({
  page: { position: 'absolute', top: -9999, left: 0, width: W, backgroundColor: colors.bg },
  card: { width: W, backgroundColor: colors.surface2, borderRadius: 22, padding: 28, alignItems: 'center' },
  headerMark: { width: 72, height: 72, borderRadius: 18, marginTop: 12 },
  eTicket: { color: colors.accent, fontFamily: fontFamily.bold, fontSize: 13, letterSpacing: 2, marginTop: 14, marginBottom: 20 },
  title: { color: colors.text, fontFamily: fontFamily.extrabold, fontSize: 26, textAlign: 'center', marginBottom: 10 },
  organizer: { color: colors.accent, fontFamily: fontFamily.bold, fontSize: 15, marginBottom: 10 },
  meta: { color: colors.muted, fontFamily: fontFamily.medium, fontSize: 16, marginBottom: 6 },
  cover: { color: colors.accent, fontFamily: fontFamily.bold, fontSize: 15, marginTop: 6 },
  divider: { width: '100%', borderTopWidth: 2, borderStyle: 'dashed', borderTopColor: colors.border3, marginVertical: 28 },
  qrFrame: { width: 276, height: 276, backgroundColor: '#fff', borderRadius: 14, borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  qrCenter: { position: 'absolute', width: 48, height: 48, borderRadius: 10, backgroundColor: '#000', borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  qrCenterImg: { width: 36, height: 36, borderRadius: 8 },
  scanNote: { color: colors.muted2, fontFamily: fontFamily.medium, fontSize: 12, marginTop: 14 },
  bookingId: { color: colors.accent, fontFamily: fontFamily.extrabold, fontSize: 22, marginTop: 24 },
  guestsHeader: { color: colors.text, fontFamily: fontFamily.bold, fontSize: 14, marginTop: 22 },
  guestsList: { color: colors.muted, fontFamily: fontFamily.medium, fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  footNote: { color: colors.muted2, fontFamily: fontFamily.medium, fontSize: 14, marginTop: 20, textAlign: 'center' },
  thanks: { color: colors.text, fontFamily: fontFamily.bold, fontSize: 15, marginTop: 14 },
  footerDivider: { width: '60%', height: 1, backgroundColor: colors.border3, marginTop: 26, marginBottom: 14 },
  terms: { color: colors.muted2, fontFamily: fontFamily.medium, fontSize: 11 },
  domain: { color: colors.muted2, fontFamily: fontFamily.medium, fontSize: 12, marginTop: 4, marginBottom: 12 },
});
