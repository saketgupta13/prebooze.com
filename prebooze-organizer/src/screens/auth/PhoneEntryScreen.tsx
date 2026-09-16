import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MessageCircle } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { Button, H1, Muted, Screen, Txt } from '../../components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneEntry'>;

// Faithful port of prebooze-web/src/pages/auth/Login.tsx — same 10-digit
// +91 flow, same terms-checkbox gate, same WhatsApp OTP framing.
export default function PhoneEntryScreen({ navigation }: Props) {
  const { requestOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (phone.length !== 10) return setErr('Enter a valid 10-digit mobile number');
    if (!agreed) return setErr('Please accept the Terms & Privacy Policy');
    setErr('');
    setBusy(true);
    try {
      const fullPhone = `+91 ${phone}`;
      const res = await requestOtp(fullPhone);
      navigation.navigate('OtpEntry', { phone: fullPhone, requestId: res.requestId, devCode: res.devCode, existingName: res.existingName });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't send code — please try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={styles.visual}>
          <Image source={require('../../assets/logo-full.png')} style={styles.logo} resizeMode="contain" />
          <Muted style={styles.tagline}>For organizers only — manage your events, gate, and payouts on the go.</Muted>
        </View>

        <View style={styles.card}>
          <H1 style={styles.h1}>Welcome</H1>
          <Muted style={styles.sub}>Login or sign up — no password needed</Muted>

          <Txt style={styles.label}>Phone number</Txt>
          <View style={styles.phoneRow}>
            <View style={styles.dialCode}><Txt>🇮🇳 +91</Txt></View>
            <TextInput
              value={phone}
              onChangeText={(t) => { setPhone(t.replace(/\D/g, '').slice(0, 10)); setErr(''); }}
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              autoFocus
              style={styles.phoneNumberInput}
            />
          </View>

          <Pressable style={styles.checkboxRow} onPress={() => setAgreed((a) => !a)}>
            <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
              {agreed && <Txt style={styles.checkMark}>✓</Txt>}
            </View>
            <Txt style={styles.checkboxLabel}>
              I agree with the <Txt style={styles.link}>Terms & Conditions</Txt> and <Txt style={styles.link}>Privacy Policy</Txt>
            </Txt>
          </Pressable>

          {!!err && <Txt style={styles.errorText}>✕ {err}</Txt>}

          <Button label={busy ? 'Sending…' : 'Get OTP on WhatsApp'} loading={busy} onPress={submit} />
          <View style={styles.whatsappHint}>
            <MessageCircle size={13} color={colors.muted2} />
            <Muted style={styles.hintText}>WhatsApp OTP only — no password, no SMS</Muted>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.xl },
  visual: { alignItems: 'center', marginBottom: spacing.xxl },
  logo: { height: 40, width: 220, marginBottom: spacing.m },
  tagline: { textAlign: 'center', paddingHorizontal: spacing.l },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.l,
    padding: spacing.xl,
  },
  h1: { marginBottom: 4 },
  sub: { marginBottom: spacing.l },
  label: { fontFamily: fontFamily.medium, marginBottom: spacing.s },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: spacing.l },
  dialCode: {
    backgroundColor: colors.surface2,
    borderColor: colors.border3,
    borderWidth: 1,
    borderRadius: radius.m,
    paddingHorizontal: spacing.m,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneNumberInput: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderColor: colors.border3,
    borderWidth: 1,
    borderRadius: radius.m,
    paddingHorizontal: spacing.l,
    height: 50,
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.l,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s, marginBottom: spacing.l },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: colors.border3,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: colors.onAccent, fontSize: 12, fontFamily: fontFamily.bold },
  checkboxLabel: { flex: 1, color: colors.text, fontSize: fontSize.s, lineHeight: 18 },
  link: { color: colors.accent, fontFamily: fontFamily.medium },
  errorText: { color: colors.danger, fontSize: fontSize.s, marginBottom: spacing.m },
  whatsappHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.m },
  hintText: { fontSize: fontSize.xs },
});
