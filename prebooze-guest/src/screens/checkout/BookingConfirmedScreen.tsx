import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { CheckCircle2, PartyPopper, Martini, Download, Calendar, Megaphone, MessageCircle, Link2, Gift } from 'lucide-react-native';
import { bookingsApi } from '../../api/bookings';
import { auth } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { useTicker } from '../../lib/useTicker';
import { tierGraceEndDate, formatCountdownDHM } from '../../lib/ticketTierPricing';
import { eventPath, absoluteUrl } from '../../lib/urls';
import { fmtDate, fmtTime, formatPrice, eventLocation } from '../../lib/bookingDisplay';
import { useTicketActions } from '../../lib/useTicketActions';
import { maybeRequestReview } from '../../lib/reviewPrompt';
import { Button, Muted, Screen, Txt } from '../../components/ui';
import { TicketView } from '../../components/TicketView';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Booking } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = { key: string; name: 'BookingConfirmed'; params: RootStackParamList['BookingConfirmed'] };

export default function BookingConfirmedScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Rt;
  const { user, refreshUser } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingCount, setBookingCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState('');
  const { ticketRef, downloadTicket, addToCalendar } = useTicketActions(booking);
  useTicker(); // keeps the free-entry countdown below from going stale

  useEffect(() => {
    bookingsApi.list().then((list) => {
      setBooking(list.find((b) => b.id === route.params.bookingId) ?? null);
      setBookingCount(list.length);
    });
    // Real booking confirmation — the happiest moment in the whole guest
    // flow, and (via its own internal "2nd booking, ask once ever" gate)
    // not spammy. Fire-and-forget, never blocks this screen rendering.
    maybeRequestReview().catch(() => {});
  }, [route.params.bookingId]);

  const goToBookings = () => {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Bookings' } }] }),
    );
  };
  const goHome = () => {
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
  };

  if (!booking) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const event = booking.event;
  // Only for a free ticket bought under an active time-limited-entry tier —
  // reminds the guest of the real deadline for the door to still honor a
  // free ticket. Same logic/copy as web's Confirmation.tsx.
  const bookedTier = event?.tiers?.find((t) => t.id === booking.tierId);
  const graceEnd = event && bookedTier?.freeCutoff ? tierGraceEndDate(event.date, bookedTier.freeCutoff) : null;
  const showGateCountdown = !!graceEnd && Date.now() < graceEnd.getTime();
  const shareUrl = event ? absoluteUrl(eventPath(event.venue?.city ?? event.unlistedVenueCity ?? event.privateCity ?? '', event.slug)) : '';
  const visibility = user?.attendanceVisibility ?? 'off';

  const setVisibility = async (v: 'followers') => {
    await auth.updateMe({ attendanceVisibility: v }).catch(() => {});
    await refreshUser();
  };

  const copyLink = async () => {
    setCopyErr('');
    const ok = await Clipboard.setStringAsync(shareUrl).then(() => true).catch(() => false);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      setCopyErr('Could not copy — try sharing instead');
    }
  };

  const waShare = () => {
    if (!event) return;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`I'm going to ${event.title}! 🎟️ ${shareUrl}`)}`).catch(() => {});
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.successIcon}>
            <CheckCircle2 size={30} color={colors.accent} />
          </View>
          <View style={styles.h1Row}>
            <Txt style={styles.h1}>You're going!</Txt>
            <PartyPopper size={22} color={colors.text} />
          </View>
          <Muted style={styles.sub}>
            Ticket sent to WhatsApp {booking.whatsapp}
            {booking.total > 0 ? ` · paid ${formatPrice(booking.total)} via PhonePe` : ' · Free entry'}
          </Muted>
        </View>

        <View style={styles.ticketCard}>
          <Txt style={styles.eventTitle}>{event?.title ?? booking.tierName}</Txt>
          {!!event && <Muted style={styles.eventMeta}>{fmtDate(event.date)} · {fmtTime(event.date)} · {eventLocation(event)}</Muted>}
          <View style={styles.idRow}>
            <Muted style={styles.idRowTxt}>{booking.tierName} · Booking {booking.id}</Muted>
            <View style={styles.confirmedBadge}>
              <Txt style={styles.confirmedBadgeTxt}>Confirmed</Txt>
              <CheckCircle2 size={12} color={colors.onAccent} />
            </View>
          </View>

          {!!booking.coverCharge && (
            <View style={styles.coverRow}>
              <Martini size={14} color={colors.accent} />
              <Txt style={styles.coverTxt}>Includes ₹{booking.coverCharge} redeemable at the venue</Txt>
            </View>
          )}

          {!!booking.qrToken && (
            <View style={styles.qrWrap}>
              <View style={styles.qrBox}>
                <QRCode value={booking.qrToken} size={150} backgroundColor={colors.text} color={colors.bg} />
              </View>
              <Muted style={styles.qrCaption}>Scan at entry — valid for {booking.guests.length} guest{booking.guests.length > 1 ? 's' : ''}</Muted>
            </View>
          )}

          {showGateCountdown && graceEnd && (
            <View style={styles.gateBox}>
              <Muted style={styles.gateLabel}>Free entry honored for</Muted>
              <Txt style={styles.gateCountdown}>{formatCountdownDHM(graceEnd.getTime())}</Txt>
              <Muted style={styles.gateSub}>
                arrive by {graceEnd.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })} — after that it's the venue's call, not guaranteed by Prebooze
              </Muted>
            </View>
          )}
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={downloadTicket}>
            <Download size={16} color={colors.onAccent} />
            <Txt style={styles.actionBtnTxt}>Download ticket</Txt>
          </Pressable>
          <Pressable style={styles.actionBtnGhost} onPress={addToCalendar}>
            <Calendar size={16} color={colors.text} />
            <Txt style={styles.actionBtnGhostTxt}>Add to calendar</Txt>
          </Pressable>
        </View>

        <View style={styles.shareCard}>
          <View style={styles.shareHeaderRow}>
            <Txt style={styles.shareHeader}>Tell your people</Txt>
            <Megaphone size={16} color={colors.text} />
          </View>
          <Muted style={styles.shareSub}>Bring your crew — share you're going and pull them in.</Muted>
          <View style={styles.shareBtnRow}>
            <Pressable style={styles.waBtn} onPress={waShare}>
              <MessageCircle size={14} color="#fff" />
              <Txt style={styles.waBtnTxt}>Share on WhatsApp</Txt>
            </Pressable>
            <Pressable style={styles.copyBtn} onPress={copyLink}>
              {copied ? <CheckCircle2 size={14} color={colors.accent} /> : <Link2 size={14} color={colors.text} />}
              <Txt style={styles.copyBtnTxt}>{copied ? 'Link copied' : 'Copy link'}</Txt>
            </Pressable>
          </View>
          {!!copyErr && <Muted style={styles.copyErr}>{copyErr}</Muted>}

          {visibility === 'off' ? (
            <View style={styles.visBox}>
              <Muted style={styles.visBoxTxt}>
                You're hidden on <Txt style={{ fontFamily: fontFamily.bold }}>"Who's going"</Txt> — friends who follow you can't see you're in.{' '}
                <Txt style={styles.visLink} onPress={() => setVisibility('followers')}>Let followers see you're going →</Txt>
              </Muted>
            </View>
          ) : (
            <View style={styles.visRow}>
              <CheckCircle2 size={12} color={colors.muted} />
              <Muted style={styles.visRowTxt}>
                Visible to {visibility === 'public' ? 'everyone' : 'your followers'} on "Who's going". Change in your profile.
              </Muted>
            </View>
          )}
        </View>

        {!user?.profileRewardClaimedAt && bookingCount === 1 && (
          <View style={styles.rewardCard}>
            <View style={styles.shareHeaderRow}>
              <Gift size={16} color={colors.text} />
              <Txt style={styles.shareHeader}>Get 10% off your next booking</Txt>
            </View>
            <Muted style={styles.shareSub}>
              Finish a few more details on your profile — photo, bio, interests — and we'll send you a one-time 10% off code (up to ₹100), valid for 15 days.
            </Muted>
            <Button label="Complete your profile →" onPress={() => navigation.navigate('FinishProfile')} style={{ marginTop: spacing.s, alignSelf: 'flex-start' }} />
          </View>
        )}

        <Pressable onPress={() => navigation.navigate('Browse', { city: user?.city })}>
          <Txt style={styles.browseLink}>Browse more events →</Txt>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="View my bookings" onPress={goToBookings} />
        <Button label="Back to home" variant="ghost" onPress={goHome} style={{ marginTop: spacing.s }} />
      </View>

      {/* Off-screen — never shown, only captured by downloadTicket(). A real
       * standalone ticket layout (mirrors web's canvas-rendered PNG), not a
       * screenshot of the page above. */}
      <TicketView ref={ticketRef} booking={booking} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.l, paddingBottom: spacing.xl, gap: spacing.l },
  header: { alignItems: 'center', paddingTop: spacing.l },
  successIcon: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(155,225,61,0.15)', borderWidth: 2, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.l,
  },
  h1Row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  h1: { fontSize: fontSize.xxl, fontFamily: fontFamily.extrabold },
  sub: { textAlign: 'center', marginTop: spacing.s },
  ticketCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent, borderRadius: radius.l, padding: spacing.l, alignItems: 'center' },
  eventTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.l, textAlign: 'center' },
  eventMeta: { fontSize: fontSize.s, marginTop: 6, textAlign: 'center' },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.m },
  idRowTxt: { fontSize: fontSize.s },
  confirmedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent, borderRadius: radius.s, paddingHorizontal: 8, paddingVertical: 3 },
  confirmedBadgeTxt: { color: colors.onAccent, fontFamily: fontFamily.bold, fontSize: fontSize.xs },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.m },
  coverTxt: { color: colors.accent, fontSize: fontSize.s, fontFamily: fontFamily.medium },
  qrWrap: { alignItems: 'center', paddingTop: spacing.l, marginTop: spacing.l, borderTopWidth: 1, borderTopColor: colors.border, borderStyle: 'dashed', width: '100%' },
  qrBox: { backgroundColor: colors.text, padding: spacing.m, borderRadius: radius.m, marginBottom: spacing.s },
  qrCaption: { fontSize: fontSize.xs, textAlign: 'center' },
  gateBox: { marginTop: spacing.l, padding: spacing.m, borderRadius: radius.m, borderWidth: 1.5, borderColor: colors.accent, backgroundColor: 'rgba(155,225,61,0.08)', width: '100%' },
  gateLabel: { fontSize: fontSize.xs },
  gateCountdown: { fontSize: fontSize.xxl, fontFamily: fontFamily.extrabold, color: colors.accent, marginVertical: 2 },
  gateSub: { fontSize: fontSize.xs },
  actionsRow: { flexDirection: 'row', gap: spacing.s },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: radius.m, paddingVertical: spacing.m },
  actionBtnTxt: { color: colors.onAccent, fontFamily: fontFamily.bold, fontSize: fontSize.s },
  actionBtnGhost: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border2, borderRadius: radius.m, paddingVertical: spacing.m },
  actionBtnGhostTxt: { color: colors.text, fontFamily: fontFamily.bold, fontSize: fontSize.s },
  shareCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.m, padding: spacing.l },
  shareHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  shareHeader: { fontFamily: fontFamily.bold, fontSize: fontSize.m },
  shareSub: { fontSize: fontSize.s, marginTop: 4, marginBottom: spacing.m },
  shareBtnRow: { flexDirection: 'row', gap: spacing.s, flexWrap: 'wrap' },
  waBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.whatsapp, borderRadius: radius.m, paddingHorizontal: spacing.m, paddingVertical: spacing.s },
  waBtnTxt: { color: '#fff', fontFamily: fontFamily.bold, fontSize: fontSize.s },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border2, borderRadius: radius.m, paddingHorizontal: spacing.m, paddingVertical: spacing.s },
  copyBtnTxt: { color: colors.text, fontFamily: fontFamily.bold, fontSize: fontSize.s },
  copyErr: { fontSize: fontSize.xs, color: colors.danger, marginTop: 6 },
  visBox: { marginTop: spacing.m, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderDash, borderRadius: radius.m, padding: spacing.m },
  visBoxTxt: { fontSize: fontSize.xs },
  visLink: { color: colors.accent, fontFamily: fontFamily.bold, fontSize: fontSize.xs },
  visRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.m },
  visRowTxt: { fontSize: fontSize.xs },
  rewardCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent, borderRadius: radius.m, padding: spacing.l },
  browseLink: { color: colors.accent, fontFamily: fontFamily.bold, fontSize: fontSize.s, textAlign: 'center' },
  footer: { padding: spacing.l },
});
