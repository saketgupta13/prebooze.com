import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, CheckCircle2, Copy, Minus, Plus, Send, X } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { organizer } from '../../api/organizer';
import { platform } from '../../api/platform';
import { ApiError } from '../../api/client';
import { Button, Card, Chip, H1, IconButton, Input, Muted, Screen, Txt } from '../../components/ui';
import SearchableSelect from '../../components/SearchableSelect';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';
import { fmtMoney } from '../../lib/format';
import { isEventOver } from '../../lib/events';
import { partySizeFromTierName, isCoupleTierName } from '../../lib/partySize';
import { displayTierPrice } from '../../lib/ticketTierPricing';
import type { Event, OrgBooking } from '../../types';
import type { BookingsStackParamList } from '../../navigation/types';

const GENDERS = ['Male', 'Female', 'Other'];

/** Faithful port of prebooze-web/src/pages/organizer/OfflineBooking.tsx (a
 * full page as of 2026-09-25, not a modal — same pushed-screen pattern
 * EventWizard already uses, this app has no inline-modal convention). Two
 * payment modes: "self-collected" (organizer already has the guest's cash/
 * UPI in hand, confirms immediately — they now owe Prebooze the flat 2%
 * commission PLUS the booking fee + GST portion of what they're holding,
 * since there's no gateway here to collect those separately) or "payment
 * link" (a real PhonePe order texted to the guest, fee+GST-inclusive —
 * confirms once they actually pay, same webhook pipeline every online
 * checkout already uses). See PayoutsScreen's "Offline booking charges"
 * section for what self-collected mode's cut came to per booking. */
export default function OfflineBookingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BookingsStackParamList>>();
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [bookingFee, setBookingFee] = useState(1.5);
  const [gstPct, setGstPct] = useState(0);
  const [eventId, setEventId] = useState('');
  const [tierId, setTierId] = useState('');
  const [qty, setQty] = useState(1);
  const [guestName, setGuestName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [gender, setGender] = useState('');
  const [others, setOthers] = useState<{ name: string; gender: string }[]>([]);
  const [paymentMode, setPaymentMode] = useState<'self_collected' | 'payment_link'>('self_collected');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [linkResult, setLinkResult] = useState<{ redirectUrl: string; total: number } | null>(null);
  const [selfResult, setSelfResult] = useState<OrgBooking | null>(null);

  useEffect(() => {
    organizer
      .offlineBookingEvents()
      .then((all) => setEvents(all.filter((e) => e.status === 'approved' && !isEventOver(e))))
      .catch((e) => setLoadErr(e instanceof ApiError ? e.message : 'Could not load your events'))
      .finally(() => setLoadingEvents(false));
    platform.feeInfo().then((f) => { setBookingFee(f.bookingFee); setGstPct(f.gstPct); }).catch(() => {});
  }, []);

  const event = events.find((e) => e.id === eventId);
  const tier = event?.tiers.find((t) => t.id === tierId);
  const partySize = tier ? partySizeFromTierName(tier.name) : 1;
  const extraNeeded = tier ? Math.max(0, qty * partySize - 1) : 0;
  const tierPrice = tier && event ? displayTierPrice(tier, event.date) : 0;
  const subtotal = tierPrice * qty;
  // Preview only — same formula as the backend's real computation
  // (prepareOfflineBooking), off the same public platform settings web's
  // Checkout.tsx already uses, so what's shown here matches what's charged.
  const fee = subtotal > 0 ? Math.round((subtotal * bookingFee) / 100) : 0;
  const gst = Math.round((fee * gstPct) / 100);
  const total = subtotal + fee + gst;
  const maxQty = tier ? tier.quantity - tier.sold : 1;

  useEffect(() => {
    setOthers((prev) => {
      const next = [...prev];
      while (next.length < extraNeeded) next.push({ name: '', gender: '' });
      return next.slice(0, extraNeeded);
    });
  }, [extraNeeded]);

  const tierOptions = useMemo(
    () => (event?.tiers ?? []).map((t) => `${t.name} — ${fmtMoney(displayTierPrice(t, event!.date))} (${t.quantity - t.sold} left)`),
    [event],
  );
  const tierLabel = tier && event ? `${tier.name} — ${fmtMoney(displayTierPrice(tier, event.date))} (${tier.quantity - tier.sold} left)` : '';

  const canSubmit = !!eventId && !!tierId && qty >= 1 && guestName.trim() && whatsapp.trim() && !submitting;

  const submit = async () => {
    if (!tier || !event) return;
    setErr('');
    setSubmitting(true);
    try {
      const body = {
        eventId, tierId, qty, guestName: guestName.trim(), whatsapp: whatsapp.trim(), gender: gender || undefined,
        others: others.map((o) => ({ name: o.name.trim(), gender: o.gender || undefined })).filter((o) => o.name),
        paymentMode,
      };
      const res = await organizer.createOfflineBooking(body);
      if (paymentMode === 'payment_link') {
        const r = res as { redirectUrl: string; total: number };
        setLinkResult(r);
      } else {
        setSelfResult(res as OrgBooking);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not create this booking');
    } finally {
      setSubmitting(false);
    }
  };

  // Couple tiers need exactly one Male + one Female per pair, same door
  // policy the real guest checkout enforces — kept as a soft nudge here
  // (not a hard block), matching the web modal's reasoning.
  const coupleHint = tier && isCoupleTierName(tier.name);

  const copyLink = async () => {
    if (!linkResult) return;
    await Clipboard.setStringAsync(linkResult.redirectUrl);
    Alert.alert('Copied', 'Payment link copied to clipboard.');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <H1 style={styles.title}>Offline booking</H1>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {linkResult ? (
          <Card style={styles.card}>
            <View style={styles.iconRow}><Send size={14} color={colors.accent} /><Txt style={[styles.bold, { color: colors.accent }]}>Payment link sent to {whatsapp}</Txt></View>
            <Muted style={styles.tiny}>
              {fmtMoney(linkResult.total)} — the booking confirms automatically the moment they pay, and they'll get their ticket
              the same way as any other booking. You can also copy the link below if WhatsApp delivery doesn't land.
            </Muted>
            <View style={styles.linkRow}>
              <Txt style={styles.linkText} numberOfLines={1}>{linkResult.redirectUrl}</Txt>
              <Chip label="Copy" onPress={copyLink} />
            </View>
            <Button label="Done" onPress={() => navigation.goBack()} style={{ marginTop: spacing.s }} />
          </Card>
        ) : selfResult ? (
          <Card style={styles.card}>
            <View style={styles.iconRow}><CheckCircle2 size={14} color={colors.success} /><Txt style={[styles.bold, { color: colors.success }]}>Booking confirmed — {selfResult.id}</Txt></View>
            <Muted style={styles.tiny}>Ticket sent to {whatsapp}. Prebooze's cut (2% commission + booking fee + GST) will show under Payouts → Offline booking charges.</Muted>
            <Button label="Done" onPress={() => navigation.goBack()} style={{ marginTop: spacing.s }} />
          </Card>
        ) : (
          <Card style={styles.card}>
            {!!(err || loadErr) && (
              <View style={styles.errRow}>
                <X size={14} color={colors.danger} />
                <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err || loadErr}</Txt>
              </View>
            )}

            <Txt style={styles.label}>Event</Txt>
            {loadingEvents ? (
              <Muted style={styles.tiny}>Loading…</Muted>
            ) : events.length === 0 && !loadErr ? (
              <Muted style={styles.tiny}>No live events.</Muted>
            ) : (
              <SearchableSelect
                value={event?.title ?? ''}
                onChange={(title) => { const e = events.find((x) => x.title === title); if (e) { setEventId(e.id); setTierId(''); } }}
                options={events.map((e) => e.title)}
                placeholder="Pick an event"
              />
            )}

            {event && event.tiers.length === 0 && <Muted style={[styles.tiny, styles.fieldGap]}>This event has no ticket tiers set up yet.</Muted>}

            {event && event.tiers.length > 0 && (
              <View style={styles.fieldGap}>
                <Txt style={styles.label}>Ticket tier</Txt>
                <SearchableSelect
                  value={tierLabel}
                  onChange={(label) => {
                    const idx = tierOptions.indexOf(label);
                    const t = idx >= 0 ? event.tiers[idx] : undefined;
                    if (t) setTierId(t.id);
                  }}
                  options={tierOptions}
                  placeholder="Pick a tier"
                />
              </View>
            )}

            {tier && (
              <View style={styles.fieldGap}>
                <Txt style={styles.label}>Quantity</Txt>
                <View style={styles.stepperRow}>
                  <Pressable style={styles.stepperBtn} disabled={qty <= 1} onPress={() => setQty((q) => Math.max(1, q - 1))}>
                    <Minus size={15} color={qty <= 1 ? colors.muted : colors.text} />
                  </Pressable>
                  <Txt style={styles.stepperValue}>{qty}</Txt>
                  <Pressable style={styles.stepperBtn} disabled={qty >= maxQty} onPress={() => setQty((q) => Math.min(maxQty, q + 1))}>
                    <Plus size={15} color={qty >= maxQty ? colors.muted : colors.text} />
                  </Pressable>
                </View>
              </View>
            )}

            {tier && (
              <Card style={[styles.breakdownCard, styles.fieldGap]}>
                <Muted style={styles.tiny}>Price breakdown</Muted>
                <View style={styles.breakdownRow}>
                  <Muted style={styles.tiny}>{qty} × {tier.name} ({fmtMoney(tierPrice)})</Muted>
                  <Txt style={styles.tiny}>{fmtMoney(subtotal)}</Txt>
                </View>
                <View style={styles.breakdownRow}>
                  <Muted style={styles.tiny}>Booking fee</Muted>
                  <Txt style={styles.tiny}>{fmtMoney(fee)}</Txt>
                </View>
                {gst > 0 && (
                  <View style={styles.breakdownRow}>
                    <Muted style={styles.tiny}>GST ({gstPct}% on fee)</Muted>
                    <Txt style={styles.tiny}>{fmtMoney(gst)}</Txt>
                  </View>
                )}
                <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                  <Txt style={styles.bold}>Total {paymentMode === 'self_collected' ? 'to collect' : 'guest pays'}</Txt>
                  <Txt style={styles.bold}>{total > 0 ? fmtMoney(total) : 'Free'}</Txt>
                </View>
              </Card>
            )}

            <View style={[styles.row2, styles.fieldGap]}>
              <View style={{ flex: 1 }}>
                <Txt style={styles.label}>Guest name</Txt>
                <Input value={guestName} onChangeText={setGuestName} placeholder="Main guest" />
              </View>
              <View style={{ width: 120 }}>
                <Txt style={styles.label}>Gender</Txt>
                <View style={styles.chipRow}>
                  {GENDERS.map((g) => <Chip key={g} label={g} active={gender === g} onPress={() => setGender(gender === g ? '' : g)} />)}
                </View>
              </View>
            </View>

            <View style={styles.fieldGap}>
              <Txt style={styles.label}>Guest WhatsApp number</Txt>
              <Input value={whatsapp} onChangeText={setWhatsapp} placeholder="+91 9XXXXXXXXX" keyboardType="phone-pad" />
            </View>

            {others.length > 0 && (
              <View style={styles.fieldGap}>
                <Muted style={styles.tiny}>
                  {tier?.name} needs {qty * partySize} names total{coupleHint ? ' — one Male, one Female per pair' : ''}.
                </Muted>
                {others.map((o, i) => (
                  <View key={i} style={[styles.row2, { marginTop: spacing.s }]}>
                    <Input
                      style={{ flex: 1 }}
                      value={o.name}
                      onChangeText={(t) => setOthers((prev) => prev.map((x, j) => (j === i ? { ...x, name: t } : x)))}
                      placeholder={`Guest ${i + 2} name`}
                    />
                    <View style={styles.chipRow}>
                      {GENDERS.map((g) => (
                        <Chip
                          key={g}
                          label={g[0]}
                          active={o.gender === g}
                          onPress={() => setOthers((prev) => prev.map((x, j) => (j === i ? { ...x, gender: x.gender === g ? '' : g } : x)))}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.fieldGap}>
              <Txt style={styles.label}>Payment</Txt>
              <View style={styles.chipRow}>
                <Chip label="I already have their payment" active={paymentMode === 'self_collected'} onPress={() => setPaymentMode('self_collected')} />
                <Chip label="Send a payment link" active={paymentMode === 'payment_link'} onPress={() => subtotal > 0 && setPaymentMode('payment_link')} />
              </View>
              <Muted style={styles.tiny}>
                {paymentMode === 'self_collected'
                  ? "Booking confirms right away. Prebooze's cut is deducted from your next payout."
                  : 'A real PhonePe link is texted to the guest — the booking confirms once they pay.'}
              </Muted>
            </View>

            <Button
              label={submitting ? 'Creating…' : paymentMode === 'payment_link' ? 'Send payment link →' : 'Confirm booking →'}
              onPress={submit}
              disabled={!canSubmit}
              style={{ marginTop: spacing.l }}
            />
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.l, paddingTop: spacing.l + spacing.s, paddingBottom: spacing.l },
  title: { flex: 1, fontSize: fontSize.display },
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl },
  card: { padding: spacing.l, gap: 2 },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  bold: { fontFamily: fontFamily.bold },
  tiny: { fontSize: 11.5 },
  label: { fontFamily: fontFamily.bold, fontSize: fontSize.s, marginBottom: 6 },
  fieldGap: { marginTop: spacing.m },
  row2: { flexDirection: 'row', gap: spacing.s, alignItems: 'flex-start' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.s },
  linkText: { flex: 1, fontSize: 11.5, color: colors.muted },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  stepperBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontFamily: fontFamily.bold, fontSize: fontSize.l, minWidth: 28, textAlign: 'center' },
  breakdownCard: { padding: spacing.m, backgroundColor: colors.surface2, gap: 6 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownTotal: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, marginTop: 2 },
});
