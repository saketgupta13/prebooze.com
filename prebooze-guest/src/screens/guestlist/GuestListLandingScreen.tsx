import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { catalog } from '../../api/catalog';
import { guestList } from '../../api/guestlist';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { cutoffDate, countdownLabel } from '../../lib/promoterPass';
import { Button, IconButton, Muted, Notice, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Event, PromoterProfile } from '../../types';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = { key: string; name: 'GuestListLanding'; params: RootStackParamList['GuestListLanding'] };

export default function GuestListLandingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Rt;
  const { user } = useAuth();
  const { eventSlug, promoterSlug } = route.params;

  const [event, setEvent] = useState<Event | null>(null);
  const [promoter, setPromoter] = useState<PromoterProfile | null>(null);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [companion, setCompanion] = useState('');
  const [err, setErr] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    catalog.event(eventSlug).then(setEvent).catch(() => setErr("Couldn't load this event."));
    catalog.promoter(promoterSlug).then(setPromoter).catch(() => {});
  }, [eventSlug, promoterSlug]);

  const cutoff = event ? cutoffDate(event) : null;
  const closed = cutoff ? Date.now() >= cutoff.getTime() : false;

  const join = async () => {
    if (!name.trim()) return setErr('Your name is required');
    if (!phone.trim()) return setErr('A phone number is required');
    setErr('');
    setJoining(true);
    try {
      const guest = await guestList.join(eventSlug, promoterSlug, {
        name: name.trim(),
        phone: phone.trim(),
        age: '',
        gender: '',
        companions: companion.trim() ? [{ name: companion.trim() }] : undefined,
      });
      navigation.replace('GuestPass', { passId: guest.id });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong — please try again.');
    } finally {
      setJoining(false);
    }
  };

  if (!event) {
    return (
      <Screen style={styles.center}>
        {err ? <Muted>{err}</Muted> : <ActivityIndicator color={colors.accent} />}
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
      </View>

      <KeyboardAwareScrollView enableOnAndroid extraScrollHeight={80} contentContainerStyle={styles.content}>
        <Txt style={styles.eventTitle}>{event.title}</Txt>
        <Muted style={styles.eventMeta}>
          {new Date(event.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {event.venue?.name ?? event.privateCity}
        </Muted>
        {!!promoter && <Muted style={styles.onList}>You're on <Txt style={styles.bold}>{promoter.name}</Txt>'s guest list</Muted>}

        {closed ? (
          <Notice tone="error">This guest list has closed — free entry is no longer available for this event.</Notice>
        ) : cutoff ? (
          <View style={styles.cutoffCard}>
            <Txt style={styles.cutoffLabel}>Free entry before {cutoff.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</Txt>
            <Muted style={styles.cutoffCountdown}>closes in <Txt style={{ color: colors.accent, fontFamily: fontFamily.bold }}>{countdownLabel(cutoff)}</Txt></Muted>
          </View>
        ) : null}

        {!closed && (
          <>
            <Txt style={styles.sectionLabel}>YOUR NAME</Txt>
            <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.muted} style={styles.input} />

            <Txt style={styles.sectionLabel}>PHONE NUMBER</Txt>
            <TextInput value={phone} onChangeText={setPhone} placeholder="+91" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={styles.input} />

            <Txt style={styles.sectionLabel}>BRINGING ANYONE? (OPTIONAL)</Txt>
            <TextInput value={companion} onChangeText={setCompanion} placeholder="Companion name" placeholderTextColor={colors.muted} style={styles.input} />

            {!!err && <Notice tone="error">{err}</Notice>}

            <Button label={joining ? 'Joining…' : 'Get my free-entry QR'} loading={joining} onPress={join} style={{ marginTop: spacing.l }} />

            <View style={styles.hintRow}>
              <Lock size={12} color={colors.muted2} />
              <Muted style={styles.hintText}>QR sent to WhatsApp · carry ID matching your name</Muted>
            </View>
          </>
        )}
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.l, paddingTop: spacing.s },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  eventTitle: { fontSize: fontSize.xl, fontFamily: fontFamily.extrabold, marginBottom: 4 },
  eventMeta: { marginBottom: spacing.m },
  onList: { marginBottom: spacing.l },
  bold: { fontFamily: fontFamily.bold, color: colors.text },
  cutoffCard: { backgroundColor: 'rgba(155,225,61,0.08)', borderWidth: 1, borderColor: colors.accent, borderRadius: radius.l, padding: spacing.l, marginBottom: spacing.l },
  cutoffLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.m, marginBottom: 4 },
  cutoffCountdown: { fontSize: fontSize.s },
  sectionLabel: { fontSize: fontSize.xs, fontFamily: fontFamily.bold, color: colors.muted, marginBottom: spacing.s, marginTop: spacing.m },
  input: {
    backgroundColor: colors.surface2, borderColor: colors.border3, borderWidth: 1, borderRadius: radius.m,
    paddingHorizontal: spacing.l, paddingVertical: spacing.m, color: colors.text, fontFamily: fontFamily.regular, fontSize: fontSize.l,
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, justifyContent: 'center', marginTop: spacing.m },
  hintText: { fontSize: fontSize.xs },
});
