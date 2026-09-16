import { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft, MessageCircle } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { Button, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'OtpEntry'>;

// Faithful port of prebooze-web/src/pages/auth/Otp.tsx — 4 digits (matches
// the app's 4-digit code, not web's placeholder 6), name required on first
// verify, 24s resend timer, masked phone.
export default function OtpEntryScreen({ route, navigation }: Props) {
  const { phone, requestId: initialRequestId, devCode, existingName } = route.params;
  const { verifyOtp, requestOtp } = useAuth();
  const [requestId, setRequestId] = useState(initialRequestId);
  const [digits, setDigits] = useState(['', '', '', '']);
  const [name, setName] = useState(existingName ?? '');
  const [timer, setTimer] = useState(24);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const masked = phone.slice(0, 6) + '••• ••' + phone.slice(-3);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    if (d && i < 3) refs.current[i + 1]?.focus();
  };

  const verify = async () => {
    if (digits.some((d) => !d)) return;
    if (!name.trim()) {
      setErr('Your name is required to continue');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      await verifyOtp(requestId, digits.join(''), name.trim());
      // AuthProvider's accessState now drives which stack renders — nothing
      // to navigate to here, the root navigator swaps itself.
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Invalid code — please try again');
      setDigits(['', '', '', '']);
      refs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setTimer(24);
    setErr('');
    try {
      const res = await requestOtp(phone);
      setRequestId(res.requestId);
      if (res.existingName) setName(res.existingName);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't resend code — please try again");
    }
  };

  const canSubmit = !digits.some((d) => !d) && !!name.trim();

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={styles.visual}>
          <Image source={require('../../assets/logo-full.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.card}>
          <Pressable style={styles.back} onPress={() => navigation.goBack()}>
            <ChevronLeft size={16} color={colors.muted} />
            <Muted style={styles.backLabel}>Back</Muted>
          </Pressable>
          <Txt style={styles.h1}>Enter the code</Txt>
          <View style={styles.sentRow}>
            <Muted>Sent via WhatsApp</Muted>
            <MessageCircle size={13} color={colors.muted2} />
            <Muted>to</Muted>
            <Txt style={styles.boldInline}>{masked}</Txt>
          </View>

          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(el) => { refs.current[i] = el; }}
                value={d}
                onChangeText={(v) => setDigit(i, v)}
                keyboardType="number-pad"
                maxLength={1}
                autoFocus={i === 0}
                style={styles.otpBox}
              />
            ))}
          </View>
          {!!devCode && <Muted style={styles.devHint}>Dev code: {devCode}</Muted>}

          <Txt style={styles.label}>Your name *</Txt>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={colors.muted}
            style={styles.nameInput}
          />

          {!!err && <Txt style={styles.errorText}>✕ {err}</Txt>}

          <View style={styles.resendRow}>
            {timer > 0 ? (
              <Muted style={styles.tiny}>Resend in 0:{String(timer).padStart(2, '0')}</Muted>
            ) : (
              <Pressable onPress={resend}>
                <Txt style={[styles.link, styles.tiny]}>Resend code</Txt>
              </Pressable>
            )}
            <Muted style={styles.tiny}> · </Muted>
            <Pressable onPress={() => navigation.goBack()}>
              <Txt style={[styles.link, styles.tiny]}>change number</Txt>
            </Pressable>
          </View>

          <Button label={busy ? 'Verifying…' : 'Verify & continue'} loading={busy} disabled={!canSubmit} onPress={verify} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.xl },
  visual: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { height: 36, width: 200 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.l,
    padding: spacing.xl,
  },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.s },
  backLabel: { fontSize: fontSize.s },
  h1: { fontFamily: fontFamily.bold, fontSize: fontSize.xxl, marginBottom: 6 },
  sentRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: spacing.l, flexWrap: 'wrap' },
  boldInline: { fontFamily: fontFamily.bold },
  otpRow: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.m },
  otpBox: {
    flex: 1,
    height: 56,
    textAlign: 'center',
    fontSize: fontSize.xxl,
    fontFamily: fontFamily.bold,
    color: colors.text,
    backgroundColor: colors.surface2,
    borderColor: colors.border3,
    borderWidth: 1,
    borderRadius: radius.m,
  },
  devHint: { marginBottom: spacing.m, fontSize: fontSize.xs },
  label: { fontFamily: fontFamily.medium, marginBottom: spacing.s, color: colors.text },
  nameInput: {
    backgroundColor: colors.surface2,
    borderColor: colors.border3,
    borderWidth: 1,
    borderRadius: radius.m,
    paddingHorizontal: spacing.l,
    height: 50,
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.l,
    marginBottom: spacing.m,
  },
  errorText: { color: colors.danger, fontSize: fontSize.s, marginBottom: spacing.m },
  resendRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.l },
  tiny: { fontSize: fontSize.s },
  link: { color: colors.accent, fontFamily: fontFamily.medium },
});
