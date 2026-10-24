import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { auth } from '../api/auth';
import { ApiError } from '../api/client';
import { Button, Muted, Txt } from './ui';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme/tokens';

/** Self-serve login-number change — real OTP verification against the new
 * number (POST /me/phone/request-change + /confirm-change), same backend
 * contract as web's ChangePhoneNumber.tsx. */
export default function ChangePhoneNumber() {
  const { user, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [newPhone, setNewPhone] = useState('');
  const [code, setCode] = useState('');
  const [requestId, setRequestId] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const reset = () => {
    setOpen(false);
    setStep('phone');
    setNewPhone('');
    setCode('');
    setErr('');
  };

  const sendCode = async () => {
    if (!newPhone.trim()) return;
    setErr('');
    setBusy(true);
    try {
      const res = await auth.requestPhoneChange(newPhone.trim());
      setRequestId(res.requestId);
      setDevCode(res.devCode ?? '');
      setStep('otp');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to send code');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!code.trim()) return;
    setErr('');
    setBusy(true);
    try {
      await auth.confirmPhoneChange(requestId, code.trim());
      await refreshUser();
      Alert.alert('Login number updated ✓');
      reset();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to verify code');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  if (!open) {
    return (
      <View style={styles.collapsedRow}>
        <Txt style={styles.collapsedTxt}>
          <Muted>Login number </Muted>{user.phone} <Txt style={{ color: colors.accent }}>✓</Txt>
        </Txt>
        <Button label="Change number" variant="ghost" onPress={() => setOpen(true)} style={styles.changeBtn} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {step === 'phone' ? (
        <>
          <Txt style={styles.fieldLabel}>New mobile number</Txt>
          <TextInput value={newPhone} onChangeText={setNewPhone} placeholder="10-digit number" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={styles.input} />
          {!!err && <Muted style={styles.err}>✕ {err}</Muted>}
          <View style={styles.btnRow}>
            <Button label={busy ? 'Sending…' : 'Send code'} disabled={busy || !newPhone.trim()} onPress={sendCode} style={{ flex: 1 }} />
            <Button label="Cancel" variant="ghost" onPress={reset} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <>
          <Muted style={styles.otpNote}>Enter the code sent to {newPhone} via WhatsApp{devCode ? ` (dev: ${devCode})` : ''}.</Muted>
          <Txt style={styles.fieldLabel}>Verification code</Txt>
          <TextInput value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" style={styles.input} />
          {!!err && <Muted style={styles.err}>✕ {err}</Muted>}
          <View style={styles.btnRow}>
            <Button label={busy ? 'Verifying…' : 'Confirm change'} disabled={busy || !code.trim()} onPress={confirm} style={{ flex: 1 }} />
            <Button label="Cancel" variant="ghost" onPress={reset} style={{ flex: 1 }} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedRow: { backgroundColor: colors.surface2, borderRadius: radius.m, padding: spacing.m, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.s, flexWrap: 'wrap' },
  collapsedTxt: { fontSize: fontSize.s },
  changeBtn: { height: 32, paddingHorizontal: spacing.m },
  card: { backgroundColor: colors.surface2, borderRadius: radius.m, padding: spacing.m },
  fieldLabel: { fontSize: fontSize.xs, color: colors.muted, marginBottom: 4 },
  input: {
    backgroundColor: colors.surface, borderColor: colors.border3, borderWidth: 1, borderRadius: radius.m,
    paddingHorizontal: spacing.l, paddingVertical: spacing.m, color: colors.text, fontFamily: fontFamily.regular, fontSize: fontSize.m, marginBottom: spacing.s,
  },
  otpNote: { fontSize: fontSize.xs, marginBottom: spacing.s },
  err: { color: colors.danger, fontSize: fontSize.xs, marginBottom: spacing.s },
  btnRow: { flexDirection: 'row', gap: spacing.s },
});
