import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, CheckCircle2, Copy, Send, X } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { organizer } from '../../api/organizer';
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

/** Faithful port of prebooze-web/src/pages/organizer/OfflineBookingModal.tsx
 * as a pushed stack screen (RN has no inline-form modal convention in this
 * app — EventWizard uses the same full-screen-push pattern). Two payment
 * modes: "self-collected" (organizer already has the guest's cash/UPI in
 * hand, confirms immediately) or "payment link" (a real PhonePe order
 * texted to the guest — confirms once they actually pay, same webhook
 * pipeline every online checkout already uses). Prebooze takes a flat 2%
 * on either, separate from the event's own online rate — see PayoutsScreen's
 * "Offline booking charges" section for what that came to per booking. */
export default function OfflineBookingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BookingsStackParamList>>();
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadErr, setLoadErr] = useState('');
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
  const [linkResult, setLinkResult] = useState<{ redirectUrl: string; subtotal: number } | null>(null);
  const [selfResult, setSelfResult] = useState<OrgBooking | null>(null);

  useEffect(() => {
    organizer
      .offlineBookingEvents()
      .then((all) => setEvents(all.filter((e) => e.status === 'approved' && !isEventOver(e))))
      .catch((e) => setLoadErr(e instanceof ApiError ? e.message : 'Could not load your events'))
      .finally(() => setLoadingEvents(false));
  }, []);

  const event = events.find((e) => e.id === eventId);
  const tier = event?.tiers.find((t) => t.id === tierId);
  const partySize = tier ? partySizeFromTierName(tier.name) : 1;
  const extraNeeded = tier ? Math.max(0, qty * partySize - 1) : 0;
  const tierPrice = tier && event ? displayTierPrice(tier, event.date) : 0;
  const subtotal = tierPrice * qty;

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
        setLinkResult(res as { redirectUrl: string; subtotal: number });
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
              {fmtMoney(linkResult.subtotal)} — the booking confirms automatically the moment they pay, and they'll get their ticket
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
            <Muted style={styles.tiny}>Ticket sent to {whatsapp}. Prebooze's 2% ({fmtMoney(Math.round(subtotal * 0.02))}) will show under Payouts → Offline booking charges.</Muted>
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
              <View style={[styles.row2, styles.fieldGap]}>
                <View style={{ width: 100 }}>
                  <Txt style={styles.label}>Qty</Txt>
                  <Input
                    value={String(qty)}
                    onChangeText={(t) => setQty(Math.max(1, Math.min(tier.quantity - tier.sold, parseInt(t, 10) || 1)))}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt style={styles.label}>Total</Txt>
                  <Txt style={[styles.bold, { paddingVertical: spacing.s }]}>{subtotal > 0 ? fmtMoney(subtotal) : 'Free'}</Txt>
                </View>
              </View>
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
                  {tier?.name} needs {qty * partySize} names total{coupleHint ? ' — one Male, one Female per pair' : ''}. {qty} × {fmtMoney(tierPrice)} = {fmtMoney(subtotal)} total, covering all {qty * partySize} guests.
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
                  ? "Booking confirms right away. Prebooze's 2% is deducted from your next payout."
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
});
